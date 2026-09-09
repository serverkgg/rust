import type { Bridge } from "@serverkgg/bridge";
import { createRosterSync } from "@serverkgg/bridge/presence";
import { createSteamAvatars } from "@serverkgg/bridge/steam";
import { rconCommand } from "./webRcon";

export const PLAYER_LIST_COMMAND = "playerlist";

export const SERVER_INFO_COMMAND = "serverinfo";

export const STEAM_PLATFORM = "Steam";

export type RustRosterEntry = Bridge.Row & {
	name: string;
	level: number | null;
	ping: number | null;
	connected: number | null;
	avatarHash: string | null;
};

export interface RustPresence {
	id: string;
	name: string;
	level?: number | null;
	ping?: number | null;
	avatarHash?: string | null;
}

export interface RustSample {
	online: number | null;
	max: number | null;
}

export interface RustHealth {
	hostname: string | null;
	map: string | null;
	online: number | null;
	max: number | null;
	queued: number | null;
	joining: number | null;
	entities: number | null;
	fps: number | null;
	memoryMb: number | null;
	uptimeSeconds: number | null;
	version: string | null;
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

const textOr = (raw: unknown): string | null => {
	if (typeof raw === "string") {
		return raw.length === 0 ? null : raw;
	}

	return typeof raw === "number" && Number.isFinite(raw) ? String(raw) : null;
};

const objectOr = (raw: string): Record<string, unknown> | null => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}

	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return null;
	}

	return parsed as Record<string, unknown>;
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
				level: finiteOr(entry.CurrentLevel),
				ping: finiteOr(entry.Ping),
				connected: finiteOr(entry.ConnectedSeconds),
				avatarHash: null,
			},
		];
	});
};

export const parseServerHealth = (raw: string): RustHealth | null => {
	const info = objectOr(raw);

	if (info === null) {
		return null;
	}

	return {
		hostname: textOr(info.Hostname),
		map: textOr(info.Map),
		online: finiteOr(info.Players),
		max: finiteOr(info.MaxPlayers),
		queued: finiteOr(info.Queued),
		joining: finiteOr(info.Joining),
		entities: finiteOr(info.EntityCount),
		fps: finiteOr(info.Framerate),
		memoryMb: finiteOr(info.Memory),
		uptimeSeconds: finiteOr(info.Uptime),
		version: textOr(info.Version) ?? textOr(info.Protocol),
	};
};

export const parseServerInfo = (raw: string): RustSample => {
	const health = parseServerHealth(raw);

	return {
		online: health?.online ?? null,
		max: health?.max ?? null,
	};
};

export const avatars = createSteamAvatars({
	steamIdOf: (id) => id,
});

export const playerRoster = async (context: Bridge.Context): Promise<RustRosterEntry[]> => {
	const players = parsePlayerList(await rconCommand(context, PLAYER_LIST_COMMAND));
	const hashes = await avatars.resolve(
		context,
		players.map((player) => player.id),
	);

	return players.map((player) => {
		const hash = hashes.get(player.id);

		return hash === undefined
			? player
			: {
					...player,
					avatarHash: hash,
				};
	});
};

export const serverSample = async (context: Bridge.Context) => {
	return parseServerInfo(await rconCommand(context, SERVER_INFO_COMMAND));
};

export const serverHealth = async (context: Bridge.Context) => {
	return parseServerHealth(await rconCommand(context, SERVER_INFO_COMMAND));
};

export const nameOf = (row: Bridge.Row) => {
	return typeof row.name === "string" && row.name.length > 0 ? row.name : row.id;
};

export const levelOf = (row: Bridge.Row) => {
	return typeof row.level === "number" ? row.level : null;
};

export const pingOf = (row: Bridge.Row) => {
	return typeof row.ping === "number" ? row.ping : null;
};

export const avatarHashOf = (row: Bridge.Row) => {
	return typeof row.avatarHash === "string" && row.avatarHash.length > 0 ? row.avatarHash : null;
};

export const presenceOf = (player: RustPresence): Bridge.Values => {
	return {
		player: player.name,
		steamId: player.id,
		platform: STEAM_PLATFORM,
		...(player.level === null || player.level === undefined
			? {}
			: {
					level: String(player.level),
				}),
		...(player.ping === null || player.ping === undefined
			? {}
			: {
					ping: String(player.ping),
				}),
		...(player.avatarHash === null || player.avatarHash === undefined
			? {}
			: {
					avatarHash: player.avatarHash,
				}),
	};
};

export const roster = createRosterSync<RustRosterEntry>({
	id: (player) => player.id,
	presenceOf,
});
