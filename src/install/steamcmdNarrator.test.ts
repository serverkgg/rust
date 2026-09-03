import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { steamcmdNarrator } from "./steamcmdNarrator";

interface Line {
	message: string;
	fields: Bridge.Values;
}

const narrateAll = (lines: string[]) => {
	const said: Line[] = [];

	const narrate = steamcmdNarrator((message, fields) => {
		said.push({
			message,
			fields: fields ?? {},
		});
	});

	for (const line of lines) {
		narrate(line);
	}

	return said;
};

const downloading = (percent: string) => {
	return `Update state (0x61) downloading, progress: ${percent} (1234 / 5678)`;
};

const ESCAPE = String.fromCharCode(27);

describe("narrating a steamcmd download to the install log", () => {
	test("reports the phase and the percentage step", () => {
		expect(
			narrateAll([
				downloading("12.34"),
			]),
		).toEqual([
			{
				message: "downloading rust",
				fields: {
					percent: 10,
				},
			},
		]);
	});

	test("rounds down to a ten-percent step so the log does not flood", () => {
		expect(
			narrateAll([
				downloading("0.10"),
				downloading("4.00"),
				downloading("9.99"),
			]),
		).toHaveLength(1);
	});

	test("says something again once the download crosses the next step", () => {
		expect(
			narrateAll([
				downloading("5.00"),
				downloading("15.00"),
				downloading("25.00"),
			]).map((line) => line.fields.percent),
		).toEqual([
			0,
			10,
			20,
		]);
	});

	test("never walks the percentage backwards when steamcmd re-reports a lower value", () => {
		expect(
			narrateAll([
				downloading("55.00"),
				downloading("22.00"),
				downloading("51.00"),
			]).map((line) => line.fields.percent),
		).toEqual([
			50,
		]);
	});

	test("restarts the percentage when steamcmd moves to a new phase", () => {
		expect(
			narrateAll([
				downloading("90.00"),
				"Update state (0x81) verifying update, progress: 5.00 (1 / 2)",
			]),
		).toEqual([
			{
				message: "downloading rust",
				fields: {
					percent: 90,
				},
			},
			{
				message: "verifying update rust",
				fields: {
					percent: 0,
				},
			},
		]);
	});

	test("strips the colour codes steamcmd writes to a tty", () => {
		expect(
			narrateAll([
				`${ESCAPE}[1;32mSuccess! App '258550' fully installed.${ESCAPE}[0m`,
			]),
		).toEqual([
			{
				message: "Success! App '258550' fully installed.",
				fields: {},
			},
		]);
	});

	test("passes through the lines an operator needs to see", () => {
		expect(
			narrateAll([
				"Logging in user to Steam Public...",
				"Connecting anonymously to Steam Public...",
				"Success! App '258550' fully installed.",
				"Error! App '258550' state is 0x202 after update job.",
				"Warning: failed to init SDL thread priority manager",
				"Failed to load cached data",
			]),
		).toHaveLength(6);
	});

	test("stays quiet about the noise in between", () => {
		expect(
			narrateAll([
				"Redirecting stderr to '/home/steam/.steam/logs/stderr.txt'",
				"[  0%] Checking for available updates...",
				"",
				" ",
				"Loading Steam API...OK",
			]),
		).toEqual([]);
	});

	test("trims the line before logging it", () => {
		expect(
			narrateAll([
				"   Success! App '258550' fully installed.   \n",
			]).at(0)?.message,
		).toBe("Success! App '258550' fully installed.");
	});
});
