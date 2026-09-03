import { describe, expect, test } from "bun:test";
import { BridgeLayout } from "@serverkgg/bridge";
import { isBridgeEventName } from "@serverkgg/bridge/protocol";
import { driver } from "./driver";
import { parsePlayerList, RCON_PORT, SERVER_CFG, SERVER_IDENTITY, STAMP_FILE, WIPE_MARKER } from "./shared";

interface Manifest {
	container: {
		ports: {
			key: string;
			containerPort: number;
			protocol: string;
			hostRange: {
				default: number;
				min: number;
				max: number;
			};
		}[];
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

	test("keeps the two host ranges apart, so one server never takes the other's port", () => {
		const [game, query] = manifest.container.ports;

		expect(game?.hostRange.max).toBeLessThan(query?.hostRange.min ?? 0);
	});
});

describe("the manifest guarding the files the driver depends on", () => {
	test("protects the stamp the rcon password lives in", () => {
		expect(manifest.files.protected).toContain(STAMP_FILE);
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
