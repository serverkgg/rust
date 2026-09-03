import { Buffer } from "node:buffer";
import type { Bridge } from "@serverkgg/bridge";

export const STAMP_FILE = ".serverk-install.json";

const PASSWORD_BYTES = 18;

export interface InstallStamp {
	buildId: string | null;
	rconPassword: string;
}

export const generatePassword = () => {
	const bytes = new Uint8Array(PASSWORD_BYTES);

	crypto.getRandomValues(bytes);

	return Buffer.from(bytes).toString("base64url");
};

export const parseStamp = (raw: string): InstallStamp | null => {
	try {
		const parsed: unknown = JSON.parse(raw);

		if (typeof parsed !== "object" || parsed === null) {
			return null;
		}

		const stamp = parsed as Partial<InstallStamp>;

		if (typeof stamp.rconPassword !== "string" || stamp.rconPassword.length === 0) {
			return null;
		}

		return {
			...stamp,
			buildId: typeof stamp.buildId === "string" ? stamp.buildId : null,
			rconPassword: stamp.rconPassword,
		};
	} catch {
		return null;
	}
};

export const readStamp = async (context: Bridge.Context): Promise<InstallStamp | null> => {
	if (!(await context.files.exists(STAMP_FILE))) {
		return null;
	}

	return parseStamp(await context.files.read(STAMP_FILE));
};

export const writeStamp = async (context: Bridge.Context, stamp: InstallStamp) => {
	await context.files.write(STAMP_FILE, `${JSON.stringify(stamp, null, 2)}\n`);
};
