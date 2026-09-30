import { describe, expect, mock, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import * as webRcon from "../shared/webRcon";

const PASSWORD = "rcon-password-that-never-leaves";

const sent: string[] = [];

mock.module("../shared/webRcon", () => {
	return {
		...webRcon,
		async rconCommand(_context: Bridge.Context, command: string) {
			sent.push(command);

			return "";
		},
	};
});

const { live } = await import("./live");

const recording = () => {
	const reported: Bridge.Activity[] = [];
	const emitted: string[] = [];

	const context = {
		secret() {
			return PASSWORD;
		},
		activity: {
			report(entry: Bridge.Activity) {
				reported.push(entry);
			},
		},
		emit(event: string) {
			emitted.push(event);
		},
		log() {},
	} as unknown as Bridge.Context;

	return {
		context,
		reported,
		emitted,
	};
};

const runAction = async (name: string, context: Bridge.Context, args: Bridge.Values = {}) => {
	const action = live.actions[name];

	if (action === undefined) {
		throw new Error(`live has no ${name} action`);
	}

	await action(context, args);
};

describe("telling the owner what the live actions did", () => {
	test("reports a broadcast with the message it sent", async () => {
		const { context, reported } = recording();

		await runAction("announce", context, {
			message: "Wipe tonight at 8",
		});

		expect(reported).toEqual([
			{
				name: BridgeEventName.BroadcastSent,
				text: {
					ar: "تم إرسال رسالة للاعبين: «Wipe tonight at 8»",
					en: 'Sent a message to players: "Wipe tonight at 8"',
				},
			},
		]);
	});

	test("cuts a long broadcast to an 80 character excerpt", async () => {
		const { context, reported } = recording();
		const message = "x".repeat(200);

		await runAction("announce", context, {
			message,
		});

		expect(sent.at(-1)).toContain(message);
		expect(reported.at(0)?.text.en).not.toContain(message);
		expect(reported.at(0)?.text.en.endsWith('…"')).toBe(true);
	});

	test("reports a save as a gameplay change and keeps the world saved event", async () => {
		const { context, reported, emitted } = recording();

		await runAction("save", context);

		expect(emitted).toEqual([
			BridgeEventName.WorldSaved,
		]);
		expect(reported).toEqual([
			{
				name: BridgeEventName.GameplayChanged,
				text: {
					ar: "تم حفظ الماب",
					en: "Saved the map",
				},
				details: {
					what: "save",
				},
			},
		]);
	});

	test("never puts the rcon password in what it reports", async () => {
		const { context, reported } = recording();

		await runAction("announce", context, {
			message: "hello",
		});
		await runAction("save", context);

		expect(JSON.stringify(reported)).not.toContain(PASSWORD);
	});
});
