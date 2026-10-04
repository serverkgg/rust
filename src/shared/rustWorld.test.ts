import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { type RustSettings, settingsOf } from "./rustSettings";
import { mapGenerationsOf, replacesMap, reportNewMap } from "./rustWorld";

const IDENTITY = "server/serverk";

const settingsWith = (worldSize: number, seed: number): RustSettings => {
	return {
		...settingsOf({}, seed),
		worldSize,
		seed,
	};
};

const saved = [
	`${IDENTITY}/proceduralmap.3000.4242.221.map`,
	`${IDENTITY}/proceduralmap.3000.4242.221.sav`,
	`${IDENTITY}/proceduralmap.3000.4242.221.sav.1`,
	`${IDENTITY}/proceduralmap.3000.4242.221_occlusion_3.dat`,
	`${IDENTITY}/player.blueprints.5.db`,
	`${IDENTITY}/cfg/server.cfg`,
];

const identityWith = (paths: string[] | Error) => {
	const reported: Bridge.Activity[] = [];
	const warned: string[] = [];

	const context = {
		files: {
			async list() {
				if (paths instanceof Error) {
					throw paths;
				}

				return paths.map((path) => {
					return {
						path,
						directory: false,
					};
				});
			},
		},
		activity: {
			report(entry: Bridge.Activity) {
				reported.push(entry);
			},
		},
		log: Object.assign(() => {}, {
			warn(message: string) {
				warned.push(message);
			},
		}),
	} as unknown as Bridge.Context;

	return {
		context,
		reported,
		warned,
	};
};

describe("reading which map rust generated from its save file names", () => {
	it("reads the size and seed of every map and save", () => {
		expect(mapGenerationsOf(saved)).toEqual([
			{
				size: 3000,
				seed: 4242,
			},
			{
				size: 3000,
				seed: 4242,
			},
			{
				size: 3000,
				seed: 4242,
			},
		]);
	});

	it("ignores the occlusion cache, the player databases and the config", () => {
		expect(
			mapGenerationsOf([
				`${IDENTITY}/proceduralmap.3000.4242.221_occlusion_3.dat`,
				`${IDENTITY}/player.blueprints.5.db`,
				`${IDENTITY}/cfg/server.cfg`,
			]),
		).toEqual([]);
	});
});

describe("knowing when a start builds a brand new map", () => {
	it("keeps the map when the seed and size match the save", () => {
		expect(replacesMap(saved, settingsWith(3000, 4242))).toBe(false);
	});

	it("replaces the map when the seed changed", () => {
		expect(replacesMap(saved, settingsWith(3000, 99))).toBe(true);
	});

	it("replaces the map when the size changed", () => {
		expect(replacesMap(saved, settingsWith(4000, 4242))).toBe(true);
	});

	it("keeps quiet on a first start, when there is no map to replace", () => {
		expect(replacesMap([], settingsWith(4000, 99))).toBe(false);
	});

	it("keeps the map when an older map sits beside the current one", () => {
		expect(
			replacesMap(
				[
					...saved,
					`${IDENTITY}/proceduralmap.4000.99.221.sav`,
				],
				settingsWith(4000, 99),
			),
		).toBe(false);
	});
});

describe("telling the owner a new map is being generated", () => {
	it("reports the new seed and size when they no longer match the saved map", async () => {
		const { context, reported } = identityWith(saved);

		await reportNewMap(context, settingsWith(4500, 777));

		expect(reported).toEqual([
			{
				name: BridgeEventName.WorldCreated,
				text: {
					ar: "تغيّر السيد أو حجم الماب، ويُنشئ السيرفر ماب جديدة (السيد 777، الحجم 4500)",
					en: "The seed or map size changed, the server is generating a new map (seed 777, size 4500)",
				},
				details: {
					seed: 777,
					size: 4500,
				},
			},
		]);
	});

	it("reports nothing when the start keeps the saved map", async () => {
		const { context, reported } = identityWith(saved);

		await reportNewMap(context, settingsWith(3000, 4242));

		expect(reported).toEqual([]);
	});

	it("warns and lets the start go on when the identity folder cannot be listed", async () => {
		const { context, reported, warned } = identityWith(new Error("the listing hit its result limit"));

		await reportNewMap(context, settingsWith(4500, 777));

		expect(reported).toEqual([]);
		expect(warned).toHaveLength(1);
	});
});
