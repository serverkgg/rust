import { describe, expect, it, mock } from "bun:test";
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

const { players } = await import("./players");

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

const row: Bridge.Row = {
	id: "76561198000000001",
	name: "Meslzy",
};

const runAction = async (name: string, context: Bridge.Context) => {
	const action = players.actions?.[name];

	if (action === undefined) {
		throw new Error(`players has no ${name} action`);
	}

	await action(context, row, {});
};

describe("telling the owner who was kicked or banned from the players table", () => {
	it("reports a kick with the player's name and steam id", async () => {
		const { context, reported, emitted } = recording();

		await runAction("kick", context);

		expect(emitted).toEqual([
			BridgeEventName.PlayerKicked,
		]);
		expect(reported).toEqual([
			{
				name: BridgeEventName.PlayerKicked,
				text: {
					ar: "تم طرد Meslzy",
					en: "Kicked Meslzy",
				},
				subject: "Meslzy",
				details: {
					steamId: "76561198000000001",
				},
			},
		]);
	});

	it("reports a ban with the player's name and steam id, and keeps the ban event", async () => {
		const { context, reported, emitted } = recording();

		await runAction("ban", context);

		expect(emitted).toEqual([
			BridgeEventName.PlayerBanned,
		]);
		expect(reported.map((entry) => entry.name)).toEqual([
			BridgeEventName.PlayerBanned,
		]);
		expect(reported.at(0)?.subject).toBe("Meslzy");
		expect(reported.at(0)?.details?.steamId).toBe("76561198000000001");
	});

	it("never puts the rcon password in what it reports", async () => {
		const { context, reported } = recording();

		await runAction("kick", context);
		await runAction("ban", context);

		expect(JSON.stringify(reported)).not.toContain(PASSWORD);
		expect(sent.length).toBeGreaterThan(0);
	});
});
