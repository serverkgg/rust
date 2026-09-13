import { describe, expect, test } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { SAVE_CONFIRM_TIMEOUT_MS } from "../shared";
import { SAVE_UNCONFIRMED, saveBeforeBackup } from "./backup";

const SAVED = "Saved 53,734 ents, cache(0.15), write(0.02), disk(0.01).";

const contextWith = () => {
	const followers = new Set<(line: string) => void>();
	const errors: string[] = [];

	const log = Object.assign(() => {}, {
		warn() {},
		error(message: string) {
			errors.push(message);
		},
	});

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
		log,
	} as unknown as Bridge.Context;

	return {
		context,
		errors,
		print(line: string) {
			for (const follower of followers) {
				follower(line);
			}
		},
	};
};

describe("saving the world before a backup copies it", () => {
	test("lets the backup copy once rust confirms the save", async () => {
		const rust = contextWith();

		await saveBeforeBackup(
			rust.context,
			async () => {
				rust.print(SAVED);
			},
			1000,
		);

		expect(rust.errors).toEqual([]);
	});

	test("fails the backup when rust never confirms, so a failed save is never labelled consistent", async () => {
		const rust = contextWith();

		const refused = saveBeforeBackup(rust.context, async () => {}, 20);

		await expect(refused).rejects.toBeInstanceOf(BridgeUserError);
		await expect(refused).rejects.toMatchObject({
			text: SAVE_UNCONFIRMED,
		});
		expect(rust.errors).toHaveLength(1);
	});

	test("fails the backup when rcon refuses the save", async () => {
		const rust = contextWith();

		await expect(
			saveBeforeBackup(
				rust.context,
				async () => {
					throw new Error("rcon is down");
				},
				1000,
			),
		).rejects.toThrow("rcon is down");
	});

	test("still accepts a confirmation that arrives late inside the window", async () => {
		const rust = contextWith();

		await saveBeforeBackup(
			rust.context,
			async () => {
				setTimeout(() => {
					rust.print(SAVED);
				}, 30);
			},
			200,
		);

		expect(rust.errors).toEqual([]);
	});

	test("refuses the backup once the window closes, and not before", async () => {
		const rust = contextWith();
		const windowMs = 60;
		const started = performance.now();

		await expect(saveBeforeBackup(rust.context, async () => {}, windowMs)).rejects.toMatchObject({
			text: SAVE_UNCONFIRMED,
		});

		const waited = performance.now() - started;

		expect(waited).toBeGreaterThanOrEqual(windowMs - 5);
		expect(waited).toBeLessThan(windowMs + 500);
	});

	test("gives rust thirty seconds by default", () => {
		expect(SAVE_CONFIRM_TIMEOUT_MS).toBe(30_000);
	});
});
