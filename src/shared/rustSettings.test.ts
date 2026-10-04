import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { SERVER_CFG } from "./rustApp";
import {
	convarValues,
	fieldValues,
	HOSTNAME_FIELD,
	HOSTNAME_KEY,
	mergeSettings,
	numberOf,
	PVE_FIELD,
	PVE_KEY,
	readSettings,
	SEED_FIELD,
	SEED_KEY,
	SETTING_FIELDS,
	settingsOf,
} from "./rustSettings";

interface Merge {
	path: string;
	values: Bridge.Values;
}

const contextWith = (options: { stored?: Bridge.Values; reads?: string[]; merges?: Merge[] }) => {
	return {
		codec: {
			sourceCfg: {
				read: async (path: string) => {
					options.reads?.push(path);

					return options.stored ?? {};
				},
				merge: async (path: string, values: Bridge.Values) => {
					options.merges?.push({
						path,
						values,
					});
				},
			},
		},
		activity: {
			report() {},
		},
	} as unknown as Bridge.Context;
};

describe("reaching server.cfg through the codec rust's config format has", () => {
	it("reads the convars out of the identity's server.cfg", async () => {
		const reads: string[] = [];

		expect(
			await readSettings(
				contextWith({
					reads,
					stored: {
						[HOSTNAME_KEY]: "My Server",
					},
				}),
			),
		).toEqual({
			[HOSTNAME_KEY]: "My Server",
		});

		expect(reads).toEqual([
			SERVER_CFG,
		]);
	});

	it("reads a server that has never been started as no settings at all", async () => {
		expect(await readSettings(contextWith({}))).toEqual({});
	});

	it("writes a change back into the same file, leaving the rest of it to the codec", async () => {
		const merges: Merge[] = [];

		await mergeSettings(
			contextWith({
				merges,
			}),
			{
				[SEED_KEY]: 4242,
			},
		);

		expect(merges).toEqual([
			{
				path: SERVER_CFG,
				values: {
					[SEED_KEY]: 4242,
				},
			},
		]);
	});
});

describe("mapping the panel's fields onto rust's convars", () => {
	it("reads every declared field back from the convars server.cfg holds", () => {
		expect(
			fieldValues({
				[HOSTNAME_KEY]: "My Server",
				[SEED_KEY]: 4242,
				[PVE_KEY]: true,
			}),
		).toMatchObject({
			[HOSTNAME_FIELD]: "My Server",
			[SEED_FIELD]: 4242,
			[PVE_FIELD]: true,
		});
	});

	it("answers with every field the form declares, even the ones the file has not got", () => {
		expect(Object.keys(fieldValues({})).sort()).toEqual(Object.keys(SETTING_FIELDS).sort());
	});

	it("reports a setting the file never had as empty rather than as missing", () => {
		expect(fieldValues({})[HOSTNAME_FIELD]).toBeNull();
	});

	it("writes a submitted field back to the convar rust reads", () => {
		expect(
			convarValues({
				[HOSTNAME_FIELD]: "My Server",
				[PVE_FIELD]: false,
			}),
		).toEqual({
			[HOSTNAME_KEY]: "My Server",
			[PVE_KEY]: false,
		});
	});

	it("drops anything the form does not declare, so nothing stray reaches server.cfg", () => {
		expect(
			convarValues({
				"rcon.password": "leaked",
				[HOSTNAME_FIELD]: "My Server",
			}),
		).toEqual({
			[HOSTNAME_KEY]: "My Server",
		});
	});

	it("round-trips a full form submission through the convars and back", () => {
		const submitted = fieldValues({
			[HOSTNAME_KEY]: "My Server",
			[SEED_KEY]: 4242,
			[PVE_KEY]: true,
		});

		expect(fieldValues(convarValues(submitted))).toEqual(submitted);
	});
});

describe("resolving the values the start command is built from", () => {
	it("falls back to a sane default for every setting the file is missing", () => {
		expect(settingsOf({}, 777)).toEqual({
			hostname: "Serverk Rust",
			description: "",
			maxPlayers: 50,
			worldSize: 3000,
			seed: 777,
			saveInterval: 300,
			pve: false,
		});
	});

	it("clamps a world size a player pushed past what rust accepts", () => {
		expect(
			settingsOf(
				{
					"server.worldsize": 99_999,
				},
				1,
			).worldSize,
		).toBe(6000);
	});

	it("clamps a world size below rust's floor", () => {
		expect(
			settingsOf(
				{
					"server.worldsize": 10,
				},
				1,
			).worldSize,
		).toBe(1000);
	});

	it("reads a boolean the codec left as text", () => {
		expect(
			settingsOf(
				{
					"server.pve": "true",
				},
				1,
			).pve,
		).toBe(true);
	});

	it("ignores a number a player typed as words and keeps the default", () => {
		expect(
			settingsOf(
				{
					"server.maxplayers": "many",
				},
				1,
			).maxPlayers,
		).toBe(50);
	});

	it("keeps the seed already in the file rather than the generated one", () => {
		expect(
			settingsOf(
				{
					"server.seed": 12_345,
				},
				777,
			).seed,
		).toBe(12_345);
	});
});

describe("reading a number out of a config file a player edited", () => {
	it("falls back rather than reading an absent value as zero", () => {
		expect(numberOf(null, 300, 60, 3600)).toBe(300);
	});

	it("falls back on a value a player blanked out", () => {
		expect(numberOf("", 300, 60, 3600)).toBe(300);
		expect(numberOf("   ", 300, 60, 3600)).toBe(300);
	});

	it("falls back on a boolean, which is never a count", () => {
		expect(numberOf(true, 300, 60, 3600)).toBe(300);
	});

	it("reads a real zero the player typed and clamps it to the floor", () => {
		expect(numberOf(0, 300, 60, 3600)).toBe(60);
	});

	it("reads a number the codec left as text", () => {
		expect(numberOf("900", 300, 60, 3600)).toBe(900);
	});

	it("rounds a fraction, because rust takes whole numbers", () => {
		expect(numberOf(900.6, 300, 60, 3600)).toBe(901);
	});
});
