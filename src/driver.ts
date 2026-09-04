import type { BridgeDriver } from "@serverkgg/bridge";
import { live, wipes } from "./actions";
import { announce } from "./announce";
import { backup } from "./backup";
import { players } from "./collections";
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
		live,
		wipes,
	},
};
