import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { IDENTITY_DIRECTORY } from "./rustApp";

export const WIPE_MARKER = ".serverk-wipe";

export enum WipeKind {
	Full = "full",
	Map = "map",
}

const WORLD = /\.(?:map|sav)(?:\.\d+)?$/;

const OCCLUSION = /_occlusion_\d+\.dat$/;

const PLAYER = /\.db(?:-journal|-wal|-shm)?$/;

export const parseWipeKind = (raw: string): WipeKind | null => {
	const value = raw.trim();

	if (value === WipeKind.Full || value === WipeKind.Map) {
		return value;
	}

	return null;
};

export const wipeTargets = (paths: string[], kind: WipeKind): string[] => {
	return paths.filter((path) => {
		if (WORLD.test(path) || OCCLUSION.test(path)) {
			return true;
		}

		return kind === WipeKind.Full && PLAYER.test(path);
	});
};

export const pendingWipe = async (context: Bridge.Context) => {
	if (!(await context.files.exists(WIPE_MARKER))) {
		return null;
	}

	return parseWipeKind(await context.files.read(WIPE_MARKER));
};

export const wipeText = (kind: WipeKind, files: number): Bridge.Text => {
	const count = {
		ar:
			files === 1
				? "ملف واحد"
				: files === 2
					? "ملفين"
					: files % 100 >= 3 && files % 100 <= 10
						? `${files} ملفات`
						: files % 100 >= 11
							? `${files} ملفًا`
							: `${files} ملف`,
		en: files === 1 ? "1 file" : `${files} files`,
	};

	if (kind === WipeKind.Full) {
		return {
			ar: `تم وايب كامل للماب وبيانات اللاعبين (${count.ar})`,
			en: `Wiped the map and player data (${count.en})`,
		};
	}

	return {
		ar: `تم وايب الماب (${count.ar})`,
		en: `Wiped the map (${count.en})`,
	};
};

export const listIdentityFiles = async (context: Bridge.Context) => {
	const entries = await context.files.list(`${IDENTITY_DIRECTORY}/*`);

	return entries.filter((entry) => !entry.directory).map((entry) => entry.path);
};

export const applyWipe = async (context: Bridge.Context, kind: WipeKind) => {
	const targets = wipeTargets(await listIdentityFiles(context), kind);

	for (const target of targets) {
		await context.files.remove(target);
	}

	await context.files.remove(WIPE_MARKER);

	context.log("wipe applied, the server builds a new map on its next start", {
		kind,
		removed: targets.length,
	});

	context.activity.report({
		name: BridgeEventName.WorldWiped,
		text: wipeText(kind, targets.length),
		details: {
			scope: kind,
			files: targets.length,
		},
	});
};

export const consumeWipe = async (context: Bridge.Context) => {
	const kind = await pendingWipe(context);

	if (kind === null) {
		if (await context.files.exists(WIPE_MARKER)) {
			await context.files.remove(WIPE_MARKER);
		}

		return;
	}

	await applyWipe(context, kind);
};
