import { describe, expect, test } from "bun:test";
import { PVE_KEY, SEED_KEY, SETTING_DEFAULTS } from "../shared";
import { seedPatch } from "./seedConfig";

const SEED = 4242;

describe("seeding the settings a brand new server starts with", () => {
	test("writes every default plus a seed when the file is empty", () => {
		expect(seedPatch({}, SEED)).toEqual({
			...SETTING_DEFAULTS,
			[SEED_KEY]: SEED,
		});
	});

	test("writes nothing at all on a server that is already set up", () => {
		expect(
			seedPatch(
				{
					...SETTING_DEFAULTS,
					[SEED_KEY]: 1,
				},
				SEED,
			),
		).toEqual({});
	});

	test("never overwrites a value a player chose, so reinstalling keeps their map", () => {
		expect(
			seedPatch(
				{
					[SEED_KEY]: 999,
				},
				SEED,
			)[SEED_KEY],
		).toBeUndefined();
	});

	test("keeps a setting a player deliberately turned off", () => {
		expect(
			seedPatch(
				{
					[PVE_KEY]: true,
				},
				SEED,
			)[PVE_KEY],
		).toBeUndefined();
	});

	test("fills only the settings that are missing", () => {
		expect(
			Object.keys(
				seedPatch(
					{
						...SETTING_DEFAULTS,
					},
					SEED,
				),
			),
		).toEqual([
			SEED_KEY,
		]);
	});

	test("gives every server its own map by seeding a seed", () => {
		expect(seedPatch({}, SEED)[SEED_KEY]).toBe(SEED);
	});
});
