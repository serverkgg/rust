import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { installStampOf, promoteRconPassword, readInstallStamp, writeInstallStamp } from "./installStamp";

const contextWith = () => {
	const stored = new Map<string, string>();
	const logged: string[] = [];

	const context = {
		files: {
			async exists(path: string) {
				return stored.has(path);
			},
			async read(path: string) {
				return stored.get(path) ?? "";
			},
			async write(path: string, content: string) {
				stored.set(path, content);
			},
		},
		log(message: string) {
			logged.push(message);
		},
	} as unknown as Bridge.Context;

	return {
		context,
		logged,
	};
};

describe("reading the install stamp the rcon password lives in", () => {
	test("reads back the build and the password the install wrote", () => {
		expect(
			installStampOf({
				buildId: "12345",
				rconPassword: "secret",
			}),
		).toEqual({
			buildId: "12345",
			rconPassword: "secret",
			rconPasswordNext: null,
		});
	});

	test("reads the password waiting for the next start", () => {
		expect(
			installStampOf({
				buildId: "12345",
				rconPassword: "secret",
				rconPasswordNext: "rotated",
			})?.rconPasswordNext,
		).toBe("rotated");
	});

	test("reads an empty or malformed pending password as none", () => {
		for (const raw of [
			"",
			1234,
			null,
		]) {
			expect(
				installStampOf({
					rconPassword: "secret",
					rconPasswordNext: raw,
				})?.rconPasswordNext,
			).toBeNull();
		}
	});

	test("counts a stamp with no password as absent, because rcon cannot be reached without one", () => {
		expect(installStampOf({})).toBeNull();
	});

	test("counts an empty password as absent rather than dialling rcon with it", () => {
		expect(
			installStampOf({
				rconPassword: "",
			}),
		).toBeNull();
	});

	test("counts a password of the wrong type as absent", () => {
		expect(
			installStampOf({
				rconPassword: 1234,
			}),
		).toBeNull();
	});

	test("reads a missing file as no stamp at all", () => {
		expect(installStampOf(null)).toBeNull();
	});

	test("reads a stamp written before the first build was known", () => {
		expect(
			installStampOf({
				buildId: null,
				rconPassword: "secret",
			})?.buildId,
		).toBeNull();
	});
});

describe("promoting the rotated password at start", () => {
	test("hands back the same stamp when nothing is pending, without touching the volume", async () => {
		const { context, logged } = contextWith();
		const stamp = {
			buildId: "1",
			rconPassword: "secret",
			rconPasswordNext: null,
		};

		expect(await promoteRconPassword(context, stamp)).toBe(stamp);
		expect(await readInstallStamp(context)).toBeNull();
		expect(logged).toEqual([]);
	});

	test("makes the pending password the live one and clears it, so the process and the driver agree", async () => {
		const { context, logged } = contextWith();

		const promoted = await promoteRconPassword(context, {
			buildId: "1",
			rconPassword: "old",
			rconPasswordNext: "rotated",
		});

		expect(promoted).toEqual({
			buildId: "1",
			rconPassword: "rotated",
			rconPasswordNext: null,
		});
		expect(await readInstallStamp(context)).toEqual(promoted);
		expect(logged).toEqual([
			"applied the rotated rcon password",
		]);
	});

	test("round-trips a stamp through the volume", async () => {
		const { context } = contextWith();

		await writeInstallStamp(context, {
			buildId: null,
			rconPassword: "secret",
			rconPasswordNext: "rotated",
		});

		expect(await readInstallStamp(context)).toEqual({
			buildId: null,
			rconPassword: "secret",
			rconPasswordNext: "rotated",
		});
	});
});
