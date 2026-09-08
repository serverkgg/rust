import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";

export const events: Bridge.Events = {
	kind: BridgeKind.Events,
	patterns: [],
	emits: [
		BridgeEventName.ServerStarted,
		BridgeEventName.ServerStopping,
		BridgeEventName.ServerUpdated,
		BridgeEventName.PlayerJoined,
		BridgeEventName.PlayerLeft,
		BridgeEventName.PlayerKicked,
		BridgeEventName.PlayerBanned,
		BridgeEventName.WorldSaved,
	],
};
