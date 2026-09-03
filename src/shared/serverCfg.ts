import type { Bridge } from "@serverkgg/bridge";

const ENTRY = /^(?<key>[A-Za-z_][A-Za-z0-9_.]*)(?:[ \t]+(?<value>.*))?$/;

const NUMERIC = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

const NEWLINES = /[\r\n]+/g;

export interface ServerCfgLine {
	key: string;
	value: string;
}

export const readEntry = (line: string): ServerCfgLine | null => {
	const trimmed = line.trim();

	if (trimmed.length === 0 || trimmed.startsWith("//") || trimmed.startsWith("#")) {
		return null;
	}

	const match = trimmed.match(ENTRY);

	if (!match?.groups?.key) {
		return null;
	}

	return {
		key: match.groups.key,
		value: (match.groups.value ?? "").trim(),
	};
};

export const decodeValue = (raw: string): Bridge.Value => {
	if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
		return raw.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\\\", "\\");
	}

	if (raw === "true" || raw === "false") {
		return raw === "true";
	}

	if (NUMERIC.test(raw)) {
		return Number(raw);
	}

	return raw;
};

export const encodeValue = (value: Bridge.Value): string => {
	if (typeof value === "boolean") {
		return value ? "true" : "false";
	}

	if (typeof value === "number") {
		return Number.isFinite(value) ? String(value) : '""';
	}

	const text = (value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll(NEWLINES, " ");

	return `"${text}"`;
};

export const parseServerCfg = (raw: string): Bridge.Values => {
	const values: Bridge.Values = {};

	for (const line of raw.split("\n")) {
		const entry = readEntry(line);

		if (entry) {
			values[entry.key] = decodeValue(entry.value);
		}
	}

	return values;
};

export const mergeServerCfg = (raw: string, values: Bridge.Values): string => {
	const pending = new Map(Object.entries(values));
	const written = new Set<string>();
	const lines: string[] = [];

	for (const line of raw.split("\n")) {
		const entry = readEntry(line);
		const key = entry?.key ?? "";

		if (!entry || !pending.has(key)) {
			lines.push(line);

			continue;
		}

		if (written.has(key)) {
			continue;
		}

		written.add(key);
		lines.push(`${key} ${encodeValue(pending.get(key) ?? null)}`);
	}

	while (lines.length > 0 && (lines.at(-1) ?? "").trim().length === 0) {
		lines.pop();
	}

	for (const [key, value] of pending) {
		if (!written.has(key)) {
			lines.push(`${key} ${encodeValue(value)}`);
		}
	}

	return `${lines.join("\n")}\n`;
};
