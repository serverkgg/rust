import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { compileGlobs, matchesAny } from "@serverkgg/bridge/manifest";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
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
	it("reads both kinds the panel can request", () => {
		expect(parseWipeKind("map")).toBe(WipeKind.Map);
		expect(parseWipeKind("full")).toBe(WipeKind.Full);
	});

	it("reads the trailing newline the marker file carries", () => {
		expect(parseWipeKind("full\n")).toBe(WipeKind.Full);
	});

	it("refuses a marker it does not understand, so a stray file never wipes a server", () => {
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
	it("deletes the map and every save beside it", () => {
		expect(wipeTargets(listing, WipeKind.Map)).toEqual([
			...world,
			...occlusion,
		]);
	});

	it("deletes the occlusion cache rust leaves beside a map, including the one a dead map left behind", () => {
		expect(wipeTargets(occlusion, WipeKind.Map)).toEqual(occlusion);
	});

	it("keeps the blueprints players unlocked", () => {
		for (const path of player) {
			expect(wipeTargets(listing, WipeKind.Map)).not.toContain(path);
		}
	});

	it("keeps the config a player edited by hand", () => {
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
	it("deletes the map, the occlusion cache, the saves and every player database", () => {
		expect(wipeTargets(listing, WipeKind.Full)).toEqual(listing);
	});

	it("deletes the journals sqlite leaves beside a database", () => {
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

	it("keeps a data file that is not an occlusion cache", () => {
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

	it("still keeps the config, because a wipe is not a reset", () => {
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
	const reported: Bridge.Activity[] = [];

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
		activity: {
			report(entry: Bridge.Activity) {
				reported.push(entry);
			},
		},
		log() {},
	} as unknown as Bridge.Context;

	return {
		context,
		globs,
		reported,
		stored,
	};
};

describe("applying a wipe the platform runs with the server stopped", () => {
	it("lists only the files directly inside the serverk identity", async () => {
		const { context, globs } = identityWith(listing);

		await applyWipe(context, WipeKind.Map);

		expect(globs).toEqual([
			"server/serverk/*",
		]);
	});

	it("leaves a world outside the serverk identity and the config folder untouched", async () => {
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

	it("clears the map and keeps the blueprints on a map wipe", async () => {
		const { context, stored } = identityWith(listing);

		await applyWipe(context, WipeKind.Map);

		expect([
			...stored.keys(),
		]).toEqual(player);
	});

	it("clears the player databases too on a full wipe", async () => {
		const { context, stored } = identityWith(listing);

		await applyWipe(context, WipeKind.Full);

		expect(stored.size).toBe(0);
	});

	it("needs no marker, because the platform already stopped the server and stored a recovery backup", async () => {
		const { context, stored } = identityWith(world);

		await applyWipe(context, WipeKind.Map);

		expect(stored.has(WIPE_MARKER)).toBe(false);
		expect(stored.size).toBe(0);
	});
});

describe("telling the owner what a wipe removed", () => {
	it("reports a map wipe with its scope and the number of files it removed", async () => {
		const { context, reported } = identityWith(listing);

		await applyWipe(context, WipeKind.Map);

		expect(reported).toEqual([
			{
				name: BridgeEventName.WorldWiped,
				text: {
					ar: "تم وايب الماب (6 ملفات)",
					en: "Wiped the map (6 files)",
				},
				details: {
					scope: WipeKind.Map,
					files: 6,
				},
			},
		]);
	});

	it("reports a full wipe with every file it removed, player databases included", async () => {
		const { context, reported } = identityWith(listing);

		await applyWipe(context, WipeKind.Full);

		expect(reported.map((entry) => entry.name)).toEqual([
			BridgeEventName.WorldWiped,
		]);
		expect(reported.at(0)?.details).toEqual({
			scope: WipeKind.Full,
			files: listing.length,
		});
		expect(reported.at(0)?.text.en).toBe(`Wiped the map and player data (${listing.length} files)`);
	});

	it("reports the wipe a marker from a previous release applies on start", async () => {
		const { context, reported, stored } = identityWith(listing);

		stored.set(WIPE_MARKER, "map\n");

		await consumeWipe(context);

		expect(reported.at(0)?.details?.files).toBe(world.length + occlusion.length);
	});

	it("reports nothing when no wipe is waiting", async () => {
		const { context, reported } = identityWith(listing);

		await consumeWipe(context);

		expect(reported).toEqual([]);
	});
});

describe("honouring a wipe the previous release left for the next start", () => {
	it("applies a marker a previous release wrote, then removes it", async () => {
		const { context, stored } = identityWith(listing);

		stored.set(WIPE_MARKER, "full\n");

		await consumeWipe(context);

		expect(stored.size).toBe(0);
	});

	it("drops a marker it cannot read without wiping anything", async () => {
		const { context, stored } = identityWith(listing);

		stored.set(WIPE_MARKER, "everything\n");

		await consumeWipe(context);

		expect(stored.has(WIPE_MARKER)).toBe(false);
		expect(stored.size).toBe(listing.length);
	});

	it("starts normally when no wipe is waiting", async () => {
		const { context, stored } = identityWith(listing);

		await consumeWipe(context);

		expect(stored.size).toBe(listing.length);
	});
});
