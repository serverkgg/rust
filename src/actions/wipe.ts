import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { applyWipe, listIdentityFiles, WipeKind, wipeTargets } from "../shared";

export const NO_MAP: Bridge.Text = {
	ar: "لا يوجد ماب على سيرفرك بعد. يُنشئ السيرفر الماب عند تشغيله.",
	en: "There's no map on your server yet. The server builds one when it starts.",
};

export const NO_MAP_OR_PLAYERS: Bridge.Text = {
	ar: "لا يوجد ماب ولا بيانات لاعبين على سيرفرك بعد.",
	en: "There's no map or player data on your server yet.",
};

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

	async unavailable(context): Promise<Bridge.Unavailable> {
		const files = await listIdentityFiles(context);
		const unavailable: Bridge.Unavailable = {};

		if (wipeTargets(files, WipeKind.Map).length === 0) {
			unavailable[WipeKind.Map] = NO_MAP;
		}

		if (wipeTargets(files, WipeKind.Full).length === 0) {
			unavailable[WipeKind.Full] = NO_MAP_OR_PLAYERS;
		}

		return unavailable;
	},
};
