import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { createRconAccess, RCON_PASSWORD_LENGTH, type RconAccessPassword } from "@serverkgg/bridge/rcon";
import { generateToken } from "@serverkgg/bridge/utils";
import { RCON_PROTOCOL, readInstallStamp, writeInstallStamp } from "../shared";

const NOT_GENERATED: Bridge.Text = {
	ar: "شغّل سيرفرك مرة عشان تتولد كلمة المرور.",
	en: "Start your server once to generate the password.",
};

export const rconAccessPassword = async (context: Bridge.Context): Promise<RconAccessPassword | null> => {
	const stamp = await readInstallStamp(context);

	if (stamp === null) {
		return null;
	}

	return {
		value: stamp.rconPasswordNext ?? stamp.rconPassword,
		pending: stamp.rconPasswordNext !== null,
	};
};

export const rotateRconPassword = async (context: Bridge.Context) => {
	const stamp = await readInstallStamp(context);

	if (stamp === null) {
		throw new BridgeUserError(NOT_GENERATED);
	}

	await writeInstallStamp(context, {
		...stamp,
		rconPasswordNext: generateToken(RCON_PASSWORD_LENGTH),
	});
};

export const rconAccess = createRconAccess({
	protocol: RCON_PROTOCOL,
	password: rconAccessPassword,
	rotate: rotateRconPassword,
	tools: {
		ar: "RustAdmin وBattleMetrics يتصلون بسيرفرك على WebRCON.",
		en: "RustAdmin and BattleMetrics connect over WebRCON.",
	},
});
