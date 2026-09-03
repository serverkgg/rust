import { describe, expect, test } from "bun:test";
import { decodeRconFrame, encodeRconFrame, nextIdentifier, RCON_NAME, RCON_PORT, rconUrl } from "./webRcon";

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
