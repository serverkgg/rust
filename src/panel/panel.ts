import {
	type Bridge,
	BridgeConfirm,
	BridgeControl,
	BridgeFormTarget,
	BridgeIcon,
	BridgeLayout,
} from "@serverkgg/bridge";
import { rconAccessSections } from "@serverkgg/bridge/rcon";
import {
	ANNOUNCE_MESSAGE_LENGTH,
	DESCRIPTION_FIELD,
	DESCRIPTION_LENGTH,
	HOSTNAME_FIELD,
	HOSTNAME_LENGTH,
	MAX_PLAYERS_FIELD,
	MAX_PLAYERS_MAX,
	MAX_PLAYERS_MIN,
	PVE_FIELD,
	RCON_PROTOCOL,
	SAVE_INTERVAL_FIELD,
	SAVE_INTERVAL_MAX,
	SAVE_INTERVAL_MIN,
	SEED_FIELD,
	SEED_MAX,
	SEED_MIN,
	WORLD_SIZE_FIELD,
	WORLD_SIZE_MAX,
	WORLD_SIZE_MIN,
} from "../shared";

const NEW_MAP_WARNING: Bridge.Text = {
	ar: "تغييرها يبني ماب جديدة كليًا بعد إعادة التشغيل — كل شيء مبني ينهدم. خذ نسخة احتياطية أول.",
	en: "Changing this builds a brand new map on the next restart — everything built is gone. Take a backup first.",
};

const settingsTab: Bridge.Tab = {
	id: "settings",
	title: {
		ar: "الإعدادات",
		en: "Settings",
	},
	icon: BridgeIcon.Settings,
	sections: [
		{
			layout: BridgeLayout.Form,
			id: "world",
			target: BridgeFormTarget.Settings,
			module: "settings",
			restartHint: true,
			fields: [
				{
					key: HOSTNAME_FIELD,
					control: BridgeControl.Text,
					label: {
						ar: "اسم السيرفر",
						en: "Server name",
					},
					help: {
						ar: "الاسم اللي يظهر للاعبين في قائمة سيرفرات رست.",
						en: "The name players see in the Rust server browser.",
					},
					maxLength: HOSTNAME_LENGTH,
				},
				{
					key: DESCRIPTION_FIELD,
					control: BridgeControl.Text,
					label: {
						ar: "وصف السيرفر",
						en: "Server description",
					},
					help: {
						ar: "يظهر للاعب لما يفتح سيرفرك من القائمة. اكتب فيه قوانينك ووقت الوايب.",
						en: "Shown when a player opens your server in the browser. Put your rules and your wipe day in it.",
					},
					maxLength: DESCRIPTION_LENGTH,
				},
				{
					key: MAX_PLAYERS_FIELD,
					control: BridgeControl.Number,
					label: {
						ar: "أقصى عدد لاعبين",
						en: "Max players",
					},
					help: {
						ar: "كل لاعب ياكل رام. احسب 6 لاعبين لكل 1GB تقريبًا.",
						en: "Every player costs RAM. Reckon on roughly 6 players per 1GB.",
					},
					min: MAX_PLAYERS_MIN,
					max: MAX_PLAYERS_MAX,
				},
				{
					key: WORLD_SIZE_FIELD,
					control: BridgeControl.Number,
					label: {
						ar: "حجم الماب",
						en: "World size",
					},
					help: {
						ar: "بالمتر. 3000 هو الحجم المعتاد، وكل ما كبّرت زاد استهلاك الرام ووقت التحميل.",
						en: "In metres. 3000 is the usual size — bigger means more RAM and a longer load.",
					},
					warning: NEW_MAP_WARNING,
					min: WORLD_SIZE_MIN,
					max: WORLD_SIZE_MAX,
					step: 500,
				},
				{
					key: SEED_FIELD,
					control: BridgeControl.Number,
					label: {
						ar: "سيد الماب",
						en: "Map seed",
					},
					help: {
						ar: "الرقم اللي تتولد منه الماب. نفس السيد مع نفس الحجم يعطيك نفس الماب دايم.",
						en: "The number the map is generated from. The same seed with the same size always gives the same map.",
					},
					warning: NEW_MAP_WARNING,
					min: SEED_MIN,
					max: SEED_MAX,
				},
				{
					key: PVE_FIELD,
					control: BridgeControl.Boolean,
					label: {
						ar: "وضع PvE",
						en: "PvE mode",
					},
					help: {
						ar: "لما تفعّله، ما يقدر اللاعبين يأذون بعض. رست الأصلي PvP، فخله مطفّي إذا تبي التجربة الطبيعية.",
						en: "When on, players cannot hurt each other. Rust is a PvP game — leave it off for the normal experience.",
					},
				},
				{
					key: SAVE_INTERVAL_FIELD,
					control: BridgeControl.Number,
					label: {
						ar: "كل كم يحفظ (بالثواني)",
						en: "Save interval (seconds)",
					},
					help: {
						ar: "كل ما قلّلته قلّ اللي يضيع لو تعطّل السيرفر، وزاد اللاق لحظة الحفظ.",
						en: "Lower loses less when the server goes down, and costs a hitch every time it saves.",
					},
					min: SAVE_INTERVAL_MIN,
					max: SAVE_INTERVAL_MAX,
					step: 30,
				},
			],
		},
	],
};

const playersTab: Bridge.Tab = {
	id: "players",
	title: {
		ar: "اللاعبين",
		en: "Players",
	},
	icon: BridgeIcon.Users,
	sections: [
		{
			layout: BridgeLayout.Table,
			id: "online",
			module: "players",
			columns: [
				{
					key: "name",
					label: {
						ar: "اللاعب",
						en: "Player",
					},
				},
				{
					key: "ping",
					label: {
						ar: "البنق",
						en: "Ping",
					},
				},
			],
			actions: [
				{
					id: "kick",
					label: {
						ar: "طرد",
						en: "Kick",
					},
					confirm: BridgeConfirm.Normal,
				},
				{
					id: "ban",
					label: {
						ar: "حظر",
						en: "Ban",
					},
					confirm: BridgeConfirm.Strong,
				},
			],
			empty: {
				ar: "ما فيه أحد داخل الحين.",
				en: "Nobody is online right now.",
			},
		},
	],
};

const controlsTab: Bridge.Tab = {
	id: "controls",
	title: {
		ar: "التحكم",
		en: "Controls",
	},
	icon: BridgeIcon.Command,
	sections: [
		{
			layout: BridgeLayout.Actions,
			id: "live",
			title: {
				ar: "أوامر سريعة",
				en: "Quick actions",
			},
			help: {
				ar: "تشتغل على طول على سيرفرك الشغّال.",
				en: "These run on your server right away.",
			},
			module: "live",
			actions: [
				{
					id: "announce",
					label: {
						ar: "رسالة للاعبين",
						en: "Announce",
					},
					fields: [
						{
							key: "message",
							control: BridgeControl.Text,
							label: {
								ar: "الرسالة",
								en: "Message",
							},
							help: {
								ar: "توصل لكل اللي داخلين الحين في الشات.",
								en: "Reaches everyone on the server right now, in chat.",
							},
							maxLength: ANNOUNCE_MESSAGE_LENGTH,
						},
					],
				},
				{
					id: "save",
					label: {
						ar: "احفظ العالم",
						en: "Save the world",
					},
				},
			],
		},
		{
			layout: BridgeLayout.Actions,
			id: "wipe",
			title: {
				ar: "الوايب",
				en: "Wipe",
			},
			help: {
				ar: "الوايب يوقف سيرفرك، يمسح، ويرجّعه بماب جديدة. ما فيه رجعة بعده إلا من نسخة احتياطية.",
				en: "A wipe stops your server, clears it, and brings it back on a new map. Only a backup undoes it.",
			},
			module: "wipes",
			actions: [
				{
					id: "map",
					label: {
						ar: "وايب الماب",
						en: "Map wipe",
					},
					confirm: BridgeConfirm.Strong,
					confirmText: {
						ar: "بنمسح الماب وكل شيء مبني عليها ونبني ماب جديدة. البلوبرنتات اللي فتحها اللاعبين تبقى معهم. سيرفرك بيوقف ويرجع لحاله.",
						en: "The map and everything built on it are deleted and a new map is generated. The blueprints players unlocked stay with them. Your server stops and comes back on its own.",
					},
				},
				{
					id: "full",
					label: {
						ar: "وايب كامل",
						en: "Full wipe",
					},
					confirm: BridgeConfirm.Strong,
					confirmText: {
						ar: "بنمسح الماب وكل شيء مبني عليها والبلوبرنتات وبيانات اللاعبين كلها. الكل يبدأ من الصفر. سيرفرك بيوقف ويرجع لحاله.",
						en: "The map, everything built on it, the blueprints and all the player data are deleted. Everyone starts from zero. Your server stops and comes back on its own.",
					},
				},
			],
		},
		...rconAccessSections({
			protocol: RCON_PROTOCOL,
		}),
	],
};

export const panel: Bridge.Panel = {
	tabs: [
		settingsTab,
		playersTab,
		controlsTab,
	],
};
