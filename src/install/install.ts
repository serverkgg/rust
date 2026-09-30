import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { RCON_PASSWORD_LENGTH } from "@serverkgg/bridge/rcon";
import { createSteamcmd, installedBuildId, missingGameRoots } from "@serverkgg/bridge/steam";
import { generateToken } from "@serverkgg/bridge/utils";
import { GAME_ROOTS, readInstallStamp, STEAM_APP_ID, writeInstallStamp } from "../shared";
import { seedConfig } from "./seedConfig";

const LABEL = "rust";

export const FILES_MISSING: Bridge.Text = {
	ar: "التنزيل خلص بس ملفات رست ناقصة. جرّب التثبيت مرة ثانية.",
	en: "The download finished but some Rust files are missing. Try the install again.",
};

export const installedText = (buildId: string | null): Bridge.Text => {
	if (buildId === null) {
		return {
			ar: "تم تثبيت رست",
			en: "Installed Rust",
		};
	}

	return {
		ar: `تم تثبيت رست (البيلد ${buildId})`,
		en: `Installed Rust (build ${buildId})`,
	};
};

const steamcmdOf = (context: Bridge.Context) => {
	return createSteamcmd(context, {
		appId: STEAM_APP_ID,
		label: LABEL,
	});
};

export const install: Bridge.Install = {
	kind: BridgeKind.Install,
	async run(context) {
		const stamp = await readInstallStamp(context);
		const fresh = (await missingGameRoots(context, GAME_ROOTS)).length > 0;
		const steamcmd = steamcmdOf(context);

		await steamcmd.prepare();

		context.log(
			fresh ? "downloading the rust dedicated server, this one is a big one" : "checking steam for a newer build",
			{
				app: STEAM_APP_ID,
			},
		);

		await steamcmd.update({
			validate: fresh,
		});

		const missing = await missingGameRoots(context, GAME_ROOTS);

		if (missing.length > 0) {
			throw new BridgeUserError(FILES_MISSING, {
				cause: new Error(`steamcmd finished but ${missing.join(", ")} is missing`),
			});
		}

		await steamcmd.linkSteamClient();
		await seedConfig(context);

		const buildId = await steamcmd.buildId();

		if (buildId !== null && stamp?.buildId != null && stamp.buildId !== buildId) {
			context.log("the server updated to a newer steam build", {
				from: stamp.buildId,
				to: buildId,
			});

			context.emit(BridgeEventName.ServerUpdated, {
				from: stamp.buildId,
				to: buildId,
			});

			context.activity.report({
				name: BridgeEventName.ServerUpdated,
				text: {
					ar: `تم تحديث رست من البيلد ${stamp.buildId} إلى ${buildId}`,
					en: `Updated Rust from build ${stamp.buildId} to ${buildId}`,
				},
				details: {
					from: stamp.buildId,
					to: buildId,
				},
			});
		}

		await writeInstallStamp(context, {
			buildId,
			rconPassword: stamp?.rconPassword ?? generateToken(RCON_PASSWORD_LENGTH),
			rconPasswordNext: stamp?.rconPasswordNext ?? null,
		});

		if (stamp === null) {
			context.activity.report({
				name: BridgeEventName.GameInstalled,
				text: installedText(buildId),
				details: {
					build: buildId,
				},
			});
		}

		context.log("install complete", {
			app: STEAM_APP_ID,
			build: buildId,
		});
	},
	async describe(context) {
		const stamp = await readInstallStamp(context);

		return {
			version: stamp?.buildId ?? (await installedBuildId(context, STEAM_APP_ID)),
			variant: null,
			build: null,
		};
	},
};
