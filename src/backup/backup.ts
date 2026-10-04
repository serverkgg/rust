import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { awaitSaveComplete, SAVE_CONFIRM_TIMEOUT_MS, saveWorld } from "../shared";

const SETTLE_SECONDS = 10;

export const SAVE_UNCONFIRMED: Bridge.Text = {
	ar: "لم يؤكد سيرفرك حفظ الماب قبل النسخة الاحتياطية. جرب مرة ثانية، وإذا تكرر ذلك فأوقف السيرفر وخذ النسخة وهو متوقف.",
	en: "Your server didn't confirm it saved the map before the backup. Try again, and if it keeps happening, stop the server and take the backup while it's stopped.",
};

export const saveBeforeBackup = async (
	context: Bridge.Context,
	save: () => Promise<void>,
	timeoutMs: number = SAVE_CONFIRM_TIMEOUT_MS,
) => {
	if (await awaitSaveComplete(context, save, timeoutMs)) {
		return;
	}

	context.log.error("rust did not confirm the save in time, refusing to label the backup consistent", {
		timeoutMs,
	});

	throw new BridgeUserError(SAVE_UNCONFIRMED);
};

export const backup: Bridge.Backup = {
	kind: BridgeKind.Backup,
	settleSeconds: SETTLE_SECONDS,
	async quiesce(context) {
		await saveBeforeBackup(context, () => saveWorld(context));
	},
};
