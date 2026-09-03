import type { Bridge } from "@serverkgg/bridge";

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

const PROGRESS = /Update state \(0x[0-9a-f]+\)\s*(?<phase>[^,]+),\s*progress:\s*(?<percent>\d+)\.\d+/i;

const PROGRESS_STEP = 10;

const NOTABLE = /^(Error|Warning|Failed|Success|Logging in|Connecting|Update state \(0x\d+\) (?!downloading))/i;

type Narrate = (message: string, fields?: Bridge.Values) => void;

export const steamcmdNarrator = (log: Narrate) => {
	let phase = "";
	let reported = -1;

	return (raw: string) => {
		const line = raw.replaceAll(ANSI, "").trim();
		const progress = line.match(PROGRESS);

		if (progress?.groups) {
			const current = progress.groups.phase?.trim() ?? "";
			const percent = Number(progress.groups.percent);
			const step = Math.floor(percent / PROGRESS_STEP) * PROGRESS_STEP;

			if (current !== phase) {
				phase = current;
				reported = -1;
			}

			if (step > reported) {
				reported = step;

				log(`${phase} rust`, {
					percent: step,
				});
			}

			return;
		}

		if (NOTABLE.test(line)) {
			log(line);
		}
	};
};
