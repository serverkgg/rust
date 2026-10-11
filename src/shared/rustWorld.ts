import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { IDENTITY_DIRECTORY } from "./rustApp";
import type { RustSettings } from "./rustSettings";

export interface RustMapGeneration {
	size: number;
	seed: number;
}

const GENERATED_MAP = /(?:^|\/)proceduralmap\.(\d+)\.(\d+)\.\d+\.(?:map|sav)(?:\.\d+)?$/;

export const mapGenerationsOf = (paths: string[]): RustMapGeneration[] => {
	return paths.flatMap((path) => {
		const match = path.match(GENERATED_MAP);

		if (!match) {
			return [];
		}

		return [
			{
				size: Number(match[1]),
				seed: Number(match[2]),
			},
		];
	});
};

export const replacesMap = (paths: string[], settings: RustSettings) => {
	const generations = mapGenerationsOf(paths);

	return (
		generations.length > 0
		&& !generations.some((generation) => {
			return generation.size === settings.worldSize && generation.seed === settings.seed;
		})
	);
};

export const newMapText = (settings: RustSettings): Bridge.Text => {
	return {
		ar: `تغيّر السيد أو حجم الماب، ويُنشئ السيرفر مابًا جديدًا (السيد ${settings.seed}، الحجم ${settings.worldSize})`,
		en: `The seed or map size changed, the server is generating a new map (seed ${settings.seed}, size ${settings.worldSize})`,
	};
};

const detectNewMap = async (context: Bridge.Context, settings: RustSettings) => {
	const entries = await context.files.list(`${IDENTITY_DIRECTORY}/*`);
	const paths = entries.filter((entry) => !entry.directory).map((entry) => entry.path);

	return replacesMap(paths, settings);
};

export const reportNewMap = async (context: Bridge.Context, settings: RustSettings) => {
	try {
		if (!(await detectNewMap(context, settings))) {
			return;
		}
	} catch (error) {
		context.log.warn("could not check whether this start generates a new map, starting anyway", {
			error: error instanceof Error ? error.message : String(error),
		});

		return;
	}

	context.log("the seed or world size changed, rust generates a new map on this start", {
		seed: settings.seed,
		size: settings.worldSize,
	});

	context.activity.report({
		name: BridgeEventName.WorldCreated,
		text: newMapText(settings),
		details: {
			seed: settings.seed,
			size: settings.worldSize,
		},
	});
};
