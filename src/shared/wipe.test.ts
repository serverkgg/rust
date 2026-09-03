import { describe, expect, test } from "bun:test";
import { parseWipeKind, WipeKind, wipeTargets } from "./wipe";

const IDENTITY = "server/serverk";

const world = [
	`${IDENTITY}/proceduralmap.3000.4242.221.map`,
	`${IDENTITY}/proceduralmap.3000.4242.221.sav`,
	`${IDENTITY}/proceduralmap.3000.4242.221.sav.1`,
	`${IDENTITY}/proceduralmap.3000.4242.221.sav.2`,
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
		expect(wipeTargets(listing, WipeKind.Map)).toEqual(world);
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
	test("deletes the map, the saves and every player database", () => {
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
