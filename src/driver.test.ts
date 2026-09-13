import { describe, expect, test } from "bun:test";
import { BridgeFormTarget, BridgeKind, BridgeLayout, BridgePlace, BridgeSetupStepKind } from "@serverkgg/bridge";
import { GuideOpenTab } from "@serverkgg/bridge/guides";
import { INSTALL_STAMP_FILE } from "@serverkgg/bridge/install";
import { compileGlobs, matchesAny } from "@serverkgg/bridge/manifest";
import type { BridgeSection } from "@serverkgg/bridge/protocol";
import { isBridgeEventName } from "@serverkgg/bridge/protocol";
import { RCON_ACCESS_MODULE, RCON_ACCESS_PORT, RCON_ACCESS_VARIABLE } from "@serverkgg/bridge/rcon";
import { STEAM_DIRECTORY, STEAMAPPS_DIRECTORY, STEAMCMD_DIRECTORY } from "@serverkgg/bridge/steam";
import { banRow } from "./collections";
import { driver } from "./driver";
import {
	banCommand,
	GAME_ROOTS,
	IDENTITY_DIRECTORY,
	nameOf,
	parseBanList,
	parsePlayerList,
	presenceOf,
	RCON_PORT,
	SERVER_CFG,
	SERVER_IDENTITY,
	SETTING_FIELDS,
	WIPE_MARKER,
} from "./shared";

const placeOf = (section: BridgeSection | null | undefined) => {
	return section && "place" in section ? section.place : undefined;
};

interface Manifest {
	presence: {
		id: string;
		avatar: string;
		fields: {
			key: string;
		}[];
	};
	secrets: {
		key: string;
		required: boolean;
	}[];
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
			mirror?: boolean;
			hostRange: {
				default: number;
				min: number;
				max: number;
			};
			activeWhen?: {
				variable: string;
				values: string[];
			}[];
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
		except: string[];
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
				CurrentLevel: 34,
				Ping: 31,
				ConnectedSeconds: 60,
			},
		]),
	).at(0) ?? {},
);

const BAN_ROW = parseBanList('0 76561198000000001 "Meslzy" "Banned by an admin." -1').at(0);

const BAN_KEYS = Object.keys(BAN_ROW === undefined ? {} : banRow(BAN_ROW));

const PRESENCE = presenceOf({
	id: "76561198000000001",
	name: "Meslzy",
	level: 34,
	ping: 31,
	avatarHash: "a".repeat(40),
});

const tabOf = (id: string) => {
	return (driver.panel?.tabs ?? []).find((tab) => tab.id === id);
};

const sectionOf = (tabId: string, sectionId: string) => {
	return tabOf(tabId)?.sections.find((section) => section.id === sectionId);
};

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

	test("registers the settings, players, bans, live, wipes, health and remote access modules the tabs reference", () => {
		expect(Object.keys(modules)).toEqual([
			"settings",
			"players",
			"bans",
			"live",
			"wipes",
			"health",
			RCON_ACCESS_MODULE,
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

	test("shows the player, the level and the ping the panel promises", () => {
		expect(columnsOf("players")).toEqual([
			"name",
			"level",
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

const playerPorts = manifest.container.ports.filter((port) => port.key !== RCON_ACCESS_PORT);

const rconPort = manifest.container.ports.find((port) => port.key === RCON_ACCESS_PORT);

describe("the manifest and the driver agreeing on the ports", () => {
	test("declares the two player ports the start command reads back, then the remote access port", () => {
		expect(manifest.container.ports.map((port) => port.key)).toEqual([
			"game",
			"query",
			RCON_ACCESS_PORT,
		]);
	});

	test("publishes both player ports over udp, which is all rust speaks to players", () => {
		for (const port of playerPorts) {
			expect(port.protocol).toBe("udp");
		}
	});

	test("publishes the rcon port the driver binds, over tcp, only while the panel toggle is on", () => {
		expect(rconPort?.containerPort).toBe(RCON_PORT);
		expect(rconPort?.protocol).toBe("tcp");
		expect(rconPort?.activeWhen).toEqual([
			{
				variable: RCON_ACCESS_VARIABLE,
				values: [
					"true",
				],
			},
		]);
	});

	test("never mirrors the rcon port, because the driver always dials the container port", () => {
		expect(rconPort?.mirror ?? false).toBe(false);
	});

	test("declares every tcp container port once, so the rcon port collides with nothing", () => {
		const tcp = manifest.container.ports.filter((port) => port.protocol === "tcp").map((port) => port.containerPort);

		expect(new Set(tcp).size).toBe(tcp.length);
	});

	test("declares the remote access toggle in a form, which is what validate demands of activeWhen", () => {
		expect(fieldKeys).toContain(RCON_ACCESS_VARIABLE);
	});

	test("mirrors both player ports, because rust announces the ports it bound to the steam master server", () => {
		for (const port of playerPorts) {
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

	test("archives neither the map nor its occlusion cache, because both rebuild from the seed", () => {
		const excluded = (path: string) => matchesAny(path, compileGlobs(manifest.backup.except));

		expect(excluded(`${IDENTITY_DIRECTORY}/proceduralmap.3000.4242.221.map`)).toBe(true);
		expect(excluded(`${IDENTITY_DIRECTORY}/proceduralmap.3000.4242.221.288_occlusion_3.dat`)).toBe(true);
		expect(excluded(`${IDENTITY_DIRECTORY}/proceduralmap.3000.4242.221.sav`)).toBe(false);
		expect(excluded(SERVER_CFG)).toBe(false);
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

describe("placing the roster and the ban list on the platform's players page", () => {
	test("places every section of the players tab, so the tab leaves the sidebar", () => {
		expect((tabOf("players")?.sections ?? []).map((section) => placeOf(section))).toEqual([
			BridgePlace.Players,
			BridgePlace.Players,
		]);
	});

	test("keeps the players tab declared, because a guide still opens it by name", () => {
		expect(tabOf("players")).toBeDefined();
	});

	test("titles the roster tab the way every other game does", () => {
		expect(tabOf("players")?.title).toEqual({
			ar: "اللاعبين",
			en: "Players",
		});
	});

	test("offers the ban on a player who is no longer connected, and the kick only while they are", () => {
		const online = sectionOf("players", "online");
		const actions = online !== undefined && "actions" in online ? (online.actions ?? []) : [];

		expect(actions.find((action) => action.id === "ban")?.offline).toBe(true);
		expect(actions.find((action) => action.id === "kick")?.offline).toBeUndefined();
	});

	test("shows only columns the ban list carries", () => {
		for (const key of columnsOf("bans")) {
			expect(BAN_KEYS).toContain(key);
		}
	});

	test("shows the player, the steam id and the reason the ban was written with", () => {
		expect(columnsOf("bans")).toEqual([
			"name",
			"id",
			"reason",
		]);
	});

	test("offers a box to ban a steam id that never joined", () => {
		const section = sectionOf("players", "bans");

		expect(section !== undefined && "add" in section ? section.add?.placeholder : undefined).toBe("7656119…");
		expect(modules.bans !== undefined && "add" in modules.bans).toBe(true);
	});
});

describe("protecting the wipes with a recovery backup", () => {
	const wipes = modules.wipes;

	test("declares both wipes as protected, so the platform stores a recovery backup before either runs", () => {
		expect(wipes !== undefined && "protectedActions" in wipes ? wipes.protectedActions : undefined).toEqual([
			"map",
			"full",
		]);
	});

	test("leaves requiresRunning off, which the bridge demands of a module with protected actions", () => {
		expect(wipes !== undefined && "requiresRunning" in wipes ? wipes.requiresRunning : undefined).toBeFalsy();
	});

	test("protects only actions the module really declares", () => {
		const declared = wipes !== undefined && wipes.kind === BridgeKind.Actions ? Object.keys(wipes.actions) : [];

		for (const action of wipes !== undefined && "protectedActions" in wipes ? (wipes.protectedActions ?? []) : []) {
			expect(declared).toContain(action);
		}
	});

	test("offers a button for every protected wipe", () => {
		const section = sectionOf("controls", "wipe");
		const buttons = section !== undefined && "actions" in section ? (section.actions ?? []) : [];

		expect(buttons.map((action) => action.id)).toEqual([
			"map",
			"full",
		]);
	});
});

describe("explaining the roster and the health card", () => {
	test("gives the online roster and the health card a help line in both languages", () => {
		for (const [tab, id] of [
			[
				"players",
				"online",
			],
			[
				"controls",
				"health",
			],
		] as const) {
			const section = sectionOf(tab, id);
			const help = section !== undefined && "help" in section ? section.help : undefined;

			expect(help?.ar.length, id).toBeGreaterThan(0);
			expect(help?.en.length, id).toBeGreaterThan(0);
		}
	});
});

describe("placing the health card on the server overview", () => {
	test("places the health detail on the overview, beside the platform's own live numbers", () => {
		expect(placeOf(sectionOf("controls", "health"))).toBe(BridgePlace.Overview);
	});

	test("leads the controls tab with the health card", () => {
		expect(tabOf("controls")?.sections.at(0)?.id).toBe("health");
	});

	test("leaves the rest of the controls tab on its own page", () => {
		expect(
			(tabOf("controls")?.sections ?? []).filter((section) => placeOf(section) === undefined).length,
		).toBeGreaterThan(0);
	});
});

describe("explaining every settings form rust declares itself", () => {
	test("says in one sentence what the form does, in both languages", () => {
		for (const section of sections) {
			if (section.layout !== BridgeLayout.Form || section.target !== BridgeFormTarget.Settings) {
				continue;
			}

			expect(section.help?.ar.length).toBeGreaterThan(0);
			expect(section.help?.en.length).toBeGreaterThan(0);
		}
	});
});

describe("the manifest and the driver agreeing on the presence payload", () => {
	test("names the id key the roster rows are keyed by", () => {
		expect(manifest.presence.id).toBe("steamId");
		expect(Object.keys(PRESENCE)).toContain(manifest.presence.id);
	});

	test("declares only fields the presence payload really carries", () => {
		for (const field of manifest.presence.fields) {
			expect(Object.keys(PRESENCE)).toContain(field.key);
		}
	});

	test("builds the avatar url out of the hash the roster resolves", () => {
		expect(manifest.presence.avatar).toContain("{avatarHash}");
		expect(Object.keys(PRESENCE)).toContain("avatarHash");
	});

	test("asks for the steam key the avatars need without ever requiring it", () => {
		const secret = manifest.secrets.find((entry) => entry.key === "STEAM_WEB_API_KEY");

		expect(secret).toBeDefined();
		expect(secret?.required).toBe(false);
	});
});
