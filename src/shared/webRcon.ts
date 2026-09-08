import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { readInstallStamp } from "./installStamp";

export const RCON_HOST = "127.0.0.1";

export const RCON_PORT = 28_016;

export const RCON_NAME = "WebRcon";

export const RCON_PROTOCOL: Bridge.Text = {
	ar: "WebRCON",
	en: "WebRCON",
};

export const CONNECT_TIMEOUT_MS = 8000;

export const REPLY_TIMEOUT_MS = 15_000;

export const FIRE_SETTLE_MS = 500;

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

interface Waiter {
	resolve(message: string): void;
	reject(error: Error): void;
}

interface RconSession {
	password: string;
	socket: WebSocket;
	ready: Promise<void>;
	waiters: Map<number, Waiter>;
}

export interface WebRconOptions {
	port?: number;
	connectTimeoutMs?: number;
	replyTimeoutMs?: number;
	settleMs?: number;
}

export interface WebRcon {
	command(context: Bridge.Context, command: string): Promise<string>;
	fire(context: Bridge.Context, commands: string[]): Promise<void>;
	release(): void;
}

export const createWebRcon = (options: WebRconOptions = {}): WebRcon => {
	const port = options.port ?? RCON_PORT;
	const connectTimeoutMs = options.connectTimeoutMs ?? CONNECT_TIMEOUT_MS;
	const replyTimeoutMs = options.replyTimeoutMs ?? REPLY_TIMEOUT_MS;
	const settleMs = options.settleMs ?? FIRE_SETTLE_MS;

	let session: RconSession | null = null;

	const drop = (target: RconSession) => {
		if (session === target) {
			session = null;
		}

		for (const waiter of target.waiters.values()) {
			waiter.reject(new BridgeUserError(UNREACHABLE));
		}

		target.waiters.clear();
		target.socket.close();
	};

	const open = (password: string): RconSession => {
		const socket = new WebSocket(rconUrl(password, port));
		const waiters = new Map<number, Waiter>();
		const { promise: ready, resolve, reject } = Promise.withResolvers<void>();
		const target: RconSession = {
			password,
			socket,
			ready,
			waiters,
		};

		const timer = setTimeout(() => {
			reject(new BridgeUserError(UNREACHABLE));
			drop(target);
		}, connectTimeoutMs);

		const fail = () => {
			clearTimeout(timer);
			reject(new BridgeUserError(UNREACHABLE));
			drop(target);
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

		socket.addEventListener("error", fail);
		socket.addEventListener("close", fail);

		socket.addEventListener("message", (event: MessageEvent) => {
			const reply = decodeRconFrame(String(event.data));
			const waiter = reply === null ? undefined : waiters.get(reply.identifier);

			if (reply === null || waiter === undefined) {
				return;
			}

			waiters.delete(reply.identifier);
			waiter.resolve(reply.message);
		});

		return target;
	};

	const sessionFor = async (context: Bridge.Context): Promise<RconSession> => {
		const password = await rconPassword(context);

		if (session !== null && session.password === password && session.socket.readyState <= WebSocket.OPEN) {
			await session.ready;

			return session;
		}

		if (session !== null) {
			drop(session);
		}

		const target = open(password);

		session = target;

		await target.ready;

		return target;
	};

	return {
		async command(context, command) {
			const target = await sessionFor(context);
			const identifier = nextIdentifier();

			return await new Promise<string>((resolve, reject) => {
				const timer = setTimeout(() => {
					target.waiters.delete(identifier);
					reject(new BridgeUserError(UNREACHABLE));
				}, replyTimeoutMs);

				target.waiters.set(identifier, {
					resolve(message) {
						clearTimeout(timer);
						resolve(message);
					},
					reject(error) {
						clearTimeout(timer);
						reject(error);
					},
				});

				target.socket.send(encodeRconFrame(identifier, command));
			});
		},
		async fire(context, commands) {
			const target = await sessionFor(context);

			for (const command of commands) {
				target.socket.send(encodeRconFrame(nextIdentifier(), command));
			}

			await Bun.sleep(settleMs);
		},
		release() {
			if (session !== null) {
				drop(session);
			}
		},
	};
};

const webRcon = createWebRcon();

export const rconCommand = async (context: Bridge.Context, command: string) => {
	return await webRcon.command(context, command);
};

export const rconFire = async (context: Bridge.Context, commands: string[]) => {
	await webRcon.fire(context, commands);
};

export const releaseRcon = () => {
	webRcon.release();
};
