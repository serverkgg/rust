import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import {
	avatarHashOf,
	banCommand,
	kickCommand,
	levelOf,
	nameOf,
	pingOf,
	playerRoster,
	presenceOf,
	rconCommand,
} from "../shared";

const REFRESH_SECONDS = 15;

const presenceOfRow = (row: Bridge.Row) => {
	return presenceOf({
		id: row.id,
		name: nameOf(row),
		level: levelOf(row),
		ping: pingOf(row),
		avatarHash: avatarHashOf(row),
	});
};

export const players: Bridge.Collection = {
	kind: BridgeKind.Collection,
	requiresRunning: true,
	refreshSeconds: REFRESH_SECONDS,
	async list(context) {
		return await playerRoster(context);
	},
	actions: {
		async kick(context, row) {
			await rconCommand(context, kickCommand(row.id));

			context.emit(BridgeEventName.PlayerKicked, presenceOfRow(row));

			context.activity.report({
				name: BridgeEventName.PlayerKicked,
				text: {
					ar: `تم طرد ${nameOf(row)}`,
					en: `Kicked ${nameOf(row)}`,
				},
				subject: nameOf(row),
				details: {
					steamId: row.id,
				},
			});
		},
		async ban(context, row) {
			await rconCommand(context, banCommand(row.id, nameOf(row)));

			context.emit(BridgeEventName.PlayerBanned, presenceOfRow(row));

			context.activity.report({
				name: BridgeEventName.PlayerBanned,
				text: {
					ar: `تم حظر ${nameOf(row)}`,
					en: `Banned ${nameOf(row)}`,
				},
				subject: nameOf(row),
				details: {
					steamId: row.id,
				},
			});
		},
	},
};
