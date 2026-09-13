import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { compileGlobs, matchesAny } from "@serverkgg/bridge/manifest";
import { applyWipe, consumeWipe, parseWipeKind, WIPE_MARKER, WipeKind, wipeTargets } from "./wipe";

const IDENTITY = "server/serverk";

const world = [
	`${IDENTITY}/proceduralmap.3000.4242.221.map`,
	`${IDENTITY}/proceduralmap.3000.4242.221.sav`,
	`${IDENTITY}/proceduralmap.3000.4242.221.sav.1`,
	`${IDENTITY}/proceduralmap.3000.4242.221.sav.2`,
];

const occlusion = [
	`${IDENTITY}/proceduralmap.3000.90807060.288_occlusion_3.dat`,
	`${IDENTITY}/proceduralmap.3000.1617222103.288_occlusion_3.dat`,
];

const player = [
	`${IDENTITY}/player.blueprints.5.db`,
	`${IDENTITY}/player.deaths.5.db`,
	`${IDENTITY}/player.identities.5.db`,
	`${IDENTITY}/player.states.5.db`,
	`${IDENTITY}/player.tokens.db`,
];

const listing = [
	...world,
	...occlusion,
	...player,
];

describe("reading the wipe a player asked for", () => {
	test("reads both kinds the panel can request", () => {
		expect(parseWipeKind("map")).toBe(WipeKind.Map);
		expect(parseWipeKind("full")).toBe(WipeKind.Full);
	});

	test("reads the trailing newline the marker file carries", () => {
		expect(parseWipeKind("full\n")).toBe(WipeKind.Full);
	});

	test("refuses a marker it does not understand, so a stray file never wipes a server", () => {
		for (const raw of [
			"",
			"everything",
			"MAP",
			"map full",
		]) {
			expect(parseWipeKind(raw)).toBeNull();
		}
	});
});

describe("choosing what a map wipe deletes", () => {
	test("deletes the map and every save beside it", () => {
		expect(wipeTargets(listing, WipeKind.Map)).toEqual([
			...world,
			...occlusion,
		]);
	});

	test("deletes the occlusion cache rust leaves beside a map, including the one a dead map left behind", () => {
		expect(wipeTargets(occlusion, WipeKind.Map)).toEqual(occlusion);
	});

	test("keeps the blueprints players unlocked", () => {
		for (const path of player) {
			expect(wipeTargets(listing, WipeKind.Map)).not.toContain(path);
		}
	});

	test("keeps the config a player edited by hand", () => {
		expect(
			wipeTargets(
				[
					`${IDENTITY}/cfg/server.cfg`,
					`${IDENTITY}/cfg/users.cfg`,
					`${IDENTITY}/cfg/bans.cfg`,
				],
				WipeKind.Map,
			),
		).toEqual([]);
	});
});

describe("choosing what a full wipe deletes", () => {
	test("deletes the map, the occlusion cache, the saves and every player database", () => {
		expect(wipeTargets(listing, WipeKind.Full)).toEqual(listing);
	});

	test("deletes the journals sqlite leaves beside a database", () => {
		expect(
			wipeTargets(
				[
					`${IDENTITY}/player.blueprints.5.db-journal`,
					`${IDENTITY}/player.blueprints.5.db-wal`,
				],
				WipeKind.Full,
			),
		).toHaveLength(2);
	});

	test("keeps a data file that is not an occlusion cache", () => {
		expect(
			wipeTargets(
				[
					`${IDENTITY}/companion.id`,
					`${IDENTITY}/occlusion.dat`,
					`${IDENTITY}/proceduralmap.3000.90807060.288_occlusion.dat`,
				],
				WipeKind.Full,
			),
		).toEqual([]);
	});

	test("still keeps the config, because a wipe is not a reset", () => {
		expect(
			wipeTargets(
				[
					`${IDENTITY}/cfg/server.cfg`,
				],
				WipeKind.Full,
			),
		).toEqual([]);
	});
});

const identityWith = (paths: string[]) => {
	const stored = new Map<string, string>(
		paths.map((path) => [
			path,
			"",
		]),
	);

	const globs: string[] = [];

	const context = {
		files: {
			async list(glob: string) {
				globs.push(glob);

				const patterns = compileGlobs([
					glob,
				]);
				const files = [
					...stored.keys(),
				];
				const directories = new Set(
					files.flatMap((path) => {
						const segments = path.split("/");

						return segments.slice(1).map((_, index) => segments.slice(0, index + 1).join("/"));
					}),
				);

				return [
					...[
						...directories,
					].map((path) => {
						return {
							path,
							directory: true,
						};
					}),
					...files.map((path) => {
						return {
							path,
							directory: false,
						};
					}),
				].filter((entry) => matchesAny(entry.path, patterns));
			},
			async exists(path: string) {
				return stored.has(path);
			},
			async read(path: string) {
				return stored.get(path) ?? "";
			},
			async write(path: string, content: string) {
				stored.set(path, content);
			},
			async remove(path: string) {
				stored.delete(path);
			},
		},
		log() {},
	} as unknown as Bridge.Context;

	return {
		context,
		globs,
		stored,
	};
};

describe("applying a wipe the platform runs with the server stopped", () => {
	test("lists only the files directly inside the serverk identity", async () => {
		const { context, globs } = identityWith(listing);

		await applyWipe(context, WipeKind.Map);

		expect(globs).toEqual([
			"server/serverk/*",
		]);
	});

	test("leaves a world outside the serverk identity and the config folder untouched", async () => {
		const outside = [
			"server/my_server_identity/proceduralmap.3000.4242.221.map",
			"server/my_server_identity/player.blueprints.5.db",
			`${IDENTITY}/cfg/server.cfg`,
			`${IDENTITY}/cfg/proceduralmap.3000.4242.221.sav`,
		];
		const { context, stored } = identityWith([
			...listing,
			...outside,
		]);

		await applyWipe(context, WipeKind.Full);

		expect([
			...stored.keys(),
		]).toEqual(outside);
	});

	test("clears the map and keeps the blueprints on a map wipe", async () => {
		const { context, stored } = identityWith(listing);

		await applyWipe(context, WipeKind.Map);

		expect([
			...stored.keys(),
		]).toEqual(player);
	});

	test("clears the player databases too on a full wipe", async () => {
		const { context, stored } = identityWith(listing);

		await applyWipe(context, WipeKind.Full);

		expect(stored.size).toBe(0);
	});

	test("needs no marker, because the platform already stopped the server and stored a recovery backup", async () => {
		const { context, stored } = identityWith(world);

		await applyWipe(context, WipeKind.Map);

		expect(stored.has(WIPE_MARKER)).toBe(false);
		expect(stored.size).toBe(0);
	});
});

describe("honouring a wipe the previous release left for the next start", () => {
	test("applies a marker a previous release wrote, then removes it", async () => {
		const { context, stored } = identityWith(listing);

		stored.set(WIPE_MARKER, "full\n");

		await consumeWipe(context);

		expect(stored.size).toBe(0);
	});

	test("drops a marker it cannot read without wiping anything", async () => {
		const { context, stored } = identityWith(listing);

		stored.set(WIPE_MARKER, "everything\n");

		await consumeWipe(context);

		expect(stored.has(WIPE_MARKER)).toBe(false);
		expect(stored.size).toBe(listing.length);
	});

	test("starts normally when no wipe is waiting", async () => {
		const { context, stored } = identityWith(listing);

		await consumeWipe(context);

		expect(stored.size).toBe(listing.length);
	});
});
