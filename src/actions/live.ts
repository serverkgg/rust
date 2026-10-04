import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { activityExcerpt, BridgeEventName } from "@serverkgg/bridge/protocol";
import { messageArgument, saveWorld, sendAnnounce } from "../shared";

export const live: Bridge.Actions = {
	kind: BridgeKind.Actions,
	requiresRunning: true,
	actions: {
		async announce(context, args) {
			const message = messageArgument(args);

			await sendAnnounce(context, message);

			context.activity.report({
				name: BridgeEventName.BroadcastSent,
				text: {
					ar: `تم إرسال رسالة إلى اللاعبين: «${activityExcerpt(message)}»`,
					en: `Sent a message to players: "${activityExcerpt(message)}"`,
				},
			});
		},

		async save(context) {
			await saveWorld(context);

			context.activity.report({
				name: BridgeEventName.GameplayChanged,
				text: {
					ar: "تم حفظ الماب",
					en: "Saved the map",
				},
				details: {
					what: "save",
				},
			});
		},
	},
};
