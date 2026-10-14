import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { IDENTITY_DIRECTORY, WipeKind } from "../shared";
import { NO_MAP, NO_MAP_OR_PLAYERS, wipes } from "./wipe";

const map = [
	`${IDENTITY_DIRECTORY}/proceduralmap.3000.4242.221.map`,
	`${IDENTITY_DIRECTORY}/proceduralmap.3000.4242.221.sav`,
];

const player = [
	`${IDENTITY_DIRECTORY}/player.blueprints.5.db`,
	`${IDENTITY_DIRECTORY}/player.identities.5.db`,
];

const config = [
	`${IDENTITY_DIRECTORY}/cfg/server.cfg`,
];

const identityWith = (paths: string[]) => {
	const globs: string[] = [];

	const context = {
		files: {
			async list(glob: string) {
				globs.push(glob);

				return [
					{
						path: `${IDENTITY_DIRECTORY}/cfg`,
						directory: true,
					},
					...paths.map((path) => {
						return {
							path,
							directory: false,
						};
					}),
				];
			},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		globs,
	};
};

const unavailableOf = async (paths: string[]) => {
	const { context } = identityWith(paths);

	return await wipes.unavailable?.(context);
};

describe("offering a wipe only when it has something to delete", () => {
	it("offers both wipes on a server that has a map and player data", async () => {
		expect(
			await unavailableOf([
				...map,
				...player,
			]),
		).toEqual({});
	});

	it("offers only the full wipe after a map wipe, while the player data waits for the next start", async () => {
		expect(await unavailableOf(player)).toEqual({
			[WipeKind.Map]: NO_MAP,
		});
	});

	it("offers neither wipe before the server built its first map, and never counts the config as something to wipe", async () => {
		expect(await unavailableOf(config)).toEqual({
			[WipeKind.Map]: NO_MAP,
			[WipeKind.Full]: NO_MAP_OR_PLAYERS,
		});
	});

	it("reads the same serverk identity the wipe deletes from", async () => {
		const { context, globs } = identityWith(map);

		await wipes.unavailable?.(context);

		expect(globs).toEqual([
			`${IDENTITY_DIRECTORY}/*`,
		]);
	});
});
