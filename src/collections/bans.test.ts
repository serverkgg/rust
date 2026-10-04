import { describe, expect, it, mock } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import * as webRcon from "../shared/webRcon";

const PASSWORD = "rcon-password-that-never-leaves";

const STEAM_ID = "76561198000000001";

mock.module("../shared/webRcon", () => {
	return {
		...webRcon,
		async rconCommand() {
			return "";
		},
	};
});

const { bans } = await import("./bans");

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

const unban = async (context: Bridge.Context, row: Bridge.Row) => {
	const action = bans.actions?.remove;

	if (action === undefined) {
		throw new Error("bans has no remove action");
	}

	await action(context, row, {});
};

describe("telling the owner who was banned or unbanned from the bans table", () => {
	it("reports a ban by steam id and keeps the ban event", async () => {
		const { context, reported, emitted } = recording();

		await bans.add?.(context, STEAM_ID);

		expect(emitted).toEqual([
			BridgeEventName.PlayerBanned,
		]);
		expect(reported).toEqual([
			{
				name: BridgeEventName.PlayerBanned,
				text: {
					ar: `تم حظر ${STEAM_ID}`,
					en: `Banned ${STEAM_ID}`,
				},
				subject: STEAM_ID,
				details: {
					steamId: STEAM_ID,
				},
			},
		]);
	});

	it("reports an unban with the name the ban list kept", async () => {
		const { context, reported } = recording();

		await unban(context, {
			id: STEAM_ID,
			name: "Meslzy",
			reason: "Banned by an admin.",
		});

		expect(reported).toEqual([
			{
				name: BridgeEventName.PlayerUnbanned,
				text: {
					ar: "تم فك الحظر عن Meslzy",
					en: "Unbanned Meslzy",
				},
				subject: "Meslzy",
				details: {
					steamId: STEAM_ID,
				},
			},
		]);
	});

	it("falls back to the steam id when the ban list kept no name", async () => {
		const { context, reported } = recording();

		await unban(context, {
			id: STEAM_ID,
			name: "",
			reason: "",
		});

		expect(reported.at(0)?.subject).toBe(STEAM_ID);
	});

	it("never puts the rcon password in what it reports", async () => {
		const { context, reported } = recording();

		await bans.add?.(context, STEAM_ID);
		await unban(context, {
			id: STEAM_ID,
			name: "Meslzy",
		});

		expect(JSON.stringify(reported)).not.toContain(PASSWORD);
	});
});
