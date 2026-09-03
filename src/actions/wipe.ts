import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { quitServer, requestWipe, sendAnnounce, WipeKind } from "../shared";

const WARNING = "The server is wiping now and will be back in a moment.";

const wipe = async (context: Bridge.Context, kind: WipeKind) => {
	await requestWipe(context, kind);

	try {
		await sendAnnounce(context, WARNING);
	} catch {
		context.log.warn("the wipe warning did not reach the players, wiping anyway");
	}

	context.log("wipe requested, restarting the server to build a new map", {
		kind,
	});

	await quitServer(context);
};

export const wipes: Bridge.Actions = {
	kind: BridgeKind.Actions,
	requiresRunning: true,
	actions: {
		async map(context) {
			await wipe(context, WipeKind.Map);
		},

		async full(context) {
			await wipe(context, WipeKind.Full);
		},
	},
};
