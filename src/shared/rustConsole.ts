import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { rconCommand, rconFire } from "./webRcon";

export const ANNOUNCE_MESSAGE_LENGTH = 200;

export const SAVE_COMMAND = "server.save";

export const QUIT_COMMAND = "quit";

export const KICK_REASON = "Kicked by an admin.";

export const BAN_REASON = "Banned by an admin.";

const SPACING = /\s+/g;

const QUOTES = /["\\]/g;

export const quoteArgument = (value: string) => {
	return `"${value.replaceAll(QUOTES, "").replaceAll(SPACING, " ").trim()}"`;
};

export const sayCommand = (message: string) => {
	return `say ${quoteArgument(message)}`;
};

export const kickCommand = (steamId: string) => {
	return `kick ${quoteArgument(steamId)} ${quoteArgument(KICK_REASON)}`;
};

export const banCommand = (steamId: string, name: string) => {
	return `banid ${quoteArgument(steamId)} ${quoteArgument(name)} ${quoteArgument(BAN_REASON)}`;
};

export const unbanCommand = (steamId: string) => {
	return `unban ${quoteArgument(steamId)}`;
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

export const SAVE_COMPLETE = /^\s*Saved [\d,]+ ents,/;

export const SAVE_CONFIRM_TIMEOUT_MS = 30_000;

export const awaitSaveComplete = async (
	context: Bridge.Context,
	save: () => Promise<void>,
	timeoutMs: number = SAVE_CONFIRM_TIMEOUT_MS,
) => {
	const { promise: completed, resolve } = Promise.withResolvers<boolean>();
	const unsubscribe = context.logs.follow(SAVE_COMPLETE, () => {
		resolve(true);
	});
	const timer = setTimeout(() => {
		resolve(false);
	}, timeoutMs);

	try {
		await save();

		return await completed;
	} finally {
		clearTimeout(timer);
		unsubscribe();
	}
};

export const quitServer = async (context: Bridge.Context) => {
	await rconFire(context, [
		QUIT_COMMAND,
	]);
};
