import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { saveWorld } from "../shared";

const SETTLE_SECONDS = 10;

export const backup: Bridge.Backup = {
	kind: BridgeKind.Backup,
	settleSeconds: SETTLE_SECONDS,
	async quiesce(context) {
		await saveWorld(context);
	},
};
