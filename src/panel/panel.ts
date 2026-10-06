import {
	type Bridge,
	BridgeConfirm,
	BridgeControl,
	BridgeFormTarget,
	BridgeIcon,
	BridgeLayout,
	BridgePlace,
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
	ar: "تغييرها يُنشئ ماب جديدة كليًا بعد الريستارت، ويُهدم كل ما بُني فيها. خذ نسخة احتياطية أولًا.",
	en: "Changing this builds a brand new map on the next restart, and everything built is gone. Take a backup first.",
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
			help: {
				ar: "هذه إعدادات سيرفرك الأساسية، ويُطبَّق أي تعديل فيها بعد الريستارت.",
				en: "These are your server's core settings, and every change needs a restart to take effect.",
			},
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
						ar: "الاسم الذي يظهر للاعبين في قائمة سيرفرات رست.",
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
						ar: "يظهر للاعب عند فتح سيرفرك من القائمة. اكتب فيه قوانينك وموعد الوايب.",
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
						ar: "كل لاعب يستهلك من الرام. احسب 6 لاعبين لكل 1GB تقريبًا.",
						en: "Every player costs RAM. Plan on roughly 6 players per 1GB.",
					},
					min: MAX_PLAYERS_MIN,
					max: MAX_PLAYERS_MAX,
				},
				{
					key: WORLD_SIZE_FIELD,
					control: BridgeControl.Number,
					label: {
						ar: "حجم الماب",
						en: "Map size",
					},
					help: {
						ar: "بالمتر. 3000 هو الحجم المعتاد، وكلما زاد الحجم زاد استهلاك الرام ووقت التحميل.",
						en: "In meters. 3000 is the usual size, and bigger means more RAM and a longer load.",
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
						ar: "الرقم الذي تُنشأ منه الماب. السيد نفسه مع الحجم نفسه يعطي الماب نفسها دائمًا.",
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
						ar: "عند تفعيله، لا يستطيع اللاعبون إيذاء بعضهم. رست في الأصل لعبة PvP، فأبقِه موقوفًا إذا أردت التجربة الطبيعية.",
						en: "When on, players can't hurt each other. Rust is a PvP game, so leave it off for the normal experience.",
					},
				},
				{
					key: SAVE_INTERVAL_FIELD,
					control: BridgeControl.Number,
					label: {
						ar: "فترة الحفظ (بالثواني)",
						en: "Save interval (seconds)",
					},
					help: {
						ar: "كلما قلّلته قلّ ما يضيع إذا تعطّل السيرفر، وزاد اللاق لحظة الحفظ.",
						en: "Lower loses less if the server crashes, and causes a short hitch every time it saves.",
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
		ar: "اللاعبون",
		en: "Players",
	},
	icon: BridgeIcon.Users,
	sections: [
		{
			layout: BridgeLayout.Table,
			id: "online",
			help: {
				ar: "كل اللاعبين الموجودين في سيرفرك الآن، ومن السطر نفسه تطرد اللاعب أو تحظره.",
				en: "Everyone on your server right now. Kick or ban anyone from their row.",
			},
			place: BridgePlace.Players,
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
					key: "level",
					label: {
						ar: "المستوى",
						en: "Level",
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
						ar: "اطرد",
						en: "Kick",
					},
					confirm: BridgeConfirm.Normal,
				},
				{
					id: "ban",
					label: {
						ar: "احظر",
						en: "Ban",
					},
					confirm: BridgeConfirm.Normal,
					offline: true,
				},
			],
			empty: {
				ar: "لا يوجد لاعبون متصلون الآن.",
				en: "Nobody is online right now.",
			},
		},
		{
			layout: BridgeLayout.Table,
			id: "bans",
			title: {
				ar: "المحظورون",
				en: "Banned players",
			},
			help: {
				ar: "كل اللاعبين المحظورين من سيرفرك، ومن السطر نفسه تفك الحظر عنهم.",
				en: "Everyone banned from your server. Unban anyone from their row.",
			},
			place: BridgePlace.Players,
			module: "bans",
			columns: [
				{
					key: "name",
					label: {
						ar: "اللاعب",
						en: "Player",
					},
				},
				{
					key: "id",
					label: {
						ar: "رقم Steam",
						en: "Steam ID",
					},
				},
				{
					key: "reason",
					label: {
						ar: "السبب",
						en: "Reason",
					},
				},
			],
			add: {
				label: {
					ar: "احظر برقم Steam",
					en: "Ban by Steam ID",
				},
				placeholder: "7656119…",
			},
			actions: [
				{
					id: "remove",
					label: {
						ar: "فك الحظر",
						en: "Unban",
					},
					confirm: BridgeConfirm.Normal,
				},
			],
			empty: {
				ar: "لا يوجد لاعبون محظورون من سيرفرك. يظهر هنا كل لاعب تحظره من جدول اللاعبين.",
				en: "Nobody is banned from your server. Anyone you ban from the player list shows up here.",
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
			layout: BridgeLayout.Detail,
			id: "health",
			title: {
				ar: "حالة السيرفر",
				en: "Server health",
			},
			help: {
				ar: "أداء سيرفرك أثناء تشغيله: الإطارات، والرام، والكيانات، واللاعبون، وتتحدث كل 20 ثانية.",
				en: "How your server is running: FPS, memory, entities and players, refreshed every 20 seconds.",
			},
			place: BridgePlace.Overview,
			module: "health",
			empty: {
				ar: "تعذّر الوصول إلى سيرفرك الآن. شغّله وعطه دقيقة، وستظهر الأرقام هنا.",
				en: "We couldn't reach your server right now. Start it, give it a minute, and the numbers show up here.",
			},
		},
		{
			layout: BridgeLayout.Actions,
			id: "live",
			title: {
				ar: "أوامر سريعة",
				en: "Quick actions",
			},
			help: {
				ar: "تُنفَّذ فورًا على سيرفرك الشغّال.",
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
								ar: "تصل إلى كل اللاعبين المتصلين الآن في الشات.",
								en: "Reaches everyone on the server right now, in chat.",
							},
							maxLength: ANNOUNCE_MESSAGE_LENGTH,
						},
					],
				},
				{
					id: "save",
					label: {
						ar: "احفظ الماب",
						en: "Save the map",
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
				ar: "عند الوايب نوقف سيرفرك، ونأخذ نسخة احتياطية بأنفسنا، ونحذف البيانات، ثم نعيده بماب جديدة إذا كان شغّالًا فقط. وإذا غيّرت رأيك، تعيد النسخة الاحتياطية كل شيء.",
				en: "For a wipe we stop your server, take a backup ourselves, clear it, and bring it back on a new map only if it was running. If you change your mind, that backup puts everything back.",
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
						ar: "سيتم حذف الماب وكل ما بُني عليها، وإنشاء ماب جديدة. تبقى البلوبرنتات التي فتحها اللاعبون معهم. نوقف سيرفرك أولًا ونأخذ نسخة احتياطية، وبعد الوايب يعود تلقائيًا إذا كان شغّالًا فقط.",
						en: "The map and everything built on it are deleted and a new map is generated. The blueprints players unlocked stay with them. We stop your server first and take a backup, and after the wipe it comes back on its own only if it was running.",
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
						ar: "سيتم حذف الماب وكل ما بُني عليها، والبلوبرنتات، وكل بيانات اللاعبين. يبدأ الجميع من الصفر. نوقف سيرفرك أولًا ونأخذ نسخة احتياطية، وبعد الوايب يعود تلقائيًا إذا كان شغّالًا فقط.",
						en: "The map, everything built on it, the blueprints and all the player data are deleted. Everyone starts from zero. We stop your server first and take a backup, and after the wipe it comes back on its own only if it was running.",
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
