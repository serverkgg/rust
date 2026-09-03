import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { playerRoster, type RustRosterEntry, serverSample } from "../shared";

const REFRESH_SECONDS = 20;

const UNKNOWN: Bridge.Sample = {
	online: null,
	max: null,
};

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
			return await serverSample(context);
		} catch {
			return UNKNOWN;
		}
	},
};
