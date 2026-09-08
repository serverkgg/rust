import type { Bridge } from "@serverkgg/bridge";
import { readStamp } from "@serverkgg/bridge/install";

export const RCON_PASSWORD_LENGTH = 24;

export interface InstallStamp {
	buildId: string | null;
	rconPassword: string;
}

export const installStampOf = (stamp: Record<string, unknown> | null): InstallStamp | null => {
	if (stamp === null || typeof stamp.rconPassword !== "string" || stamp.rconPassword.length === 0) {
		return null;
	}

	return {
		buildId: typeof stamp.buildId === "string" ? stamp.buildId : null,
		rconPassword: stamp.rconPassword,
	};
};

export const readInstallStamp = async (context: Bridge.Context): Promise<InstallStamp | null> => {
	return installStampOf(await readStamp(context));
};
