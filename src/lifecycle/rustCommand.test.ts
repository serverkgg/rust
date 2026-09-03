import { describe, expect, test } from "bun:test";
import { RCON_HOST, type RustSettings, SERVER_IDENTITY } from "../shared";
import { startCommand } from "./rustCommand";

const settings: RustSettings = {
	hostname: "My Server",
	description: "the best one",
	maxPlayers: 120,
	worldSize: 4000,
	seed: 424_242,
	saveInterval: 300,
	pve: false,
};

const command = (overrides: Partial<RustSettings> = {}) => {
	return startCommand({
		gamePort: 28_015,
		queryPort: 28_017,
		rconPort: 28_016,
		rconPassword: "s3cret",
		settings: {
			...settings,
			...overrides,
		},
	});
};

const flagValue = (argv: string[], flag: string) => {
	return argv.at(argv.indexOf(flag) + 1);
};

describe("building the command that starts rust", () => {
	test("runs the dedicated server from the volume with no window", () => {
		const argv = command();

		expect(argv.at(0)).toBe("./RustDedicated");
		expect(argv).toContain("-batchmode");
		expect(argv).toContain("-nographics");
	});

	test("sends the log to stdout, which is the only place the panel console reads", () => {
		expect(flagValue(command(), "-logfile")).toBe("/dev/stdout");
	});

	test("listens on every interface, on the ports the manifest allocated", () => {
		const argv = command();

		expect(flagValue(argv, "+server.ip")).toBe("0.0.0.0");
		expect(flagValue(argv, "+server.port")).toBe("28015");
		expect(flagValue(argv, "+server.queryport")).toBe("28017");
	});

	test("honours the ports it was given rather than rust's defaults", () => {
		const argv = startCommand({
			gamePort: 28_061,
			queryPort: 28_161,
			rconPort: 28_016,
			rconPassword: "s3cret",
			settings,
		});

		expect(flagValue(argv, "+server.port")).toBe("28061");
		expect(flagValue(argv, "+server.queryport")).toBe("28161");
	});

	test("keeps rcon on loopback, because it is never a published port", () => {
		const argv = command();

		expect(flagValue(argv, "+rcon.ip")).toBe(RCON_HOST);
		expect(flagValue(argv, "+rcon.port")).toBe("28016");
		expect(flagValue(argv, "+rcon.password")).toBe("s3cret");
	});

	test("turns on the websocket rcon the driver speaks", () => {
		expect(flagValue(command(), "+rcon.web")).toBe("1");
	});

	test("always uses the identity the manifest and the driver agree on", () => {
		expect(flagValue(command(), "+server.identity")).toBe(SERVER_IDENTITY);
	});

	test("passes the settings a player saved in server.cfg", () => {
		const argv = command();

		expect(flagValue(argv, "+server.hostname")).toBe("My Server");
		expect(flagValue(argv, "+server.description")).toBe("the best one");
		expect(flagValue(argv, "+server.maxplayers")).toBe("120");
		expect(flagValue(argv, "+server.worldsize")).toBe("4000");
		expect(flagValue(argv, "+server.seed")).toBe("424242");
		expect(flagValue(argv, "+server.saveinterval")).toBe("300");
	});

	test("writes pve as the word rust reads", () => {
		expect(
			flagValue(
				command({
					pve: true,
				}),
				"+server.pve",
			),
		).toBe("true");

		expect(flagValue(command(), "+server.pve")).toBe("false");
	});

	test("passes a name with spaces as one argument, so no quoting is needed", () => {
		expect(
			command({
				hostname: 'the "best" server ever',
			}),
		).toContain('the "best" server ever');
	});

	test("passes an empty description as an empty argument rather than dropping the flag", () => {
		const argv = command({
			description: "",
		});

		expect(argv).toContain("+server.description");
		expect(flagValue(argv, "+server.description")).toBe("");
	});

	test("builds a fresh array each time, so one start cannot grow the next", () => {
		expect(command()).toEqual(command());
	});
});
