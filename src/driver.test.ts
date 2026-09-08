import { describe, expect, test } from "bun:test";
import { BridgeLayout, BridgeSetupStepKind } from "@serverkgg/bridge";
import { GuideOpenTab } from "@serverkgg/bridge/guides";
import { INSTALL_STAMP_FILE } from "@serverkgg/bridge/install";
import { isBridgeEventName } from "@serverkgg/bridge/protocol";
import { STEAM_DIRECTORY, STEAMAPPS_DIRECTORY, STEAMCMD_DIRECTORY } from "@serverkgg/bridge/steam";
import { driver } from "./driver";
import {
	banCommand,
	GAME_ROOTS,
	nameOf,
	parsePlayerList,
	RCON_PORT,
	SERVER_CFG,
	SERVER_IDENTITY,
	SETTING_FIELDS,
	WIPE_MARKER,
} from "./shared";

interface Manifest {
	container: {
		runtime: {
			platform: string;
			installBudgetMinutes: number;
			bootBudgetMinutes: number;
		};
		ports: {
			key: string;
			containerPort: number;
			protocol: string;
			mirror: boolean;
			hostRange: {
				default: number;
				min: number;
				max: number;
			};
		}[];
	};
	reset: {
		keep: string[];
	};
	files: {
		protected: string[];
		notable: {
			match: string;
		}[];
	};
	backup: {
		only: string[];
	};
}

const manifest = Bun.YAML.parse(await Bun.file(new URL("../serverk.yml", import.meta.url)).text()) as Manifest;

const modules = driver.modules ?? {};

const sections = (driver.panel?.tabs ?? []).flatMap((tab) => tab.sections);

const tables = sections.flatMap((section) => {
	return section.layout === BridgeLayout.Table
		? [
				section,
			]
		: [];
});

const args = (driver.terminal?.commands ?? []).flatMap((command) => command.args ?? []);

const columnsOf = (module: string) => {
	return tables
		.filter((table) => table.module === module)
		.flatMap((table) => table.columns.map((column) => column.key));
};

const ROSTER_KEYS = Object.keys(
	parsePlayerList(
		JSON.stringify([
			{
				SteamID: "76561198000000001",
				DisplayName: "Meslzy",
				Ping: 31,
				ConnectedSeconds: 60,
			},
		]),
	).at(0) ?? {},
);

describe("assembling the rust driver", () => {
	test("declares every capability the panel and the platform depend on", () => {
		expect(driver.install).toBeDefined();
		expect(driver.lifecycle).toBeDefined();
		expect(driver.events).toBeDefined();
		expect(driver.query).toBeDefined();
		expect(driver.backup).toBeDefined();
		expect(driver.announce).toBeDefined();
		expect(driver.terminal).toBeDefined();
		expect(driver.panel).toBeDefined();
	});

	test("registers the settings, players, live and wipes modules the tabs reference", () => {
		expect(Object.keys(modules)).toEqual([
			"settings",
			"players",
			"live",
			"wipes",
		]);
	});

	test("registers every module the panel binds a section to", () => {
		for (const section of sections) {
			if (section.layout !== BridgeLayout.Form) {
				expect(Object.keys(modules)).toContain(section.module);
			}
		}
	});
});

describe("declaring the events the platform is allowed to act on", () => {
	test("raises every event from code, because rust's log carries none of them", () => {
		expect(driver.events?.patterns).toEqual([]);
		expect(driver.events?.emits?.length).toBeGreaterThan(0);
	});

	test("names only events the platform's taxonomy knows, so none are dropped", () => {
		for (const name of driver.events?.emits ?? []) {
			expect(isBridgeEventName(name)).toBe(true);
		}
	});
});

describe("wiring the players table to the roster the collection returns", () => {
	test("shows only columns the roster carries", () => {
		for (const key of columnsOf("players")) {
			expect(ROSTER_KEYS).toContain(key);
		}
	});

	test("shows the player and the ping the panel promises", () => {
		expect(columnsOf("players")).toEqual([
			"name",
			"ping",
		]);
	});
});

describe("naming the player a ban records", () => {
	test("bans by steam id and records the name the roster carries", () => {
		expect(
			banCommand(
				"76561198000000001",
				nameOf({
					id: "76561198000000001",
					name: "Meslzy",
				}),
			),
		).toBe('banid "76561198000000001" "Meslzy" "Banned by an admin."');
	});

	test("falls back to the steam id when the row carries no name, so the ban still reads back", () => {
		expect(
			banCommand(
				"76561198000000001",
				nameOf({
					id: "76561198000000001",
					name: "",
				}),
			),
		).toBe('banid "76561198000000001" "76561198000000001" "Banned by an admin."');
	});
});

describe("wiring the terminal autocomplete to the live roster", () => {
	test("completes every argument from a module the driver actually registers", () => {
		for (const arg of args) {
			expect(Object.keys(modules)).toContain(arg.module ?? "");
		}
	});

	test("completes every argument from a column that module's table shows", () => {
		for (const arg of args) {
			expect(columnsOf(arg.module ?? "")).toContain(arg.column ?? "");
		}
	});

	test("completes every argument from a field the roster really carries", () => {
		for (const arg of args) {
			expect(ROSTER_KEYS).toContain(arg.column ?? "");
		}
	});
});

describe("the manifest and the driver agreeing on the ports", () => {
	test("declares the two ports the start command reads back", () => {
		expect(manifest.container.ports.map((port) => port.key)).toEqual([
			"game",
			"query",
		]);
	});

	test("publishes both ports over udp, which is all rust speaks", () => {
		for (const port of manifest.container.ports) {
			expect(port.protocol).toBe("udp");
		}
	});

	test("never publishes the rcon port, because the driver reaches it over loopback", () => {
		for (const port of manifest.container.ports) {
			expect(port.containerPort).not.toBe(RCON_PORT);
		}
	});

	test("mirrors both ports, because rust announces the ports it bound to the steam master server", () => {
		for (const port of manifest.container.ports) {
			expect(port.mirror).toBe(true);
		}
	});

	test("keeps the two host ranges apart, so one server never takes the other's port", () => {
		const [game, query] = manifest.container.ports;

		expect(game?.hostRange.max).toBeLessThan(query?.hostRange.min ?? 0);
	});
});

describe("declaring how the container is built and how long it is waited on", () => {
	test("runs a linux payload, so the manifest declares no wine runtime", () => {
		expect(manifest.container.runtime.platform).toBe("linux");
	});

	test("waits long enough for the steam download, which is the slowest thing a rust install does", () => {
		expect(manifest.container.runtime.installBudgetMinutes).toBeGreaterThanOrEqual(
			manifest.container.runtime.bootBudgetMinutes,
		);
	});
});

describe("the manifest guarding the files the driver depends on", () => {
	test("protects the stamp the rcon password lives in", () => {
		expect(manifest.files.protected).toContain(INSTALL_STAMP_FILE);
	});

	test("hides the steam directories from the file manager, so nobody deletes them by hand", () => {
		expect(manifest.files.protected).toContain(STEAMCMD_DIRECTORY);
		expect(manifest.files.protected).toContain(STEAM_DIRECTORY);
	});

	test("keeps the steam install through a reset, so a reset never re-downloads twenty gigabytes", () => {
		for (const path of [
			STEAMCMD_DIRECTORY,
			STEAM_DIRECTORY,
			STEAMAPPS_DIRECTORY,
			...GAME_ROOTS,
		]) {
			expect(manifest.reset.keep).toContain(path);
		}
	});

	test("protects the wipe marker, so nobody wipes a server by dropping a file", () => {
		expect(manifest.files.protected).toContain(WIPE_MARKER);
	});

	test("annotates the settings file the settings tab writes", () => {
		expect(manifest.files.notable.map((note) => note.match)).toContain(SERVER_CFG);
	});

	test("backs up the identity directory the settings and the save live in", () => {
		expect(manifest.backup.only).toContain(`server/**`);
		expect(SERVER_CFG.startsWith(`server/${SERVER_IDENTITY}/`)).toBe(true);
	});
});

const PANEL_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

const fieldKeys = sections.flatMap((section) => {
	const own = section.layout === BridgeLayout.Form ? section.fields : [];
	const actions = "actions" in section ? (section.actions ?? []) : [];

	return [
		...own,
		...actions.flatMap((action) => action.fields ?? []),
	].map((field) => field.key);
});

describe("keeping every panel key inside what the wire protocol accepts", () => {
	test("names no field with a character the agent's manifest schema rejects", () => {
		for (const key of fieldKeys) {
			expect(key).toMatch(PANEL_KEY_PATTERN);
		}
	});

	test("names no table column the wire would reject either", () => {
		for (const table of tables) {
			for (const column of table.columns) {
				expect(column.key).toMatch(PANEL_KEY_PATTERN);
			}
		}
	});

	test("declares a field for every settings key the driver maps", () => {
		for (const field of Object.keys(SETTING_FIELDS)) {
			expect(fieldKeys).toContain(field);
		}
	});
});

const steps = driver.setup?.steps ?? [];

const formSection = (tabId: string, sectionId: string) => {
	const tab = (driver.panel?.tabs ?? []).find((entry) => entry.id === tabId);
	const section = tab?.sections.find((entry) => entry.id === sectionId);

	return section?.layout === BridgeLayout.Form ? section : null;
};

describe("walking the customer through the first run", () => {
	test("settles the map before the name, because the map is the choice that cannot be undone", () => {
		expect(steps.map((step) => step.id)).toEqual([
			"world",
			"name",
			"invite",
		]);
	});

	test("blocks nothing, because a fresh rust server already runs", () => {
		expect(steps.filter((step) => step.required !== false)).toEqual([]);
	});

	test("needs no driver step, so the setup declares no submit", () => {
		expect(steps.filter((step) => step.kind === BridgeSetupStepKind.Driver)).toEqual([]);
		expect(driver.setup?.submit).toBeUndefined();
	});

	test("points every form step at a form section the panel really declares", () => {
		for (const step of steps) {
			if (step.kind !== BridgeSetupStepKind.Form) {
				continue;
			}

			expect(formSection(step.tab, step.section)).not.toBeNull();
		}
	});

	test("names only fields that section really carries", () => {
		for (const step of steps) {
			if (step.kind !== BridgeSetupStepKind.Form) {
				continue;
			}

			const keys = (formSection(step.tab, step.section)?.fields ?? []).map((field) => field.key);

			for (const key of step.fields ?? []) {
				expect(keys).toContain(key);
			}
		}
	});

	test("sends the invite step to the access page, where the address lives", () => {
		const invite = steps.find((step) => step.id === "invite");

		expect(invite?.kind === BridgeSetupStepKind.Open && invite.target.tab).toBe(GuideOpenTab.Access);
	});

	test("titles and explains every step in both arabic and english", () => {
		for (const step of steps) {
			expect(step.title.ar.length).toBeGreaterThan(0);
			expect(step.title.en.length).toBeGreaterThan(0);
			expect(step.help?.ar.length).toBeGreaterThan(0);
			expect(step.help?.en.length).toBeGreaterThan(0);
		}
	});

	test("keeps the setup singleton out of the panel modules, because its id is reserved", () => {
		expect(Object.keys(driver.modules ?? {})).not.toContain("setup");
	});
});
