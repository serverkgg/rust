import { type Bridge, BridgeDetailFormat, BridgeDetailTone, BridgeKind } from "@serverkgg/bridge";
import { type RustHealth, serverHealth } from "../shared";

const REFRESH_SECONDS = 20;

export const SMOOTH_FPS_THRESHOLD = 30;

export const LAG_FPS_THRESHOLD = 15;

const MINUTE_SECONDS = 60;

const HOUR_SECONDS = 3600;

const MEGABYTE = 1_048_576;

const MISSING = "—";

const arabicCount = (count: number, one: string, two: string, few: string, many: string) => {
	if (count === 1) {
		return one;
	}

	if (count === 2) {
		return two;
	}

	return `${count} ${count <= 10 ? few : many}`;
};

const arabicHours = (hours: number) => {
	return arabicCount(hours, "ساعة", "ساعتين", "ساعات", "ساعة");
};

const arabicMinutes = (minutes: number) => {
	return arabicCount(minutes, "دقيقة", "دقيقتين", "دقايق", "دقيقة");
};

export const formatUptime = (seconds: number): Bridge.Text => {
	const total = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(total / HOUR_SECONDS);
	const minutes = Math.floor((total % HOUR_SECONDS) / MINUTE_SECONDS);

	if (hours === 0 && minutes === 0) {
		return {
			ar: "أقل من دقيقة",
			en: "Less than a minute",
		};
	}

	if (hours === 0) {
		return {
			ar: arabicMinutes(minutes),
			en: `${minutes}m`,
		};
	}

	if (minutes === 0) {
		return {
			ar: arabicHours(hours),
			en: `${hours}h`,
		};
	}

	return {
		ar: `${arabicHours(hours)} و${arabicMinutes(minutes)}`,
		en: `${hours}h ${minutes}m`,
	};
};

export const fpsBadge = (fps: number): Bridge.DetailBadge => {
	if (fps >= SMOOTH_FPS_THRESHOLD) {
		return {
			label: {
				ar: "سلس",
				en: "Smooth",
			},
			tone: BridgeDetailTone.Success,
		};
	}

	if (fps >= LAG_FPS_THRESHOLD) {
		return {
			label: {
				ar: "فيه شوي لاق",
				en: "Slight lag",
			},
			tone: BridgeDetailTone.Warning,
		};
	}

	return {
		label: {
			ar: "لاق واضح",
			en: "Lagging",
		},
		tone: BridgeDetailTone.Danger,
	};
};

export const healthBadges = (current: RustHealth): Bridge.DetailBadge[] => {
	return [
		...(current.fps === null
			? []
			: [
					fpsBadge(current.fps),
				]),
		...(current.version === null
			? []
			: [
					{
						label: {
							ar: current.version,
							en: current.version,
						},
						tone: BridgeDetailTone.Neutral,
					},
				]),
	];
};

export const healthStats = (current: RustHealth): Bridge.DetailStat[] => {
	return [
		{
			key: "fps",
			label: {
				ar: "الإطارات",
				en: "FPS",
			},
			value: current.fps ?? MISSING,
			format: current.fps === null ? BridgeDetailFormat.Text : BridgeDetailFormat.Number,
		},
		{
			key: "entities",
			label: {
				ar: "الكيانات",
				en: "Entities",
			},
			value: current.entities ?? MISSING,
			format: current.entities === null ? BridgeDetailFormat.Text : BridgeDetailFormat.Number,
		},
		{
			key: "uptime",
			label: {
				ar: "شغّال من",
				en: "Up for",
			},
			value: current.uptimeSeconds === null ? MISSING : formatUptime(current.uptimeSeconds),
			format: BridgeDetailFormat.Text,
		},
		{
			key: "memory",
			label: {
				ar: "الرام",
				en: "Memory",
			},
			value: current.memoryMb === null ? MISSING : current.memoryMb * MEGABYTE,
			format: current.memoryMb === null ? BridgeDetailFormat.Text : BridgeDetailFormat.Bytes,
		},
		{
			key: "players",
			label: {
				ar: "اللاعبين",
				en: "Players",
			},
			value: current.online === null || current.max === null ? MISSING : `${current.online}/${current.max}`,
			format: BridgeDetailFormat.Text,
		},
		{
			key: "queued",
			label: {
				ar: "في الطابور",
				en: "In queue",
			},
			value: current.queued ?? MISSING,
			format: current.queued === null ? BridgeDetailFormat.Text : BridgeDetailFormat.Number,
		},
	];
};

let stored: RustHealth | null = null;

const sample = async (context: Bridge.Context) => {
	let answer: RustHealth | null;

	try {
		answer = await serverHealth(context);
	} catch {
		return null;
	}

	if (answer === null) {
		return null;
	}

	stored = answer;

	return answer;
};

export const health: Bridge.Detail = {
	kind: BridgeKind.Detail,
	requiresRunning: true,
	refreshSeconds: REFRESH_SECONDS,

	async read(context) {
		const live = await sample(context);
		const current = live ?? stored;

		if (current === null) {
			return null;
		}

		return {
			id: "health",
			title: {
				ar: "حالة السيرفر",
				en: "Server health",
			},
			subtitle: {
				ar: "الأرقام هذي طالعة من سيرفرك نفسه، مو تقدير.",
				en: "These numbers come straight from your own server, not an estimate.",
			},
			description: null,
			image: null,
			badges: healthBadges(current),
			stats: healthStats(current),
			links: [],
			stale: live === null,
			actions: [],
		};
	},
};
