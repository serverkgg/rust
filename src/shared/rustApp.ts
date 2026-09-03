import type { Bridge } from "@serverkgg/bridge";

export const STEAM_APP_ID = "258550";

export const SERVER_BINARY = "RustDedicated";

export const SERVER_IDENTITY = "serverk";

export const IDENTITY_DIRECTORY = `server/${SERVER_IDENTITY}`;

export const CONFIG_DIRECTORY = `${IDENTITY_DIRECTORY}/cfg`;

export const SERVER_CFG = `${CONFIG_DIRECTORY}/server.cfg`;

export const APP_MANIFEST = `steamapps/appmanifest_${STEAM_APP_ID}.acf`;

export const SERVER_READY = /Server startup complete/;

export const isGameInstalled = async (context: Bridge.Context) => {
	return await context.files.exists(SERVER_BINARY);
};

const BUILD_ID = /"buildid"\s+"(?<buildId>\d+)"/;

export const buildIdOf = (manifest: string) => {
	return manifest.match(BUILD_ID)?.groups?.buildId ?? null;
};

export const installedBuildId = async (context: Bridge.Context) => {
	if (!(await context.files.exists(APP_MANIFEST))) {
		return null;
	}

	return buildIdOf(await context.files.read(APP_MANIFEST));
};
