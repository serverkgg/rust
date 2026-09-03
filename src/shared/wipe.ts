import type { Bridge } from "@serverkgg/bridge";
import { IDENTITY_DIRECTORY } from "./rustApp";

export const WIPE_MARKER = ".serverk-wipe";

export enum WipeKind {
	Full = "full",
	Map = "map",
}

const WORLD = /\.(?:map|sav)(?:\.\d+)?$/;

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
		if (WORLD.test(path)) {
			return true;
		}

		return kind === WipeKind.Full && PLAYER.test(path);
	});
};

export const requestWipe = async (context: Bridge.Context, kind: WipeKind) => {
	await context.files.write(WIPE_MARKER, `${kind}\n`);
};

export const pendingWipe = async (context: Bridge.Context) => {
	if (!(await context.files.exists(WIPE_MARKER))) {
		return null;
	}

	return parseWipeKind(await context.files.read(WIPE_MARKER));
};

export const applyWipe = async (context: Bridge.Context, kind: WipeKind) => {
	const entries = await context.files.list(`${IDENTITY_DIRECTORY}/*`);
	const targets = wipeTargets(
		entries.filter((entry) => !entry.directory).map((entry) => entry.path),
		kind,
	);

	for (const target of targets) {
		await context.files.remove(target);
	}

	await context.files.remove(WIPE_MARKER);

	context.log("wipe applied, the server will build a new map on this start", {
		kind,
		removed: targets.length,
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
