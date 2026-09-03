import { describe, expect, test } from "bun:test";
import { decodeValue, encodeValue, mergeServerCfg, parseServerCfg, readEntry } from "./serverCfg";

describe("reading one line of server.cfg", () => {
	test("splits a convar from its value", () => {
		expect(readEntry('server.hostname "My Server"')).toEqual({
			key: "server.hostname",
			value: '"My Server"',
		});
	});

	test("accepts a convar with no value at all", () => {
		expect(readEntry("server.save")).toEqual({
			key: "server.save",
			value: "",
		});
	});

	test("tolerates the tabs and padding a player leaves behind", () => {
		expect(readEntry("\t server.maxplayers \t 50 \t")).toEqual({
			key: "server.maxplayers",
			value: "50",
		});
	});

	test("ignores blank lines and both comment styles rust tolerates", () => {
		for (const line of [
			"",
			"   ",
			"// the map",
			"# the map",
		]) {
			expect(readEntry(line)).toBeNull();
		}
	});

	test("ignores a line that does not start with a convar name", () => {
		expect(readEntry('"server.hostname" value')).toBeNull();
	});
});

describe("decoding a value rust wrote", () => {
	test("unquotes a quoted string", () => {
		expect(decodeValue('"My Server"')).toBe("My Server");
	});

	test("unescapes the quotes inside a quoted string", () => {
		expect(decodeValue('"say \\"hi\\""')).toBe('say "hi"');
	});

	test("reads a whole number as a number, so the panel renders a number field", () => {
		expect(decodeValue("3000")).toBe(3000);
	});

	test("reads true and false as booleans, so the panel renders a switch", () => {
		expect(decodeValue("true")).toBe(true);
		expect(decodeValue("false")).toBe(false);
	});

	test("keeps a bare word as text", () => {
		expect(decodeValue("Procedural")).toBe("Procedural");
	});

	test("keeps a quoted number as text, because the player quoted it on purpose", () => {
		expect(decodeValue('"3000"')).toBe("3000");
	});

	test("keeps an empty value empty", () => {
		expect(decodeValue("")).toBe("");
		expect(decodeValue('""')).toBe("");
	});
});

describe("encoding a value the panel submitted", () => {
	test("quotes text, so a name with spaces survives", () => {
		expect(encodeValue("My Server")).toBe('"My Server"');
	});

	test("escapes the quotes a player typed inside a name", () => {
		expect(encodeValue('the "best" server')).toBe('"the \\"best\\" server"');
	});

	test("flattens a pasted multi-line description onto one line", () => {
		expect(encodeValue("first\nsecond")).toBe('"first second"');
	});

	test("writes numbers bare, the way rust reads them", () => {
		expect(encodeValue(4500)).toBe("4500");
	});

	test("writes booleans as true and false", () => {
		expect(encodeValue(true)).toBe("true");
		expect(encodeValue(false)).toBe("false");
	});

	test("writes an empty string for a value the panel cleared", () => {
		expect(encodeValue(null)).toBe('""');
	});
});

describe("parsing a whole server.cfg", () => {
	test("reads every convar the file declares", () => {
		expect(
			parseServerCfg(
				[
					'server.hostname "My Server"',
					"server.maxplayers 50",
					"server.pve false",
					"",
				].join("\n"),
			),
		).toEqual({
			"server.hostname": "My Server",
			"server.maxplayers": 50,
			"server.pve": false,
		});
	});

	test("reads an empty file as no settings at all, instead of throwing", () => {
		expect(parseServerCfg("")).toEqual({});
	});

	test("takes the last value when a convar is written twice", () => {
		expect(parseServerCfg("server.maxplayers 50\nserver.maxplayers 100")).toEqual({
			"server.maxplayers": 100,
		});
	});
});

describe("writing settings back into server.cfg", () => {
	test("rewrites only the convars it was given", () => {
		expect(
			mergeServerCfg('server.hostname "old"\nserver.maxplayers 50\n', {
				"server.hostname": "new",
			}),
		).toBe('server.hostname "new"\nserver.maxplayers 50\n');
	});

	test("keeps the comments and the order a player left in the file", () => {
		expect(
			mergeServerCfg('// my rules\nserver.hostname "old"\n\nserver.pve false\n', {
				"server.pve": true,
			}),
		).toBe('// my rules\nserver.hostname "old"\n\nserver.pve true\n');
	});

	test("appends a convar the file never had", () => {
		expect(
			mergeServerCfg('server.hostname "old"\n', {
				"server.seed": 4242,
			}),
		).toBe('server.hostname "old"\nserver.seed 4242\n');
	});

	test("seeds an empty file without leaving a blank first line", () => {
		expect(
			mergeServerCfg("", {
				"server.hostname": "new",
			}),
		).toBe('server.hostname "new"\n');
	});

	test("collapses a convar the file declared twice into one line", () => {
		expect(
			mergeServerCfg("server.maxplayers 50\nserver.maxplayers 100\n", {
				"server.maxplayers": 75,
			}),
		).toBe("server.maxplayers 75\n");
	});

	test("always ends the file with exactly one newline", () => {
		const written = mergeServerCfg("server.maxplayers 50\n\n\n", {
			"server.seed": 1,
		});

		expect(written).toEndWith("\n");
		expect(written).not.toEndWith("\n\n");
	});

	test("round-trips what it wrote, so the panel reads back what the player saved", () => {
		const values = {
			"server.hostname": 'the "best" server',
			"server.maxplayers": 120,
			"server.pve": true,
			"server.seed": 987_654,
		};

		expect(parseServerCfg(mergeServerCfg("", values))).toEqual(values);
	});
});
