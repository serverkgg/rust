import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { rconCommand } from "./webRcon";

export const BAN_LIST_COMMAND = "banlistex";

export const STEAM_ID_PATTERN = /^7656\d{13}$/;

const LINE_BREAK = /\r?\n/;

const BAN_LINE = /"?(\d{17})"?(?:\s+"([^"]*)"\s+"([^"]*)")?/;

export interface RustBan {
	steamId: string;
	name: string;
	reason: string;
}

export const parseBanList = (raw: string): RustBan[] => {
	const bans: RustBan[] = [];
	const seen = new Set<string>();

	for (const line of raw.split(LINE_BREAK)) {
		const match = line.match(BAN_LINE);
		const steamId = match?.at(1) ?? "";

		if (steamId.length === 0 || seen.has(steamId)) {
			continue;
		}

		seen.add(steamId);
		bans.push({
			steamId,
			name: match?.at(2) ?? "",
			reason: match?.at(3) ?? "",
		});
	}

	return bans;
};

export const requireSteamId = (input: string) => {
	const steamId = input.trim();

	if (!STEAM_ID_PATTERN.test(steamId)) {
		throw new BridgeUserError({
			ar: "هذا مو رقم Steam. الرقم 17 خانة ويبدأ بـ 7656 — مثال: 76561198000000001",
			en: "That is not a Steam ID. It is 17 digits starting with 7656 — like 76561198000000001.",
		});
	}

	return steamId;
};

export const readBanList = async (context: Bridge.Context): Promise<RustBan[]> => {
	return parseBanList(await rconCommand(context, BAN_LIST_COMMAND));
};
