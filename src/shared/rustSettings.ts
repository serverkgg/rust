import type { Bridge } from "@serverkgg/bridge";
import { SERVER_CFG } from "./rustApp";
import { mergeServerCfg, parseServerCfg } from "./serverCfg";

export const HOSTNAME_KEY = "server.hostname";

export const DESCRIPTION_KEY = "server.description";

export const MAX_PLAYERS_KEY = "server.maxplayers";

export const WORLD_SIZE_KEY = "server.worldsize";

export const SEED_KEY = "server.seed";

export const SAVE_INTERVAL_KEY = "server.saveinterval";

export const PVE_KEY = "server.pve";

export const HOSTNAME_LENGTH = 96;

export const DESCRIPTION_LENGTH = 512;

export const MAX_PLAYERS_MIN = 1;

export const MAX_PLAYERS_MAX = 500;

export const WORLD_SIZE_MIN = 1000;

export const WORLD_SIZE_MAX = 6000;

export const SAVE_INTERVAL_MIN = 60;

export const SAVE_INTERVAL_MAX = 3600;

export const SEED_MIN = 1;

export const SEED_MAX = 2_147_483_647;

export const HOSTNAME_FIELD = "hostname";

export const DESCRIPTION_FIELD = "description";

export const MAX_PLAYERS_FIELD = "maxplayers";

export const WORLD_SIZE_FIELD = "worldsize";

export const SEED_FIELD = "seed";

export const SAVE_INTERVAL_FIELD = "saveinterval";

export const PVE_FIELD = "pve";

export const SETTING_FIELDS: Record<string, string> = {
	[HOSTNAME_FIELD]: HOSTNAME_KEY,
	[DESCRIPTION_FIELD]: DESCRIPTION_KEY,
	[MAX_PLAYERS_FIELD]: MAX_PLAYERS_KEY,
	[WORLD_SIZE_FIELD]: WORLD_SIZE_KEY,
	[SEED_FIELD]: SEED_KEY,
	[SAVE_INTERVAL_FIELD]: SAVE_INTERVAL_KEY,
	[PVE_FIELD]: PVE_KEY,
};

export const fieldValues = (settings: Bridge.Values): Bridge.Values => {
	const values: Bridge.Values = {};

	for (const [field, key] of Object.entries(SETTING_FIELDS)) {
		values[field] = settings[key] ?? null;
	}

	return values;
};

export const convarValues = (values: Bridge.Values): Bridge.Values => {
	const settings: Bridge.Values = {};

	for (const [field, value] of Object.entries(values)) {
		const key = SETTING_FIELDS[field];

		if (key !== undefined) {
			settings[key] = value;
		}
	}

	return settings;
};

export const SETTING_DEFAULTS: Bridge.Values = {
	[HOSTNAME_KEY]: "Serverk Rust",
	[DESCRIPTION_KEY]: "Powered by serverk.gg",
	[MAX_PLAYERS_KEY]: 50,
	[WORLD_SIZE_KEY]: 3000,
	[SAVE_INTERVAL_KEY]: 300,
	[PVE_KEY]: false,
};

export const generateSeed = () => {
	const bytes = new Uint32Array(1);

	crypto.getRandomValues(bytes);

	return ((bytes[0] ?? 0) % SEED_MAX) + SEED_MIN;
};

export const clamp = (value: number, min: number, max: number) => {
	return Math.min(Math.max(Math.round(value), min), max);
};

export const numberOf = (value: Bridge.Value, fallback: number, min: number, max: number) => {
	if (value === null || typeof value === "boolean" || String(value).trim().length === 0) {
		return fallback;
	}

	const parsed = Number(value);

	return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
};

export const textOf = (value: Bridge.Value, fallback: string, length: number) => {
	if (value === null || typeof value === "boolean") {
		return fallback;
	}

	return String(value).slice(0, length);
};

export const booleanOf = (value: Bridge.Value, fallback: boolean) => {
	if (typeof value === "boolean") {
		return value;
	}

	if (value === "true" || value === "false") {
		return value === "true";
	}

	return fallback;
};

export interface RustSettings {
	hostname: string;
	description: string;
	maxPlayers: number;
	worldSize: number;
	seed: number;
	saveInterval: number;
	pve: boolean;
}

export const settingsOf = (values: Bridge.Values, seed: number): RustSettings => {
	return {
		hostname: textOf(values[HOSTNAME_KEY] ?? null, String(SETTING_DEFAULTS[HOSTNAME_KEY]), HOSTNAME_LENGTH),
		description: textOf(values[DESCRIPTION_KEY] ?? null, "", DESCRIPTION_LENGTH),
		maxPlayers: numberOf(values[MAX_PLAYERS_KEY] ?? null, 50, MAX_PLAYERS_MIN, MAX_PLAYERS_MAX),
		worldSize: numberOf(values[WORLD_SIZE_KEY] ?? null, 3000, WORLD_SIZE_MIN, WORLD_SIZE_MAX),
		seed: numberOf(values[SEED_KEY] ?? null, seed, SEED_MIN, SEED_MAX),
		saveInterval: numberOf(values[SAVE_INTERVAL_KEY] ?? null, 300, SAVE_INTERVAL_MIN, SAVE_INTERVAL_MAX),
		pve: booleanOf(values[PVE_KEY] ?? null, false),
	};
};

export const readSettings = async (context: Bridge.Context): Promise<Bridge.Values> => {
	if (!(await context.files.exists(SERVER_CFG))) {
		return {};
	}

	return parseServerCfg(await context.files.read(SERVER_CFG));
};

export const mergeSettings = async (context: Bridge.Context, values: Bridge.Values) => {
	const raw = (await context.files.exists(SERVER_CFG)) ? await context.files.read(SERVER_CFG) : "";

	await context.files.write(SERVER_CFG, mergeServerCfg(raw, values));
};
