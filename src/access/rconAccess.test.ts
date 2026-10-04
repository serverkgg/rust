import { describe, expect, it } from "bun:test";
import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { RCON_ACCESS_VARIABLE, RCON_PASSWORD_LENGTH } from "@serverkgg/bridge/rcon";
import { readInstallStamp, writeInstallStamp } from "../shared";
import { rconAccess, rconAccessPassword, rotateRconPassword } from "./rconAccess";

const englishOf = (copy: Bridge.Text | string | null | undefined) => {
	return typeof copy === "string" ? copy : copy?.en;
};

const contextWith = (variables: Record<string, string> = {}) => {
	const stored = new Map<string, string>();
	const logged: string[] = [];
	const reported: Bridge.Activity[] = [];

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
		activity: {
			report(entry: Bridge.Activity) {
				reported.push(entry);
			},
		},
		log(message: string) {
			logged.push(message);
		},
	} as unknown as Bridge.Context;

	return {
		context,
		logged,
		reported,
	};
};

describe("what the remote access card shows for rust", () => {
	it("shows nothing before the install wrote the stamp", async () => {
		expect(await rconAccessPassword(contextWith().context)).toBeNull();
	});

	it("shows the password the running process was started with", async () => {
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

	it("shows the rotated password as pending until the next start", async () => {
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
	it("refuses before the install wrote the stamp", async () => {
		await expect(rotateRconPassword(contextWith().context)).rejects.toBeInstanceOf(BridgeUserError);
	});

	it("stores a fresh password beside the live one, which the running process keeps", async () => {
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

	it("reports the rotation naming only the target, never the old or the new password", async () => {
		const { context, reported } = contextWith();

		await writeInstallStamp(context, {
			buildId: "1",
			rconPassword: "secret-old-password",
			rconPasswordNext: null,
		});

		await rotateRconPassword(context);

		const stamp = await readInstallStamp(context);
		const serialized = JSON.stringify(reported);

		expect(reported.map((entry) => entry.name)).toEqual([
			BridgeEventName.SecretRotated,
		]);
		expect(reported.at(0)?.subject).toBe("WebRCON");
		expect(reported.at(0)?.details).toEqual({
			target: "rcon",
		});
		expect(serialized).not.toContain("secret-old-password");
		expect(serialized).not.toContain(stamp?.rconPasswordNext ?? "unreachable");
	});

	it("reports nothing when the rotation is refused", async () => {
		const { context, reported } = contextWith();

		await expect(rotateRconPassword(context)).rejects.toBeInstanceOf(BridgeUserError);

		expect(reported).toEqual([]);
	});
});

describe("the remote access module the driver registers", () => {
	it("is a detail module the panel card reads", () => {
		expect(rconAccess.kind).toBe(BridgeKind.Detail);
	});

	it("names WebRCON and the published port on the card", async () => {
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

	it("rotates through the module action without leaking the value into the log", async () => {
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
