import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { mergeSettings, readSettings } from "../shared";

export const settings: Bridge.Settings = {
	kind: BridgeKind.Settings,
	async read(context) {
		return await readSettings(context);
	},
	async write(context, values) {
		await mergeSettings(context, values);
	},
};
