import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { sendAnnounce } from "../shared";

export const announce: Bridge.Announce = {
	kind: BridgeKind.Announce,
	async announce(context, message) {
		await sendAnnounce(context, message);
	},
};
