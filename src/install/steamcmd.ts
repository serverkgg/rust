import type { Bridge } from "@serverkgg/bridge";
import { STEAM_APP_ID } from "../shared";
import { steamcmdNarrator } from "./steamcmdNarrator";

export const STEAMCMD_DIRECTORY = ".steamcmd";

export const STEAM_DIRECTORY = ".steam";

const STEAMCMD_SCRIPT = `${STEAMCMD_DIRECTORY}/steamcmd.sh`;

const STEAMCMD_IMAGE = "/opt/steamcmd";

const STEAM_CLIENT_DIRECTORY = `${STEAM_DIRECTORY}/sdk64`;

const UPDATE_TIMEOUT_MS = 3_600_000;

const BOOTSTRAP_TIMEOUT_MS = 300_000;

const UPDATE_ATTEMPTS = 3;

const RETRY_DELAY_MS = 5000;

const FAILURE_DETAIL = 800;

const tail = (text: string) => {
	return text.trim().slice(-FAILURE_DETAIL);
};

export const execDetail = (result: Bridge.ExecResult) => {
	return [
		tail(result.stdout),
		tail(result.stderr),
	]
		.filter((part) => part.length > 0)
		.join(" | ");
};

export const updateCommand = (root: string, validate: boolean) => {
	const command = [
		`./${STEAMCMD_SCRIPT}`,
		"+force_install_dir",
		root,
		"+login",
		"anonymous",
		"+app_update",
		STEAM_APP_ID,
	];

	if (validate) {
		command.push("validate");
	}

	command.push("+quit");

	return command;
};

export const gameRoot = async (context: Bridge.Context) => {
	const result = await context.exec([
		"pwd",
	]);

	if (result.code !== 0) {
		throw new Error(`the server directory could not be resolved — ${execDetail(result)}`);
	}

	return result.stdout.trim();
};

export const prepareSteamcmd = async (context: Bridge.Context) => {
	if (await context.files.exists(STEAMCMD_SCRIPT)) {
		return;
	}

	context.log("preparing steamcmd");

	await context.files.ensure(STEAMCMD_DIRECTORY);

	const result = await context.exec([
		"cp",
		"-a",
		`${STEAMCMD_IMAGE}/.`,
		STEAMCMD_DIRECTORY,
	]);

	if (result.code !== 0) {
		throw new Error(`steamcmd could not be prepared — ${execDetail(result)}`);
	}

	context.log("warming up steamcmd");

	const bootstrap = await context.exec(
		[
			`./${STEAMCMD_SCRIPT}`,
			"+login",
			"anonymous",
			"+app_info_update",
			"1",
			"+app_info_print",
			STEAM_APP_ID,
			"+quit",
		],
		{
			timeoutMs: BOOTSTRAP_TIMEOUT_MS,
		},
	);

	if (bootstrap.code !== 0) {
		context.log("steamcmd warm-up did not finish cleanly, continuing", {
			code: bootstrap.code,
		});
	}
};

export const updateGame = async (context: Bridge.Context, validate: boolean) => {
	const command = updateCommand(await gameRoot(context), validate);

	let failure = "";

	for (let attempt = 1; attempt <= UPDATE_ATTEMPTS; attempt++) {
		const result = await context.exec(command, {
			timeoutMs: UPDATE_TIMEOUT_MS,
			onOutput: steamcmdNarrator(context.log),
		});

		if (result.code === 0) {
			return;
		}

		failure = `steamcmd exited with code ${result.code} — ${execDetail(result)}`;

		if (attempt < UPDATE_ATTEMPTS) {
			context.log("steamcmd did not finish, trying again", {
				attempt,
				of: UPDATE_ATTEMPTS,
				code: result.code,
			});

			await Bun.sleep(RETRY_DELAY_MS);
		}
	}

	throw new Error(failure);
};

export const linkSteamClient = async (context: Bridge.Context) => {
	await context.files.ensure(STEAM_CLIENT_DIRECTORY);

	const result = await context.exec([
		"cp",
		"-f",
		`${STEAMCMD_DIRECTORY}/linux64/steamclient.so`,
		`${STEAM_CLIENT_DIRECTORY}/steamclient.so`,
	]);

	if (result.code !== 0) {
		throw new Error(`steamclient.so could not be linked — ${execDetail(result)}`);
	}
};
