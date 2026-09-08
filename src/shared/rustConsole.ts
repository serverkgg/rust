import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { rconCommand, rconFire } from "./webRcon";

export const ANNOUNCE_MESSAGE_LENGTH = 200;

export const SAVE_COMMAND = "server.save";

export const QUIT_COMMAND = "quit";

const SPACING = /\s+/g;

const QUOTES = /["\\]/g;

export const quoteArgument = (value: string) => {
	return `"${value.replaceAll(QUOTES, "").replaceAll(SPACING, " ").trim()}"`;
};

export const sayCommand = (message: string) => {
	return `say ${quoteArgument(message)}`;
};

export const kickCommand = (steamId: string) => {
	return `kick ${quoteArgument(steamId)} ${quoteArgument("Kicked by an admin.")}`;
};

export const banCommand = (steamId: string, name: string) => {
	return `banid ${quoteArgument(steamId)} ${quoteArgument(name)} ${quoteArgument("Banned by an admin.")}`;
};

export const messageArgument = (args: Bridge.Values) => {
	const message = String(args.message ?? "")
		.replaceAll(SPACING, " ")
		.trim();

	if (message.length === 0) {
		throw new BridgeUserError({
			ar: "اكتب الرسالة أول.",
			en: "Write the message first.",
		});
	}

	return message.slice(0, ANNOUNCE_MESSAGE_LENGTH);
};

export const sendAnnounce = async (context: Bridge.Context, message: string) => {
	await rconCommand(context, sayCommand(message));
};

export const saveWorld = async (context: Bridge.Context) => {
	await rconCommand(context, SAVE_COMMAND);

	context.emit(BridgeEventName.WorldSaved);
};

export const quitServer = async (context: Bridge.Context) => {
	await rconFire(context, [
		QUIT_COMMAND,
	]);
};
