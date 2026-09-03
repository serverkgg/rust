import { type Bridge, BridgeKind, BridgeTerminalLevel } from "@serverkgg/bridge";

const player: Bridge.TerminalArg = {
	key: "player",
	label: {
		ar: "اللاعب",
		en: "Player",
	},
	required: true,
	module: "players",
	column: "name",
};

const commands: Bridge.TerminalCommand[] = [
	{
		name: "say",
		summary: {
			ar: "رسالة تظهر لكل اللاعبين.",
			en: "Broadcast a message to everyone.",
		},
		syntax: 'say "<message>"',
	},
	{
		name: "serverinfo",
		summary: {
			ar: "يعرض حالة السيرفر وعدد اللاعبين والماب.",
			en: "Show the server status, player count and map.",
		},
	},
	{
		name: "playerlist",
		summary: {
			ar: "يعرض اللاعبين المتصلين الحين.",
			en: "List the players who are online.",
		},
	},
	{
		name: "server.save",
		summary: {
			ar: "يحفظ العالم على القرص.",
			en: "Save the world to disk.",
		},
	},
	{
		name: "server.writecfg",
		summary: {
			ar: "يكتب الإعدادات الحالية في server.cfg.",
			en: "Write the current settings into server.cfg.",
		},
	},
	{
		name: "kick",
		summary: {
			ar: "يطرد لاعب من السيرفر.",
			en: "Kick a player from the server.",
		},
		syntax: 'kick "<player>" "<reason>"',
		args: [
			player,
		],
	},
	{
		name: "ban",
		summary: {
			ar: "يحظر لاعب نهائيًا.",
			en: "Ban a player.",
		},
		syntax: 'ban "<player>" "<reason>"',
		args: [
			player,
		],
		danger: true,
	},
	{
		name: "banlist",
		summary: {
			ar: "يعرض قائمة المحظورين.",
			en: "Show the ban list.",
		},
	},
	{
		name: "unban",
		summary: {
			ar: "يشيل الحظر عن رقم Steam.",
			en: "Lift a ban from a Steam ID.",
		},
		syntax: "unban <steamid>",
	},
	{
		name: "ownerid",
		summary: {
			ar: "يعطي رقم Steam صلاحية أدمن كاملة.",
			en: "Give a Steam ID full admin.",
		},
		syntax: 'ownerid <steamid> "<name>" "<reason>"',
	},
	{
		name: "moderatorid",
		summary: {
			ar: "يعطي رقم Steam صلاحية مشرف.",
			en: "Give a Steam ID moderator rights.",
		},
		syntax: 'moderatorid <steamid> "<name>" "<reason>"',
	},
	{
		name: "env.time",
		summary: {
			ar: "يغيّر وقت اليوم داخل اللعبة، من 0 إلى 24.",
			en: "Set the in-game time of day, from 0 to 24.",
		},
		syntax: "env.time <hour>",
	},
	{
		name: "quit",
		summary: {
			ar: "يحفظ ويوقف السيرفر.",
			en: "Save and stop the server.",
		},
		danger: true,
	},
];

const rules: Bridge.TerminalRule[] = [
	{
		match: /\b\w*Exception\b/,
		level: BridgeTerminalLevel.Error,
	},
	{
		match: /\b(?:ERROR|Error):/,
		level: BridgeTerminalLevel.Error,
	},
	{
		match: /^Failed to /,
		level: BridgeTerminalLevel.Error,
	},
	{
		match: /\b(?:WARNING|Warning):/,
		level: BridgeTerminalLevel.Warn,
	},
];

export const terminal: Bridge.Terminal = {
	kind: BridgeKind.Terminal,
	commands,
	rules,
};
