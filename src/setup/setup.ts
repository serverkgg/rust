import { type Bridge, BridgeKind, BridgeSetupStepKind } from "@serverkgg/bridge";
import { GuideOpenTab } from "@serverkgg/bridge/guides";
import { DESCRIPTION_FIELD, HOSTNAME_FIELD, MAX_PLAYERS_FIELD, SEED_FIELD, WORLD_SIZE_FIELD } from "../shared";

export const SETTINGS_TAB = "settings";

export const WORLD_SECTION = "world";

export const WORLD_STEP = "world";

export const NAME_STEP = "name";

export const INVITE_STEP = "invite";

export const setup: Bridge.Setup = {
	kind: BridgeKind.Setup,
	steps: [
		{
			kind: BridgeSetupStepKind.Form,
			id: WORLD_STEP,
			required: false,
			tab: SETTINGS_TAB,
			section: WORLD_SECTION,
			fields: [
				WORLD_SIZE_FIELD,
				SEED_FIELD,
			],
			title: {
				ar: "اختر مابك",
				en: "Pick your map",
			},
			help: {
				ar: "حجم الماب والسيد. حدّدهما الآن، لأن تغييرهما لاحقًا يُنشئ مابًا جديدًا ويضيع كل ما بُني.",
				en: "The map size and seed. Decide now, because changing them later builds a new map and everything built is gone.",
			},
		},
		{
			kind: BridgeSetupStepKind.Form,
			id: NAME_STEP,
			required: false,
			tab: SETTINGS_TAB,
			section: WORLD_SECTION,
			fields: [
				HOSTNAME_FIELD,
				DESCRIPTION_FIELD,
				MAX_PLAYERS_FIELD,
			],
			title: {
				ar: "سمِّ سيرفرك",
				en: "Name your server",
			},
			help: {
				ar: "الاسم والوصف اللذان يظهران في قائمة سيرفرات رست، وعدد اللاعبين.",
				en: "The name and description in the Rust server browser, and the player slots.",
			},
		},
		{
			kind: BridgeSetupStepKind.Open,
			id: INVITE_STEP,
			required: false,
			target: {
				tab: GuideOpenTab.Access,
			},
			title: {
				ar: "ادعُ أصحابك",
				en: "Invite your friends",
			},
			help: {
				ar: "انسخ عنوان سيرفرك وأرسله لأصحابك، ليكتبوا client.connect ثم العنوان في كونسول F1.",
				en: "Copy your server address and send it to your friends. They type client.connect and the address in the F1 console.",
			},
		},
	],
};
