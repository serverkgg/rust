import { describe, expect, test } from "bun:test";
import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { RCON_ACCESS_VARIABLE, RCON_PASSWORD_LENGTH } from "@serverkgg/bridge/rcon";
import { readInstallStamp, writeInstallStamp } from "../shared";
import { rconAccess, rconAccessPassword, rotateRconPassword } from "./rconAccess";

const englishOf = (copy: Bridge.Text | string | null | undefined) => {
	return typeof copy === "string" ? copy : copy?.en;
};

const contextWith = (variables: Record<string, string> = {}) => {
	const stored = new Map<string, string>();
	const logged: string[] = [];

	const context = {
		variable(key: string) {
			return variables[key] ?? null;
		},
		port() {
			return 12_500;
		},
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

describe("what the remote access card shows for rust", () => {
	test("shows nothing before the install wrote the stamp", async () => {
		expect(await rconAccessPassword(contextWith().context)).toBeNull();
	});

	test("shows the password the running process was started with", async () => {
		const { context } = contextWith();

		await writeInstallStamp(context, {
			buildId: "1",
			rconPassword: "secret",
			rconPasswordNext: null,
		});

		expect(await rconAccessPassword(context)).toEqual({
			value: "secret",
			pending: false,
		});
	});

	test("shows the rotated password as pending until the next start", async () => {
		const { context } = contextWith();

		await writeInstallStamp(context, {
			buildId: "1",
			rconPassword: "secret",
			rconPasswordNext: "rotated",
		});

		expect(await rconAccessPassword(context)).toEqual({
			value: "rotated",
			pending: true,
		});
	});
});

describe("rotating the rcon password", () => {
	test("refuses before the install wrote the stamp", async () => {
		await expect(rotateRconPassword(contextWith().context)).rejects.toBeInstanceOf(BridgeUserError);
	});

	test("stores a fresh password beside the live one, which the running process keeps", async () => {
		const { context } = contextWith();

		await writeInstallStamp(context, {
			buildId: "1",
			rconPassword: "secret",
			rconPasswordNext: null,
		});

		await rotateRconPassword(context);

		const stamp = await readInstallStamp(context);

		expect(stamp?.rconPassword).toBe("secret");
		expect(stamp?.rconPasswordNext).toHaveLength(RCON_PASSWORD_LENGTH);
		expect(stamp?.buildId).toBe("1");
	});
});

describe("the remote access module the driver registers", () => {
	test("is a detail module the panel card reads", () => {
		expect(rconAccess.kind).toBe(BridgeKind.Detail);
	});

	test("names WebRCON and the published port on the card", async () => {
		const { context } = contextWith({
			[RCON_ACCESS_VARIABLE]: "true",
		});

		await writeInstallStamp(context, {
			buildId: "1",
			rconPassword: "secret",
			rconPasswordNext: null,
		});

		const detail = await rconAccess.read(context);

		expect(englishOf(detail?.subtitle)).toBe("WebRCON");
		expect(englishOf(detail?.description)).toContain("RustAdmin");
		expect(detail?.stats.map((stat) => stat.value)).toEqual([
			12_500,
			"secret",
		]);
	});

	test("rotates through the module action without leaking the value into the log", async () => {
		const { context, logged } = contextWith();

		await writeInstallStamp(context, {
			buildId: "1",
			rconPassword: "secret",
			rconPasswordNext: null,
		});

		await rconAccess.actions?.rotate?.(context, {});

		const stamp = await readInstallStamp(context);

		expect(stamp?.rconPasswordNext).not.toBeNull();
		expect(logged.join("\n")).not.toContain(stamp?.rconPasswordNext ?? "");
	});
});
