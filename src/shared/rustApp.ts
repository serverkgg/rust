export const STEAM_APP_ID = "258550";

export const SERVER_BINARY = "RustDedicated";

export const GAME_ROOTS = [
	SERVER_BINARY,
	"RustDedicated_Data",
	"Bundles",
];

export const SERVER_IDENTITY = "serverk";

export const IDENTITY_DIRECTORY = `server/${SERVER_IDENTITY}`;

export const CONFIG_DIRECTORY = `${IDENTITY_DIRECTORY}/cfg`;

export const SERVER_CFG = `${CONFIG_DIRECTORY}/server.cfg`;

export const SERVER_READY = /Server startup complete/;
