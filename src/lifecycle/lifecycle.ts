import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { rconBindHost } from "@serverkgg/bridge/rcon";
import {
	consumeWipe,
	generateSeed,
	promoteRconPassword,
	quitServer,
	RCON_PORT,
	readInstallStamp,
	readSettings,
	releaseRcon,
	reportNewMap,
	roster,
	SERVER_READY,
	saveWorld,
	settingsOf,
} from "../shared";
import { startCommand } from "./rustCommand";

const STOP_TIMEOUT_SECONDS = 120;

export const lifecycle: Bridge.Lifecycle = {
	kind: BridgeKind.Lifecycle,
	ready: SERVER_READY,
	stopTimeoutSeconds: STOP_TIMEOUT_SECONDS,
	async command(context) {
		await consumeWipe(context);

		const stamp = await readInstallStamp(context);

		if (!stamp) {
			throw new BridgeUserError({
				ar: "لم يكتمل التثبيت بشكل صحيح. نفّذ ريستارت لسيرفرك ليعيد التثبيت.",
				en: "The install didn't finish cleanly. Restart your server to run it again.",
			});
		}

		const promoted = await promoteRconPassword(context, stamp);

		releaseRcon();

		const settings = settingsOf(await readSettings(context), generateSeed());

		await reportNewMap(context, settings);

		return startCommand({
			gamePort: context.port("game"),
			queryPort: context.port("query"),
			rconHost: rconBindHost(context),
			rconPort: RCON_PORT,
			rconPassword: promoted.rconPassword,
			settings,
		});
	},
	async onReady(context) {
		roster.clear();

		context.emit(BridgeEventName.ServerStarted);
	},
	async stop(context) {
		context.emit(BridgeEventName.ServerStopping);

		roster.clear();

		try {
			await saveWorld(context);
			await quitServer(context);
		} catch (error) {
			context.log.warn("rcon did not answer, stopping through the console instead", {
				error: error instanceof Error ? error.message : String(error),
			});

			await context.command("quit");
		} finally {
			releaseRcon();
		}
	},
};
