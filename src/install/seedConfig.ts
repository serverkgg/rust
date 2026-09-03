import type { Bridge } from "@serverkgg/bridge";
import { CONFIG_DIRECTORY, generateSeed, mergeSettings, readSettings, SEED_KEY, SETTING_DEFAULTS } from "../shared";

export const seedPatch = (current: Bridge.Values, seed: number): Bridge.Values => {
	const patch: Bridge.Values = {};

	for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
		if (!(key in current)) {
			patch[key] = value;
		}
	}

	if (!(SEED_KEY in current)) {
		patch[SEED_KEY] = seed;
	}

	return patch;
};

export const seedConfig = async (context: Bridge.Context) => {
	await context.files.ensure(CONFIG_DIRECTORY);

	const patch = seedPatch(await readSettings(context), generateSeed());

	if (Object.keys(patch).length === 0) {
		return;
	}

	context.log("writing the settings your server starts with", {
		keys: Object.keys(patch).length,
	});

	await mergeSettings(context, patch);
};
