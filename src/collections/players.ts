import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { banCommand, kickCommand, playerRoster, rconCommand } from "../shared";

const REFRESH_SECONDS = 15;

export const players: Bridge.Collection = {
	kind: BridgeKind.Collection,
	requiresRunning: true,
	refreshSeconds: REFRESH_SECONDS,
	async list(context) {
		return await playerRoster(context);
	},
	actions: {
		async kick(context, row) {
			await rconCommand(context, kickCommand(row.id));
		},
		async ban(context, row) {
			await rconCommand(context, banCommand(row.id, String(row.name ?? row.id)));
		},
	},
};
