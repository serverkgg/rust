import type { Bridge } from "@serverkgg/bridge";
import { rconCommand } from "./webRcon";

export const PLAYER_LIST_COMMAND = "playerlist";

export const SERVER_INFO_COMMAND = "serverinfo";

export type RustRosterEntry = Bridge.Row & {
	name: string;
	ping: number | null;
	connected: number | null;
};

export interface RustSample {
	online: number | null;
	max: number | null;
}

const identifier = (entry: Record<string, unknown>) => {
	const raw = entry.SteamID ?? entry.SteamId ?? entry.steamId;

	if (typeof raw === "string") {
		return raw;
	}

	return typeof raw === "number" && Number.isFinite(raw) ? String(raw) : "";
};

const finiteOr = (raw: unknown): number | null => {
	return typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : null;
};

export const parsePlayerList = (raw: string): RustRosterEntry[] => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(raw);
	} catch {
		return [];
	}

	if (!Array.isArray(parsed)) {
		return [];
	}

	return parsed.flatMap((item) => {
		if (typeof item !== "object" || item === null) {
			return [];
		}

		const entry = item as Record<string, unknown>;
		const id = identifier(entry);

		if (id.length === 0) {
			return [];
		}

		return [
			{
				id,
				name: typeof entry.DisplayName === "string" && entry.DisplayName.length > 0 ? entry.DisplayName : id,
				ping: finiteOr(entry.Ping),
				connected: finiteOr(entry.ConnectedSeconds),
			},
		];
	});
};

export const parseServerInfo = (raw: string): RustSample => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(raw);
	} catch {
		return {
			online: null,
			max: null,
		};
	}

	if (typeof parsed !== "object" || parsed === null) {
		return {
			online: null,
			max: null,
		};
	}

	const info = parsed as Record<string, unknown>;

	return {
		online: finiteOr(info.Players),
		max: finiteOr(info.MaxPlayers),
	};
};

export const playerRoster = async (context: Bridge.Context) => {
	return parsePlayerList(await rconCommand(context, PLAYER_LIST_COMMAND));
};

export const serverSample = async (context: Bridge.Context) => {
	return parseServerInfo(await rconCommand(context, SERVER_INFO_COMMAND));
};
