import { describe, expect, test } from "bun:test";
import { parsePlayerList, parseServerInfo } from "./rustPlayers";

const player = (overrides: Record<string, unknown> = {}) => {
	return {
		SteamID: "76561198000000001",
		OwnerSteamID: "0",
		DisplayName: "Meslzy",
		Ping: 42,
		Address: "10.0.0.1:52341",
		ConnectedSeconds: 900,
		VoiationLevel: 0,
		CurrentLevel: 0,
		UnspentXp: 0,
		Health: 100,
		...overrides,
	};
};

describe("reading the roster rust answers playerlist with", () => {
	test("reads a player into a row keyed by steam id", () => {
		expect(
			parsePlayerList(
				JSON.stringify([
					player(),
				]),
			),
		).toEqual([
			{
				id: "76561198000000001",
				name: "Meslzy",
				ping: 42,
				connected: 900,
			},
		]);
	});

	test("reads an empty server as an empty roster", () => {
		expect(parsePlayerList("[]")).toEqual([]);
	});

	test("reads a steam id rust sent as a number", () => {
		expect(
			parsePlayerList(
				JSON.stringify([
					player({
						SteamID: 7_656_119_800_000_001,
					}),
				]),
			).at(0)?.id,
		).toBe("7656119800000001");
	});

	test("falls back to the steam id when a player has no display name", () => {
		expect(
			parsePlayerList(
				JSON.stringify([
					player({
						DisplayName: "",
					}),
				]),
			).at(0)?.name,
		).toBe("76561198000000001");
	});

	test("drops an entry with no steam id, because no row can act on it", () => {
		expect(
			parsePlayerList(
				JSON.stringify([
					player({
						SteamID: null,
					}),
					player(),
				]),
			),
		).toHaveLength(1);
	});

	test("rounds a fractional ping, so the table shows a whole number", () => {
		expect(
			parsePlayerList(
				JSON.stringify([
					player({
						Ping: 42.7,
					}),
				]),
			).at(0)?.ping,
		).toBe(43);
	});

	test("reports a missing ping as nothing rather than as zero", () => {
		expect(
			parsePlayerList(
				JSON.stringify([
					player({
						Ping: null,
					}),
				]),
			).at(0)?.ping,
		).toBeNull();
	});

	test("keeps arabic names intact", () => {
		expect(
			parsePlayerList(
				JSON.stringify([
					player({
						DisplayName: "مسلزي",
					}),
				]),
			).at(0)?.name,
		).toBe("مسلزي");
	});

	test("treats a truncated answer as an empty roster instead of throwing", () => {
		expect(parsePlayerList('[{"SteamID":"765611')).toEqual([]);
	});

	test("treats the plain-text error rust sends on a bad command as an empty roster", () => {
		expect(parsePlayerList("Unknown Command: playerlist")).toEqual([]);
	});

	test("ignores anything in the array that is not a player object", () => {
		expect(
			parsePlayerList(
				JSON.stringify([
					null,
					42,
					"x",
					player(),
				]),
			),
		).toHaveLength(1);
	});
});

describe("reading the player count rust answers serverinfo with", () => {
	test("reads the online and max counts the panel shows", () => {
		expect(
			parseServerInfo(
				JSON.stringify({
					Hostname: "My Server",
					MaxPlayers: 50,
					Players: 12,
					Queued: 0,
					Map: "Procedural Map",
				}),
			),
		).toEqual({
			online: 12,
			max: 50,
		});
	});

	test("reads an empty server as zero online, not as unknown", () => {
		expect(
			parseServerInfo(
				JSON.stringify({
					MaxPlayers: 50,
					Players: 0,
				}),
			),
		).toEqual({
			online: 0,
			max: 50,
		});
	});

	test("reports unknown when rust answered with something that is not a count", () => {
		expect(parseServerInfo("Unknown Command: serverinfo")).toEqual({
			online: null,
			max: null,
		});
	});

	test("reports unknown for a field rust left out", () => {
		expect(
			parseServerInfo(
				JSON.stringify({
					Players: 3,
				}),
			),
		).toEqual({
			online: 3,
			max: null,
		});
	});
});
