import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { playerRoster, type RustRosterEntry, roster, serverSample } from "../shared";

const REFRESH_SECONDS = 20;

const UNKNOWN: Bridge.Sample = {
	online: null,
	max: null,
};

const syncRoster = async (context: Bridge.Context) => {
	let players: RustRosterEntry[];

	try {
		players = await playerRoster(context);
	} catch {
		return;
	}

	roster.sync(context, players);
};

export const query: Bridge.Query = {
	kind: BridgeKind.Query,
	refreshSeconds: REFRESH_SECONDS,
	async sample(context) {
		await syncRoster(context);

		try {
			return await serverSample(context);
		} catch {
			return UNKNOWN;
		}
	},
};
