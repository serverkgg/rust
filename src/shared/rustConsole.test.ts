import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { awaitSaveComplete, SAVE_COMPLETE } from "./rustConsole";

const fakeLogs = () => {
	const followers = new Set<(line: string) => void>();

	const context = {
		logs: {
			follow(pattern: RegExp, onMatch: (match: RegExpMatchArray) => void) {
				const follower = (line: string) => {
					const match = line.match(pattern);

					if (match) {
						onMatch(match);
					}
				};

				followers.add(follower);

				return () => {
					followers.delete(follower);
				};
			},
		},
		activity: {
			report() {},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		followers,
		print(line: string) {
			for (const follower of followers) {
				follower(line);
			}
		},
	};
};

describe("recognising the line rust prints once a save reached the disk", () => {
	it("reads the save line with cache, write and disk timings", () => {
		expect(SAVE_COMPLETE.test("Saved 53,734 ents, cache(0.15), write(0.02), disk(0.01).")).toBe(true);
	});

	it("reads the save line with serialization and stall timings", () => {
		expect(
			SAVE_COMPLETE.test("Saved 17,879 ents, serialization (0.00), write (0.00), disk (0.01) totalstall (0.01)."),
		).toBe(true);
	});

	it("reads the save line when the console indents it", () => {
		expect(SAVE_COMPLETE.test("  Saved 53,734 ents, cache(0.15), write(0.02), disk(0.01).")).toBe(true);
	});

	it("does not take a player typing the save line in chat for a real save", () => {
		expect(SAVE_COMPLETE.test("[CHAT] Meslzy[76561198000000000] : Saved 1 ents, cache(0.01)")).toBe(false);
		expect(SAVE_COMPLETE.test("[CHAT] Meslzy : Saved 1 ents")).toBe(false);
	});

	it("does not take the start of a save for its end", () => {
		expect(SAVE_COMPLETE.test("Saving complete")).toBe(false);
		expect(SAVE_COMPLETE.test("[SAVE] Saving 53734 entities")).toBe(false);
	});
});

describe("waiting for rust to finish a save before a backup copies the world", () => {
	it("confirms the save once rust prints the line", async () => {
		const logs = fakeLogs();

		const confirmed = awaitSaveComplete(
			logs.context,
			async () => {
				setTimeout(() => {
					logs.print("Saved 53,734 ents, cache(0.15), write(0.02), disk(0.01).");
				}, 5);
			},
			1000,
		);

		expect(await confirmed).toBe(true);
	});

	it("listens before asking for the save, so a save that finishes inside the command still counts", async () => {
		const logs = fakeLogs();

		expect(
			await awaitSaveComplete(
				logs.context,
				async () => {
					logs.print("Saved 1,024 ents, cache(0.01), write(0.01), disk(0.01).");
				},
				1000,
			),
		).toBe(true);
	});

	it("gives up after the timeout instead of holding the backup forever", async () => {
		const logs = fakeLogs();
		const started = performance.now();

		expect(await awaitSaveComplete(logs.context, async () => {}, 30)).toBe(false);
		expect(performance.now() - started).toBeGreaterThanOrEqual(25);
	});

	it("ignores console noise that is not the save line", async () => {
		const logs = fakeLogs();

		expect(
			await awaitSaveComplete(
				logs.context,
				async () => {
					logs.print("Saving complete");
					logs.print("Meslzy joined");
				},
				30,
			),
		).toBe(false);
	});

	it("keeps waiting when a player echoes the save line in chat during the save", async () => {
		const logs = fakeLogs();

		expect(
			await awaitSaveComplete(
				logs.context,
				async () => {
					logs.print("[CHAT] Meslzy[76561198000000000] : Saved 1 ents, cache(0.01)");
				},
				30,
			),
		).toBe(false);
	});

	it("stops listening once the wait is over", async () => {
		const logs = fakeLogs();

		await awaitSaveComplete(logs.context, async () => {}, 10);

		expect(logs.followers.size).toBe(0);
	});

	it("surfaces a save rcon refused and stops listening", async () => {
		const logs = fakeLogs();

		await expect(
			awaitSaveComplete(
				logs.context,
				async () => {
					throw new Error("rcon is down");
				},
				1000,
			),
		).rejects.toThrow("rcon is down");

		expect(logs.followers.size).toBe(0);
	});
});
