import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { messageArgument, saveWorld, sendAnnounce } from "../shared";

export const live: Bridge.Actions = {
	kind: BridgeKind.Actions,
	requiresRunning: true,
	actions: {
		async announce(context, args) {
			await sendAnnounce(context, messageArgument(args));
		},

		async save(context) {
			await saveWorld(context);
		},
	},
};
