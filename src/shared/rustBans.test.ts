import { describe, expect, test } from "bun:test";
import { BridgeUserError } from "@serverkgg/bridge";
import { parseBanList, requireSteamId } from "./rustBans";
import { unbanCommand } from "./rustConsole";

describe("reading the ban list rust answers banlistex with", () => {
	test("reads the numbered line banlistex answers with", () => {
		expect(parseBanList('0 76561198000000001 "Meslzy" "Banned by an admin." -1')).toEqual([
			{
				steamId: "76561198000000001",
				name: "Meslzy",
				reason: "Banned by an admin.",
			},
		]);
	});

	test("reads the banid line the older banlist answers with", () => {
		expect(parseBanList('banid 76561198000000001 "Meslzy" "Banned by an admin."')).toEqual([
			{
				steamId: "76561198000000001",
				name: "Meslzy",
				reason: "Banned by an admin.",
			},
		]);
	});

	test("reads a banid line whose steam id rust quoted", () => {
		expect(parseBanList('banid "76561198000000001" "Meslzy" "Banned by an admin."').at(0)?.steamId).toBe(
			"76561198000000001",
		);
	});

	test("reads every ban in a multi-line answer", () => {
		expect(
			parseBanList(
				[
					"2 users banned:",
					'0 76561198000000001 "Meslzy" "Banned by an admin." -1',
					'1 76561198000000002 "Nasser" "Cheating" -1',
				].join("\n"),
			).map((ban) => ban.steamId),
		).toEqual([
			"76561198000000001",
			"76561198000000002",
		]);
	});

	test("keeps a ban rust wrote with windows line endings", () => {
		expect(parseBanList('0 76561198000000001 "Meslzy" "Banned by an admin." -1\r\n')).toHaveLength(1);
	});

	test("keeps an arabic name intact", () => {
		expect(parseBanList('0 76561198000000001 "مسلزي" "Banned by an admin." -1').at(0)?.name).toBe("مسلزي");
	});

	test("keeps a ban rust answered with no name and no reason", () => {
		expect(parseBanList("0 76561198000000001").at(0)).toEqual({
			steamId: "76561198000000001",
			name: "",
			reason: "",
		});
	});

	test("reads an empty reason back as empty, which is what a ban by id writes", () => {
		expect(parseBanList('0 76561198000000001 "" "" -1').at(0)?.reason).toBe("");
	});

	test("lists nobody when nobody is banned", () => {
		expect(parseBanList("")).toEqual([]);
	});

	test("skips the header line, because it carries no steam id", () => {
		expect(parseBanList("0 users banned:")).toEqual([]);
	});

	test("treats the plain-text error rust sends on a bad command as an empty list", () => {
		expect(parseBanList("Unknown Command: banlistex")).toEqual([]);
	});

	test("lists a steam id once, however many lines rust repeated it on", () => {
		expect(
			parseBanList(
				[
					'0 76561198000000001 "Meslzy" "Banned by an admin." -1',
					'1 76561198000000001 "Meslzy" "Banned by an admin." -1',
				].join("\n"),
			),
		).toHaveLength(1);
	});
});

describe("taking a steam id from the ban box", () => {
	test("accepts the seventeen digit steam id the placeholder shows", () => {
		expect(requireSteamId("76561198000000001")).toBe("76561198000000001");
	});

	test("accepts an id the player pasted with spaces around it", () => {
		expect(requireSteamId("  76561198000000001  ")).toBe("76561198000000001");
	});

	test("refuses a name, because rust bans by id and nothing else", () => {
		expect(() => requireSteamId("Meslzy")).toThrow(BridgeUserError);
	});

	test("refuses an id that is too short to be a steam id", () => {
		expect(() => requireSteamId("7656119800000")).toThrow(BridgeUserError);
	});

	test("refuses seventeen digits that are not a steam account id", () => {
		expect(() => requireSteamId("12345678901234567")).toThrow(BridgeUserError);
	});
});

describe("lifting a ban", () => {
	test("unbans by the steam id the row carries", () => {
		expect(unbanCommand("76561198000000001")).toBe('unban "76561198000000001"');
	});
});
