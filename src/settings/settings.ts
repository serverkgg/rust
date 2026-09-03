import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { convarValues, fieldValues, mergeSettings, readSettings } from "../shared";

export const settings: Bridge.Settings = {
	kind: BridgeKind.Settings,
	async read(context) {
		return fieldValues(await readSettings(context));
	},
	async write(context, values) {
		await mergeSettings(context, convarValues(values));
	},
};
