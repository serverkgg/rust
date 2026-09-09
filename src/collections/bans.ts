import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import {
	banCommand,
	presenceOf,
	type RustBan,
	rconCommand,
	readBanList,
	requireSteamId,
	unbanCommand,
} from "../shared";

const REFRESH_SECONDS = 30;

export const banRow = (ban: RustBan): Bridge.Row => {
	return {
		id: ban.steamId,
		name: ban.name,
		reason: ban.reason,
	};
};

export const bans: Bridge.Collection = {
	kind: BridgeKind.Collection,
	requiresRunning: true,
	refreshSeconds: REFRESH_SECONDS,
	async list(context) {
		return (await readBanList(context)).map(banRow);
	},
	async add(context, input) {
		const steamId = requireSteamId(input);

		await rconCommand(context, banCommand(steamId, ""));

		context.emit(
			BridgeEventName.PlayerBanned,
			presenceOf({
				id: steamId,
				name: steamId,
			}),
		);

		context.log("banned a steam id that was not online", {
			steamId,
		});
	},
	actions: {
		async remove(context, row) {
			await rconCommand(context, unbanCommand(row.id));

			context.log("lifted a ban from the panel", {
				steamId: row.id,
			});
		},
	},
};
