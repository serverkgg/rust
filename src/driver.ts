import type { BridgeDriver } from "@serverkgg/bridge";
import { RCON_ACCESS_MODULE } from "@serverkgg/bridge/rcon";
import { rconAccess } from "./access";
import { live, wipes } from "./actions";
import { announce } from "./announce";
import { backup } from "./backup";
import { bans, players } from "./collections";
import { health } from "./details";
import { events } from "./events";
import { install } from "./install";
import { lifecycle } from "./lifecycle";
import { panel } from "./panel";
import { query } from "./query";
import { settings } from "./settings";
import { setup } from "./setup";
import { terminal } from "./terminal";

export const driver: BridgeDriver = {
	install,
	lifecycle,
	events,
	query,
	backup,
	announce,
	setup,
	terminal,
	panel,
	modules: {
		settings,
		players,
		bans,
		live,
		wipes,
		health,
		[RCON_ACCESS_MODULE]: rconAccess,
	},
};
