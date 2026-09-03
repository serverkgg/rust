import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import {
	generatePassword,
	installedBuildId,
	isGameInstalled,
	readStamp,
	SERVER_BINARY,
	STEAM_APP_ID,
	writeStamp,
} from "../shared";
import { seedConfig } from "./seedConfig";
import { linkSteamClient, prepareSteamcmd, updateGame } from "./steamcmd";

export const install: Bridge.Install = {
	kind: BridgeKind.Install,
	async run(context) {
		const stamp = await readStamp(context);
		const fresh = !(await isGameInstalled(context));

		await prepareSteamcmd(context);

		context.log(
			fresh ? "downloading the rust dedicated server, this one is a big one" : "checking steam for a newer build",
			{
				app: STEAM_APP_ID,
			},
		);

		await updateGame(context, fresh);

		if (!(await isGameInstalled(context))) {
			throw new Error(`steamcmd finished but ${SERVER_BINARY} is missing`);
		}

		await linkSteamClient(context);
		await seedConfig(context);

		const buildId = await installedBuildId(context);

		if (buildId !== null && stamp?.buildId !== null && stamp?.buildId !== undefined && stamp.buildId !== buildId) {
			context.log("the server updated to a newer steam build", {
				from: stamp.buildId,
				to: buildId,
			});
		}

		await writeStamp(context, {
			buildId,
			rconPassword: stamp?.rconPassword ?? generatePassword(),
		});

		context.log("install complete", {
			app: STEAM_APP_ID,
			build: buildId,
		});
	},
	async describe(context) {
		const stamp = await readStamp(context);

		return {
			version: stamp?.buildId ?? (await installedBuildId(context)),
			variant: null,
			build: null,
		};
	},
};
