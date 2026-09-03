import { type Bridge, BridgeKind } from "@serverkgg/bridge";

export const events: Bridge.Events = {
	kind: BridgeKind.Events,
	patterns: [],
	emits: [
		"ServerStarted",
		"ServerStopping",
		"PlayerJoined",
		"PlayerLeft",
		"WorldSaved",
	],
};
