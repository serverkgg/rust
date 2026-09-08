import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { readInstallStamp } from "./installStamp";

export const RCON_HOST = "127.0.0.1";

export const RCON_PORT = 28_016;

export const RCON_NAME = "WebRcon";

const CONNECT_TIMEOUT_MS = 8000;

const REPLY_TIMEOUT_MS = 15_000;

const FIRE_SETTLE_MS = 500;

const UNREACHABLE: Bridge.Text = {
	ar: "ما قدرنا نوصل لسيرفرك. تأكد إنه شغّال وجرّب مرة ثانية.",
	en: "We could not reach your server. Make sure it is running and try again.",
};

export interface WebRconRequest {
	Identifier: number;
	Message: string;
	Name: string;
}

export interface WebRconReply {
	identifier: number;
	message: string;
	type: string | null;
}

export const encodeRconFrame = (identifier: number, message: string): string => {
	const frame: WebRconRequest = {
		Identifier: identifier,
		Message: message,
		Name: RCON_NAME,
	};

	return JSON.stringify(frame);
};

export const decodeRconFrame = (raw: string): WebRconReply | null => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}

	if (typeof parsed !== "object" || parsed === null) {
		return null;
	}

	const frame = parsed as Record<string, unknown>;
	const identifier = frame.Identifier;

	if (typeof identifier !== "number" || !Number.isFinite(identifier)) {
		return null;
	}

	return {
		identifier,
		message: typeof frame.Message === "string" ? frame.Message : "",
		type: typeof frame.Type === "string" ? frame.Type : null,
	};
};

export const rconUrl = (password: string, port: number = RCON_PORT) => {
	return `ws://${RCON_HOST}:${port}/${encodeURIComponent(password)}`;
};

let counter = 0;

export const nextIdentifier = () => {
	counter = (counter % 1_000_000) + 1;

	return counter;
};

const rconPassword = async (context: Bridge.Context) => {
	const stamp = await readInstallStamp(context);

	if (!stamp) {
		throw new BridgeUserError(UNREACHABLE);
	}

	return stamp.rconPassword;
};

const connect = async (context: Bridge.Context) => {
	const socket = new WebSocket(rconUrl(await rconPassword(context)));

	await new Promise<void>((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new BridgeUserError(UNREACHABLE));
		}, CONNECT_TIMEOUT_MS);

		const fail = () => {
			clearTimeout(timer);
			reject(new BridgeUserError(UNREACHABLE));
		};

		socket.addEventListener(
			"open",
			() => {
				clearTimeout(timer);
				resolve();
			},
			{
				once: true,
			},
		);

		socket.addEventListener("error", fail, {
			once: true,
		});

		socket.addEventListener("close", fail, {
			once: true,
		});
	}).catch((error: unknown) => {
		socket.close();

		throw error;
	});

	return socket;
};

export const rconCommand = async (context: Bridge.Context, command: string) => {
	const socket = await connect(context);
	const identifier = nextIdentifier();

	try {
		return await new Promise<string>((resolve, reject) => {
			const timer = setTimeout(() => {
				reject(new BridgeUserError(UNREACHABLE));
			}, REPLY_TIMEOUT_MS);

			socket.addEventListener("message", (event: MessageEvent) => {
				const reply = decodeRconFrame(String(event.data));

				if (!reply || reply.identifier !== identifier) {
					return;
				}

				clearTimeout(timer);
				resolve(reply.message);
			});

			socket.addEventListener(
				"close",
				() => {
					clearTimeout(timer);
					reject(new BridgeUserError(UNREACHABLE));
				},
				{
					once: true,
				},
			);

			socket.send(encodeRconFrame(identifier, command));
		});
	} finally {
		socket.close();
	}
};

export const rconFire = async (context: Bridge.Context, commands: string[]) => {
	const socket = await connect(context);

	try {
		for (const command of commands) {
			socket.send(encodeRconFrame(nextIdentifier(), command));
		}

		await Bun.sleep(FIRE_SETTLE_MS);
	} finally {
		socket.close();
	}
};
