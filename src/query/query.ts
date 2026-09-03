import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { playerRoster, type RustRosterEntry, serverSample } from "../shared";

const REFRESH_SECONDS = 20;

const online = new Map<string, RustRosterEntry>();

const presenceOf = (player: RustRosterEntry): Bridge.Values => {
	return {
		player: player.name,
		steamId: player.id,
		...(player.ping === null
			? {}
			: {
					ping: String(player.ping),
				}),
	};
};

const syncSessions = async (context: Bridge.Context) => {
	let current: Map<string, RustRosterEntry>;

	try {
		current = new Map(
			(await playerRoster(context)).map((player) => [
				player.id,
				player,
			]),
		);
	} catch {
		return;
	}

	for (const [id, player] of current) {
		if (!online.has(id)) {
			context.emit("PlayerJoined", presenceOf(player));
		}
	}

	for (const [id, player] of online) {
		if (!current.has(id)) {
			context.emit("PlayerLeft", presenceOf(player));
		}
	}

	online.clear();

	for (const [id, player] of current) {
		online.set(id, player);
	}
};

export const query: Bridge.Query = {
	kind: BridgeKind.Query,
	refreshSeconds: REFRESH_SECONDS,
	async sample(context) {
		await syncSessions(context);

		try {
			const sample = await serverSample(context);

			if (sample.online !== null) {
				return sample;
			}
		} catch {
			context.log.warn("rcon did not answer the player count, falling back to the query port");
		}

		try {
			const info = await context.probe.a2s(context.port("query"));

			return {
				online: info.players.online,
				max: info.players.max,
			};
		} catch {
			return {
				online: null,
				max: null,
			};
		}
	},
};
