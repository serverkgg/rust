import { describe, expect, it, mock } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import * as steam from "@serverkgg/bridge/steam";
import { CARBON_DELETED_DEPOT_FILES, GAME_ROOTS, readInstallStamp, writeInstallStamp } from "../shared";
import * as seedConfigModule from "./seedConfig";

const game = {
	build: "19000001" as string | null,
	missing: [] as string[],
	restores: false,
	updates: [] as steam.SteamcmdUpdateOptions[],
};

mock.module("@serverkgg/bridge/steam", () => {
	return {
		...steam,
		createSteamcmd() {
			return {
				async prepare() {},
				async update(options: steam.SteamcmdUpdateOptions) {
					game.updates.push(options);

					if (game.restores) {
						game.missing = [];
					}
				},
				async linkSteamClient() {},
				async buildId() {
					return game.build;
				},
			};
		},
		async missingGameRoots(_context: Bridge.Context, roots: string[]) {
			return roots.filter((root) => game.missing.includes(root));
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
	game.restores = false;
	game.updates = [];
};

describe("telling the owner what the install did", () => {
	it("reports the first install with the build it landed on", async () => {
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

	it("emits the plain server updated event for telemetry and reports the update as activity beside it", async () => {
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

	it("reports nothing when steam has no newer build", async () => {
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

	it("never puts the generated rcon password in the install report", async () => {
		reset("19000001");

		const { context, reported } = serverWith();

		await install.run(context);

		const stamp = await readInstallStamp(context);

		expect(stamp).not.toBeNull();
		expect(JSON.stringify(reported)).not.toContain(stamp?.rconPassword ?? "unreachable");
	});
});

describe("failing an install whose download left the game incomplete", () => {
	it("tells the owner to retry and keeps the missing folder for staff", async () => {
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

describe("choosing when the steam update validates", () => {
	it("keeps the cheap update on a server whose steam files are all there", async () => {
		reset("19000001");

		const { context } = serverWith();

		await install.run(context);

		expect(game.updates).toEqual([
			{
				validate: false,
			},
		]);
	});

	it("validates when carbon deleted a steam file on boot, because steam cancels an update that reads a missing file", async () => {
		for (const file of CARBON_DELETED_DEPOT_FILES) {
			reset("19000001", [
				file,
			]);

			game.restores = true;

			const { context } = serverWith();

			await install.run(context);

			expect(game.updates).toEqual([
				{
					validate: true,
				},
			]);
		}
	});

	it("validates the first download", async () => {
		reset("19000001", [
			...GAME_ROOTS,
			...CARBON_DELETED_DEPOT_FILES,
		]);

		game.restores = true;

		const { context } = serverWith();

		await install.run(context);

		expect(game.updates).toEqual([
			{
				validate: true,
			},
		]);
	});
});
