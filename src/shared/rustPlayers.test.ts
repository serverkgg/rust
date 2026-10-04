import { describe, expect, it } from "bun:test";
import { parsePlayerList, parseServerHealth, parseServerInfo, presenceOf } from "./rustPlayers";

const player = (overrides: Record<string, unknown> = {}) => {
	return {
		SteamID: "76561198000000001",
		OwnerSteamID: "0",
		DisplayName: "Meslzy",
		Ping: 42,
		Address: "10.0.0.1:52341",
		ConnectedSeconds: 900,
		VoiationLevel: 0,
		CurrentLevel: 34,
		UnspentXp: 0,
		Health: 100,
		...overrides,
	};
};

describe("reading the roster rust answers playerlist with", () => {
	it("reads a player into a row keyed by steam id", () => {
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
				level: 34,
				ping: 42,
				connected: 900,
				avatarHash: null,
			},
		]);
	});

	it("reads an empty server as an empty roster", () => {
		expect(parsePlayerList("[]")).toEqual([]);
	});

	it("reads a steam id rust sent as a number", () => {
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

	it("falls back to the steam id when a player has no display name", () => {
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

	it("drops an entry with no steam id, because no row can act on it", () => {
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

	it("rounds a fractional ping, so the table shows a whole number", () => {
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

	it("reports a missing ping as nothing rather than as zero", () => {
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

	it("keeps arabic names intact", () => {
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

	it("treats a truncated answer as an empty roster instead of throwing", () => {
		expect(parsePlayerList('[{"SteamID":"765611')).toEqual([]);
	});

	it("treats the plain-text error rust sends on a bad command as an empty roster", () => {
		expect(parsePlayerList("Unknown Command: playerlist")).toEqual([]);
	});

	it("ignores anything in the array that is not a player object", () => {
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
	it("reads the online and max counts the panel shows", () => {
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

	it("reads an empty server as zero online, not as unknown", () => {
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

	it("reports unknown when rust answered with something that is not a count", () => {
		expect(parseServerInfo("Unknown Command: serverinfo")).toEqual({
			online: null,
			max: null,
		});
	});

	it("reports unknown for a field rust left out", () => {
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

describe("reading the level rust reports beside the player", () => {
	it("reads the level the roster column shows", () => {
		expect(
			parsePlayerList(
				JSON.stringify([
					player(),
				]),
			).at(0)?.level,
		).toBe(34);
	});

	it("reports a missing level as nothing rather than as zero", () => {
		expect(
			parsePlayerList(
				JSON.stringify([
					player({
						CurrentLevel: null,
					}),
				]),
			).at(0)?.level,
		).toBeNull();
	});

	it("rounds a fractional level, because rust reports it as a float", () => {
		expect(
			parsePlayerList(
				JSON.stringify([
					player({
						CurrentLevel: 33.6,
					}),
				]),
			).at(0)?.level,
		).toBe(34);
	});

	it("leaves the avatar unresolved until the steam lookup fills it", () => {
		expect(
			parsePlayerList(
				JSON.stringify([
					player(),
				]),
			).at(0)?.avatarHash,
		).toBeNull();
	});
});

const ENTRY = {
	id: "76561198000000001",
	name: "Meslzy",
	level: 34,
	ping: 31,
	connected: 900,
	avatarHash: null,
};

describe("sending the player data serverk.yml promises", () => {
	it("carries the name, the steam id and every declared field", () => {
		expect(presenceOf(ENTRY)).toEqual({
			player: "Meslzy",
			steamId: "76561198000000001",
			platform: "Steam",
			level: "34",
			ping: "31",
		});
	});

	it("names steam as the platform, because rust sells on nothing else", () => {
		expect(presenceOf(ENTRY).platform).toBe("Steam");
	});

	it("carries the avatar hash once the steam lookup has filled it", () => {
		expect(
			presenceOf({
				...ENTRY,
				avatarHash: "a".repeat(40),
			}).avatarHash,
		).toBe("a".repeat(40));
	});

	it("drops a field rust did not report rather than sending it empty", () => {
		expect(
			presenceOf({
				...ENTRY,
				level: null,
				ping: null,
			}),
		).toEqual({
			player: "Meslzy",
			steamId: "76561198000000001",
			platform: "Steam",
		});
	});
});

const SERVER_INFO = {
	Hostname: "Serverk Rust",
	MaxPlayers: 50,
	Players: 12,
	Queued: 2,
	Joining: 1,
	EntityCount: 92_345,
	GameTime: "06/06/2026 14:23:11",
	Uptime: 7860,
	Map: "Procedural Map",
	Framerate: 59.4,
	Memory: 4096,
	MemoryUsageSystem: 8192,
	Collections: 1234,
	NetworkIn: 51_200,
	NetworkOut: 102_400,
	Restarting: false,
	SaveCreatedTime: "06/06/2026 13:00:00",
	Version: 2551,
	Protocol: "2551.235.1",
};

describe("reading the health rust answers serverinfo with", () => {
	it("reads every number the health card shows from a full reply", () => {
		expect(parseServerHealth(JSON.stringify(SERVER_INFO))).toEqual({
			hostname: "Serverk Rust",
			map: "Procedural Map",
			online: 12,
			max: 50,
			queued: 2,
			joining: 1,
			entities: 92_345,
			fps: 59,
			memoryMb: 4096,
			uptimeSeconds: 7860,
			version: "2551",
		});
	});

	it("reads a partial reply, leaving every key rust left out unknown", () => {
		expect(
			parseServerHealth(
				JSON.stringify({
					Players: 3,
					MaxPlayers: 50,
				}),
			),
		).toEqual({
			hostname: null,
			map: null,
			online: 3,
			max: 50,
			queued: null,
			joining: null,
			entities: null,
			fps: null,
			memoryMb: null,
			uptimeSeconds: null,
			version: null,
		});
	});

	it("reports nothing at all when rust answered with something that is not a reply", () => {
		expect(parseServerHealth("Unknown Command: serverinfo")).toBeNull();
	});

	it("reports nothing at all when the answer was cut off mid-frame", () => {
		expect(parseServerHealth('{"Players":1')).toBeNull();
	});

	it("refuses a json array, because serverinfo answers with one object", () => {
		expect(parseServerHealth("[]")).toBeNull();
	});

	it("falls back to the protocol when rust reported no build number", () => {
		expect(
			parseServerHealth(
				JSON.stringify({
					...SERVER_INFO,
					Version: null,
				}),
			)?.version,
		).toBe("2551.235.1");
	});

	it("reads the player count the panel shows out of the same reply", () => {
		expect(parseServerInfo(JSON.stringify(SERVER_INFO))).toEqual({
			online: 12,
			max: 50,
		});
	});
});
