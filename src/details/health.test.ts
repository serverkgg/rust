import { describe, expect, it } from "bun:test";
import { BridgeDetailFormat, BridgeDetailTone } from "@serverkgg/bridge";
import { parseServerHealth } from "../shared";
import { fpsBadge, healthBadges, healthStats, LAG_FPS_THRESHOLD, SMOOTH_FPS_THRESHOLD } from "./health";

const HEALTH = parseServerHealth(
	JSON.stringify({
		Hostname: "Serverk Rust",
		MaxPlayers: 50,
		Players: 12,
		Queued: 2,
		EntityCount: 92_345,
		Uptime: 7860,
		Map: "Procedural Map",
		Framerate: 59.4,
		Memory: 4096,
		Version: 2551,
	}),
);

const statOf = (key: string) => {
	return HEALTH === null ? undefined : healthStats(HEALTH).find((stat) => stat.key === key);
};

describe("telling the player how smooth their server is running", () => {
	it("calls a server at the smooth threshold smooth", () => {
		expect(fpsBadge(SMOOTH_FPS_THRESHOLD).tone).toBe(BridgeDetailTone.Success);
	});

	it("warns about the frame rate rust starts stuttering at", () => {
		expect(fpsBadge(LAG_FPS_THRESHOLD).tone).toBe(BridgeDetailTone.Warning);
		expect(fpsBadge(SMOOTH_FPS_THRESHOLD - 1).tone).toBe(BridgeDetailTone.Warning);
	});

	it("calls anything below the lag threshold lagging", () => {
		expect(fpsBadge(LAG_FPS_THRESHOLD - 1).tone).toBe(BridgeDetailTone.Danger);
		expect(fpsBadge(0).tone).toBe(BridgeDetailTone.Danger);
	});
});

describe("building the health card from a serverinfo reply", () => {
	it("badges the frame rate and the build rust reported", () => {
		expect(HEALTH === null ? [] : healthBadges(HEALTH)).toEqual([
			{
				label: {
					ar: "سلس",
					en: "Smooth",
				},
				tone: BridgeDetailTone.Success,
			},
			{
				label: {
					ar: "2551",
					en: "2551",
				},
				tone: BridgeDetailTone.Neutral,
			},
		]);
	});

	it("shows the stats the overview card promises, in order", () => {
		expect(HEALTH === null ? [] : healthStats(HEALTH).map((stat) => stat.key)).toEqual([
			"fps",
			"entities",
			"uptime",
			"memory",
			"players",
			"queued",
		]);
	});

	it("counts the memory in bytes, because that is what the platform formats", () => {
		expect(statOf("memory")?.value).toBe(4096 * 1_048_576);
		expect(statOf("memory")?.format).toBe(BridgeDetailFormat.Bytes);
	});

	it("reads the online and max counts into one cell", () => {
		expect(statOf("players")?.value).toBe("12/50");
	});

	it("rounds the frame rate rust answered with as a float", () => {
		expect(statOf("fps")?.value).toBe(59);
		expect(statOf("fps")?.format).toBe(BridgeDetailFormat.Number);
	});

	it("shows a dash rather than a zero for anything rust left out", () => {
		const missing = healthStats({
			hostname: null,
			map: null,
			online: null,
			max: null,
			queued: null,
			joining: null,
			entities: null,
			fps: null,
			memoryMb: null,
			uptimeSeconds: null,
			version: null,
		});

		for (const stat of missing) {
			expect(stat.value).toBe("—");
			expect(stat.format).toBe(BridgeDetailFormat.Text);
		}
	});

	it("badges nothing at all when rust reported neither frame rate nor build", () => {
		expect(
			healthBadges({
				hostname: null,
				map: null,
				online: null,
				max: null,
				queued: null,
				joining: null,
				entities: null,
				fps: null,
				memoryMb: null,
				uptimeSeconds: null,
				version: null,
			}),
		).toEqual([]);
	});
});
