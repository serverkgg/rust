import { describe, expect, mock, test } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import * as steam from "@serverkgg/bridge/steam";
import { readInstallStamp, writeInstallStamp } from "../shared";
import * as seedConfigModule from "./seedConfig";

const game = {
	build: "19000001" as string | null,
	missing: [] as string[],
};

mock.module("@serverkgg/bridge/steam", () => {
	return {
		...steam,
		createSteamcmd() {
			return {
				async prepare() {},
				async update() {},
				async linkSteamClient() {},
				async buildId() {
					return game.build;
				},
			};
		},
		async missingGameRoots() {
			return game.missing;
		},
	};
});

mock.module("./seedConfig", () => {
	return {
		...seedConfigModule,
		async seedConfig() {},
	};
});

const { install, FILES_MISSING } = await import("./install");

const serverWith = () => {
	const stored = new Map<string, string>();
	const reported: Bridge.Activity[] = [];
	const emitted: {
		event: string;
		payload?: Bridge.Values;
	}[] = [];

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
		activity: {
			report(entry: Bridge.Activity) {
				reported.push(entry);
			},
		},
		emit(event: string, payload?: Bridge.Values) {
			emitted.push({
				event,
				payload,
			});
		},
		log() {},
	} as unknown as Bridge.Context;

	return {
		context,
		reported,
		emitted,
	};
};

const reset = (build: string | null, missing: string[] = []) => {
	game.build = build;
	game.missing = missing;
};

describe("telling the owner what the install did", () => {
	test("reports the first install with the build it landed on", async () => {
		reset("19000001");

		const { context, reported } = serverWith();

		await install.run(context);

		expect(reported).toEqual([
			{
				name: BridgeEventName.GameInstalled,
				text: {
					ar: "تم تثبيت رست (البيلد 19000001)",
					en: "Installed Rust (build 19000001)",
				},
				details: {
					build: "19000001",
				},
			},
		]);
	});

	test("emits the plain server updated event for telemetry and reports the update as activity beside it", async () => {
		reset("19000002");

		const { context, reported, emitted } = serverWith();

		await writeInstallStamp(context, {
			buildId: "19000001",
			rconPassword: "rcon-password-that-never-leaves",
			rconPasswordNext: null,
		});

		await install.run(context);

		expect(emitted).toEqual([
			{
				event: BridgeEventName.ServerUpdated,
				payload: {
					from: "19000001",
					to: "19000002",
				},
			},
		]);
		expect(reported).toEqual([
			{
				name: BridgeEventName.ServerUpdated,
				text: {
					ar: "تم تحديث رست من البيلد 19000001 إلى 19000002",
					en: "Updated Rust from build 19000001 to 19000002",
				},
				details: {
					from: "19000001",
					to: "19000002",
				},
			},
		]);
		expect(JSON.stringify(reported)).not.toContain("rcon-password-that-never-leaves");
	});

	test("reports nothing when steam has no newer build", async () => {
		reset("19000001");

		const { context, reported, emitted } = serverWith();

		await writeInstallStamp(context, {
			buildId: "19000001",
			rconPassword: "secret",
			rconPasswordNext: null,
		});

		await install.run(context);

		expect(emitted).toEqual([]);
		expect(reported).toEqual([]);
	});

	test("never puts the generated rcon password in the install report", async () => {
		reset("19000001");

		const { context, reported } = serverWith();

		await install.run(context);

		const stamp = await readInstallStamp(context);

		expect(stamp).not.toBeNull();
		expect(JSON.stringify(reported)).not.toContain(stamp?.rconPassword ?? "unreachable");
	});
});

describe("failing an install whose download left the game incomplete", () => {
	test("tells the owner to retry and keeps the missing folder for staff", async () => {
		reset("19000001", [
			"RustDedicated_Data",
		]);

		const { context, reported } = serverWith();
		const failure = await install.run(context).catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(BridgeUserError);
		expect(failure instanceof BridgeUserError ? failure.text : null).toEqual(FILES_MISSING);
		expect(failure instanceof Error ? String(failure.cause) : "").toContain("RustDedicated_Data");
		expect(reported).toEqual([]);
	});
});
