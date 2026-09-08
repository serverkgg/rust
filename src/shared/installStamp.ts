import type { Bridge } from "@serverkgg/bridge";
import { readStamp, writeStamp } from "@serverkgg/bridge/install";

export interface InstallStamp {
	buildId: string | null;
	rconPassword: string;
	rconPasswordNext: string | null;
}

const passwordOf = (value: unknown) => {
	return typeof value === "string" && value.length > 0 ? value : null;
};

export const installStampOf = (stamp: Record<string, unknown> | null): InstallStamp | null => {
	const rconPassword = stamp === null ? null : passwordOf(stamp.rconPassword);

	if (stamp === null || rconPassword === null) {
		return null;
	}

	return {
		buildId: typeof stamp.buildId === "string" ? stamp.buildId : null,
		rconPassword,
		rconPasswordNext: passwordOf(stamp.rconPasswordNext),
	};
};

export const readInstallStamp = async (context: Bridge.Context): Promise<InstallStamp | null> => {
	return installStampOf(await readStamp(context));
};

export const writeInstallStamp = async (context: Bridge.Context, stamp: InstallStamp) => {
	await writeStamp<InstallStamp>(context, stamp);
};

export const promoteRconPassword = async (context: Bridge.Context, stamp: InstallStamp): Promise<InstallStamp> => {
	if (stamp.rconPasswordNext === null) {
		return stamp;
	}

	const promoted: InstallStamp = {
		...stamp,
		rconPassword: stamp.rconPasswordNext,
		rconPasswordNext: null,
	};

	await writeInstallStamp(context, promoted);

	context.log("applied the rotated rcon password");

	return promoted;
};
