import { describe, expect, test } from "bun:test";
import { STAMP_FILE, STEAM_APP_ID } from "../shared";
import { execDetail, STEAM_DIRECTORY, STEAMCMD_DIRECTORY, updateCommand } from "./steamcmd";

const GAME_ROOT = "/home/serverk/server";

interface Manifest {
	reset: {
		keep: string[];
	};
	files: {
		protected: string[];
	};
}

const manifest = Bun.YAML.parse(await Bun.file(new URL("../../serverk.yml", import.meta.url)).text()) as Manifest;

describe("building the steamcmd command that downloads rust", () => {
	test("installs into the server directory as an anonymous user", () => {
		expect(updateCommand(GAME_ROOT, false)).toEqual([
			"./.steamcmd/steamcmd.sh",
			"+force_install_dir",
			GAME_ROOT,
			"+login",
			"anonymous",
			"+app_update",
			STEAM_APP_ID,
			"+quit",
		]);
	});

	test("validates the download on a fresh install", () => {
		expect(updateCommand(GAME_ROOT, true)).toContain("validate");
	});

	test("skips validation when it is only checking steam for a newer build", () => {
		expect(updateCommand(GAME_ROOT, false)).not.toContain("validate");
	});

	test("puts validate on the app_update, not after quit", () => {
		const command = updateCommand(GAME_ROOT, true);

		expect(command.indexOf("validate")).toBe(command.indexOf(STEAM_APP_ID) + 1);
		expect(command.at(-1)).toBe("+quit");
	});

	test("always ends by quitting, so steamcmd never waits on a prompt", () => {
		expect(updateCommand(GAME_ROOT, false).at(-1)).toBe("+quit");
		expect(updateCommand(GAME_ROOT, true).at(-1)).toBe("+quit");
	});

	test("builds a fresh array each time, so one call cannot grow another", () => {
		const first = updateCommand(GAME_ROOT, true);

		expect(updateCommand(GAME_ROOT, true)).toEqual(first);
	});
});

describe("explaining why a steamcmd run failed", () => {
	test("joins what steamcmd wrote to both streams", () => {
		expect(
			execDetail({
				stdout: "Error! App state is 0x202",
				stderr: "no space left on device",
				code: 8,
			}),
		).toBe("Error! App state is 0x202 | no space left on device");
	});

	test("reports only the stream that said something", () => {
		expect(
			execDetail({
				stdout: "",
				stderr: "no space left on device",
				code: 8,
			}),
		).toBe("no space left on device");
	});

	test("says nothing when steamcmd died silently", () => {
		expect(
			execDetail({
				stdout: "   \n",
				stderr: "",
				code: 137,
			}),
		).toBe("");
	});

	test("keeps the end of a long log, where the failure is", () => {
		const detail = execDetail({
			stdout: `${"noise ".repeat(1000)}Error! App state is 0x202`,
			stderr: "",
			code: 8,
		});

		expect(detail).toEndWith("Error! App state is 0x202");
		expect(detail.length).toBeLessThanOrEqual(800);
	});
});

describe("the manifest guarding the steam install against a reset", () => {
	test("keeps steamcmd across a reset, so a reset never re-downloads twenty gigabytes", () => {
		expect(manifest.reset.keep).toContain(STEAMCMD_DIRECTORY);
	});

	test("keeps the steam client directory the driver links steamclient.so into", () => {
		expect(manifest.reset.keep).toContain(STEAM_DIRECTORY);
	});

	test("keeps the game files a reset has no reason to remove", () => {
		for (const path of [
			"RustDedicated",
			"RustDedicated_Data",
			"Bundles",
			"steamapps",
		]) {
			expect(manifest.reset.keep).toContain(path);
		}
	});

	test("hides the steam directories from the file manager, so nobody deletes them by hand", () => {
		expect(manifest.files.protected).toContain(STEAMCMD_DIRECTORY);
		expect(manifest.files.protected).toContain(STEAM_DIRECTORY);
	});

	test("protects the install stamp the driver reports the version from", () => {
		expect(manifest.files.protected).toContain(STAMP_FILE);
	});
});
