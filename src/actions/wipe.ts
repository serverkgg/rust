import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { applyWipe, WipeKind } from "../shared";

export const wipes: Bridge.Actions = {
	kind: BridgeKind.Actions,
	protectedActions: [
		WipeKind.Map,
		WipeKind.Full,
	],
	actions: {
		async [WipeKind.Map](context) {
			await applyWipe(context, WipeKind.Map);
		},

		async [WipeKind.Full](context) {
			await applyWipe(context, WipeKind.Full);
		},
	},
};
