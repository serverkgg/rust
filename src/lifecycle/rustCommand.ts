import { RCON_HOST, type RustSettings, SERVER_BINARY, SERVER_IDENTITY } from "../shared";

export const SERVER_LEVEL = "Procedural Map";

export const SERVER_TICKRATE = 30;

export interface RustCommandInput {
	gamePort: number;
	queryPort: number;
	rconPort: number;
	rconPassword: string;
	settings: RustSettings;
}

export const startCommand = (input: RustCommandInput): string[] => {
	const { settings } = input;

	return [
		`./${SERVER_BINARY}`,
		"-batchmode",
		"-nographics",
		"+server.ip",
		"0.0.0.0",
		"+server.port",
		String(input.gamePort),
		"+server.queryport",
		String(input.queryPort),
		"+server.identity",
		SERVER_IDENTITY,
		"+server.level",
		SERVER_LEVEL,
		"+server.tickrate",
		String(SERVER_TICKRATE),
		"+server.hostname",
		settings.hostname,
		"+server.description",
		settings.description,
		"+server.maxplayers",
		String(settings.maxPlayers),
		"+server.worldsize",
		String(settings.worldSize),
		"+server.seed",
		String(settings.seed),
		"+server.saveinterval",
		String(settings.saveInterval),
		"+server.pve",
		settings.pve ? "true" : "false",
		"+rcon.ip",
		RCON_HOST,
		"+rcon.port",
		String(input.rconPort),
		"+rcon.password",
		input.rconPassword,
		"+rcon.web",
		"1",
		"-logfile",
	];
};
