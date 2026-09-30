import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { INSTALL_STAMP_FILE } from "@serverkgg/bridge/install";
import { lifecycle } from "./lifecycle";

const PASSWORD = "rcon-password-at-boot";

const bootingWith = (list: () => Promise<Bridge.FileEntry[]>) => {
	const warned: string[] = [];
	const reported: Bridge.Activity[] = [];

	const stored = new Map<string, string>([
		[
			INSTALL_STAMP_FILE,
			JSON.stringify({
				buildId: "19000001",
				rconPassword: PASSWORD,
				rconPasswordNext: null,
			}),
		],
	]);

	const context = {
		variable() {
			return null;
		},
		port() {
			return 28_015;
		},
		files: {
			list,
			async exists(path: string) {
				return stored.has(path);
			},
			async read(path: string) {
				return stored.get(path) ?? "";
			},
			async write(path: string, content: string) {
				stored.set(path, content);
			},
			async remove(path: string) {
				stored.delete(path);
			},
		},
		codec: {
			sourceCfg: {
				async read() {
					return {
						"server.seed": 777,
						"server.worldsize": 4500,
					};
				},
			},
		},
		activity: {
			report(entry: Bridge.Activity) {
				reported.push(entry);
			},
		},
		log: Object.assign(() => {}, {
			warn(message: string) {
				warned.push(message);
			},
			error() {},
		}),
	} as unknown as Bridge.Context;

	return {
		context,
		reported,
		warned,
	};
};

describe("starting rust when the new map check cannot run", () => {
	test("still builds the start command when the identity folder cannot be listed", async () => {
		const { context, reported, warned } = bootingWith(async () => {
			throw new Error("the listing hit its scan limit");
		});

		const command = await lifecycle.command(context);

		expect(command).toContain("+server.seed");
		expect(command).toContain("777");
		expect(reported).toEqual([]);
		expect(warned).toHaveLength(1);
	});

	test("builds the start command and reports the new map when the seed changed", async () => {
		const { context, reported } = bootingWith(async () => {
			return [
				{
					path: "server/serverk/proceduralmap.3000.4242.221.sav",
					name: "proceduralmap.3000.4242.221.sav",
					directory: false,
					sizeBytes: 1024,
					modifiedAt: "2026-09-30T00:00:00.000Z",
				},
			];
		});

		const command = await lifecycle.command(context);

		expect(command).toContain("4500");
		expect(reported.map((entry) => entry.details)).toEqual([
			{
				seed: 777,
				size: 4500,
			},
		]);
		expect(JSON.stringify(reported)).not.toContain(PASSWORD);
	});
});
