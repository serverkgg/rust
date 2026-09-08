import { describe, expect, test } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import {
	createWebRcon,
	decodeRconFrame,
	encodeRconFrame,
	nextIdentifier,
	RCON_NAME,
	RCON_PORT,
	rconUrl,
} from "./webRcon";

describe("encoding a command for rust's web rcon", () => {
	test("sends the three fields facepunch's web rcon expects", () => {
		expect(JSON.parse(encodeRconFrame(7, "serverinfo"))).toEqual({
			Identifier: 7,
			Message: "serverinfo",
			Name: RCON_NAME,
		});
	});

	test("keeps the quotes inside a command intact", () => {
		expect(JSON.parse(encodeRconFrame(1, 'say "hello there"')).Message).toBe('say "hello there"');
	});

	test("keeps arabic in an announcement intact", () => {
		expect(JSON.parse(encodeRconFrame(1, 'say "السيرفر بيقفل"')).Message).toBe('say "السيرفر بيقفل"');
	});
});

describe("decoding what rust's web rcon answers", () => {
	test("reads the identifier and the message back", () => {
		expect(
			decodeRconFrame(
				JSON.stringify({
					Identifier: 7,
					Message: "hostname: My Server",
					Type: "Generic",
					Stacktrace: "",
				}),
			),
		).toEqual({
			identifier: 7,
			message: "hostname: My Server",
			type: "Generic",
		});
	});

	test("reads a frame with no type, because rust does not always send one", () => {
		expect(
			decodeRconFrame(
				JSON.stringify({
					Identifier: 2,
					Message: "ok",
				}),
			),
		).toEqual({
			identifier: 2,
			message: "ok",
			type: null,
		});
	});

	test("reads an empty message rather than dropping the reply", () => {
		expect(
			decodeRconFrame(
				JSON.stringify({
					Identifier: 3,
				}),
			)?.message,
		).toBe("");
	});

	test("drops a frame with no identifier, which is rust's own console chatter", () => {
		expect(
			decodeRconFrame(
				JSON.stringify({
					Message: "1 player connected",
					Type: "Generic",
				}),
			),
		).toBeNull();
	});

	test("drops a frame whose identifier is not a number", () => {
		expect(
			decodeRconFrame(
				JSON.stringify({
					Identifier: "7",
					Message: "ok",
				}),
			),
		).toBeNull();
	});

	test("treats a truncated frame as no reply instead of throwing", () => {
		expect(decodeRconFrame('{"Identifier": 7, "Mess')).toBeNull();
	});

	test("treats json that is not an object as no reply", () => {
		for (const raw of [
			"null",
			"42",
			'"ok"',
			"[]",
		]) {
			expect(decodeRconFrame(raw)).toBeNull();
		}
	});
});

describe("addressing the rcon of a running server", () => {
	test("talks to loopback only, never to a published port", () => {
		expect(rconUrl("secret")).toBe(`ws://127.0.0.1:${RCON_PORT}/secret`);
	});

	test("escapes a password that carries a slash, so the path stays one segment", () => {
		expect(rconUrl("a/b")).toBe(`ws://127.0.0.1:${RCON_PORT}/a%2Fb`);
	});

	test("uses the port it was given", () => {
		expect(rconUrl("secret", 30_000)).toBe("ws://127.0.0.1:30000/secret");
	});
});

describe("numbering the commands the driver sends", () => {
	test("never repeats the identifier of the command before it", () => {
		expect(nextIdentifier()).not.toBe(nextIdentifier());
	});

	test("stays a positive number, which rust echoes back unchanged", () => {
		expect(nextIdentifier()).toBeGreaterThan(0);
	});
});

interface FakeFrame {
	Identifier: number;
	Message: string;
}

interface FakeRust {
	port: number;
	connections(): number;
	stop(): Promise<void>;
}

const CLOSE_AFTER_REPLY = "close-after-reply";

const SILENT = "silent";

const fakeRust = (): FakeRust => {
	let connections = 0;

	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch(request, server) {
			if (server.upgrade(request)) {
				return;
			}

			return new Response("websocket only", {
				status: 400,
			});
		},
		websocket: {
			open() {
				connections += 1;
			},
			message(ws, raw) {
				const frame = JSON.parse(String(raw)) as FakeFrame;

				if (frame.Message === SILENT) {
					return;
				}

				ws.send(
					JSON.stringify({
						Identifier: 0,
						Message: "console chatter",
						Type: "Generic",
					}),
				);

				ws.send(
					JSON.stringify({
						Identifier: frame.Identifier,
						Message: `echo ${frame.Message}`,
						Type: "Generic",
					}),
				);

				if (frame.Message === CLOSE_AFTER_REPLY) {
					ws.close();
				}
			},
		},
	});

	return {
		port: server.port ?? 0,
		connections() {
			return connections;
		},
		async stop() {
			await server.stop(true);
		},
	};
};

const contextWith = (passwords: string[]) => {
	let reads = 0;

	return {
		files: {
			async exists() {
				return true;
			},
			async read() {
				const password = passwords[Math.min(reads, passwords.length - 1)] ?? "";

				reads += 1;

				return JSON.stringify({
					buildId: "1",
					rconPassword: password,
				});
			},
		},
	} as unknown as Bridge.Context;
};

const withServer = async (
	run: (rust: FakeRust, context: Bridge.Context) => Promise<void>,
	passwords = [
		"secret",
	],
) => {
	const rust = fakeRust();

	try {
		await run(rust, contextWith(passwords));
	} finally {
		await rust.stop();
	}
};

describe("keeping one socket open to rust's web rcon", () => {
	test("sends two commands over the same socket and matches each reply to its command", async () => {
		await withServer(async (rust, context) => {
			const rcon = createWebRcon({
				port: rust.port,
			});

			try {
				expect(await rcon.command(context, "serverinfo")).toBe("echo serverinfo");
				expect(await rcon.command(context, "playerlist")).toBe("echo playerlist");
				expect(rust.connections()).toBe(1);
			} finally {
				rcon.release();
			}
		});
	});

	test("ignores a frame carrying another identifier, which is rust's own console chatter", async () => {
		await withServer(async (rust, context) => {
			const rcon = createWebRcon({
				port: rust.port,
			});

			try {
				expect(await rcon.command(context, "status")).toBe("echo status");
			} finally {
				rcon.release();
			}
		});
	});

	test("reopens the socket on the next command after the server closed it", async () => {
		await withServer(async (rust, context) => {
			const rcon = createWebRcon({
				port: rust.port,
			});

			try {
				expect(await rcon.command(context, CLOSE_AFTER_REPLY)).toBe(`echo ${CLOSE_AFTER_REPLY}`);

				await Bun.sleep(50);

				expect(await rcon.command(context, "status")).toBe("echo status");
				expect(rust.connections()).toBe(2);
			} finally {
				rcon.release();
			}
		});
	});

	test("gives up on a command nothing answers, and keeps the socket for the next one", async () => {
		await withServer(async (rust, context) => {
			const rcon = createWebRcon({
				port: rust.port,
				replyTimeoutMs: 50,
			});

			try {
				await expect(rcon.command(context, SILENT)).rejects.toBeInstanceOf(BridgeUserError);
				expect(await rcon.command(context, "status")).toBe("echo status");
				expect(rust.connections()).toBe(1);
			} finally {
				rcon.release();
			}
		});
	});

	test("fires commands without waiting for a reply, over the same socket", async () => {
		await withServer(async (rust, context) => {
			const rcon = createWebRcon({
				port: rust.port,
				settleMs: 10,
			});

			try {
				await rcon.fire(context, [
					"server.save",
					"quit",
				]);
				expect(await rcon.command(context, "status")).toBe("echo status");
				expect(rust.connections()).toBe(1);
			} finally {
				rcon.release();
			}
		});
	});

	test("dials again after release, which is what a stop and a start do", async () => {
		await withServer(async (rust, context) => {
			const rcon = createWebRcon({
				port: rust.port,
			});

			try {
				expect(await rcon.command(context, "status")).toBe("echo status");

				rcon.release();

				expect(await rcon.command(context, "status")).toBe("echo status");
				expect(rust.connections()).toBe(2);
			} finally {
				rcon.release();
			}
		});
	});

	test("dials again with the new password once the stamp changes", async () => {
		await withServer(
			async (rust, context) => {
				const rcon = createWebRcon({
					port: rust.port,
				});

				try {
					expect(await rcon.command(context, "status")).toBe("echo status");
					expect(await rcon.command(context, "status")).toBe("echo status");
					expect(rust.connections()).toBe(2);
				} finally {
					rcon.release();
				}
			},
			[
				"first",
				"second",
			],
		);
	});

	test("reports the server as unreachable when nothing listens", async () => {
		const rust = fakeRust();
		const port = rust.port;

		await rust.stop();

		const rcon = createWebRcon({
			port,
			connectTimeoutMs: 500,
		});

		try {
			await expect(
				rcon.command(
					contextWith([
						"secret",
					]),
					"status",
				),
			).rejects.toBeInstanceOf(BridgeUserError);
		} finally {
			rcon.release();
		}
	});

	test("reports the server as unreachable when the stamp has no password yet", async () => {
		await withServer(async (rust) => {
			const rcon = createWebRcon({
				port: rust.port,
			});

			const context = {
				files: {
					async exists() {
						return false;
					},
				},
			} as unknown as Bridge.Context;

			await expect(rcon.command(context, "status")).rejects.toBeInstanceOf(BridgeUserError);
			expect(rust.connections()).toBe(0);
		});
	});
});
