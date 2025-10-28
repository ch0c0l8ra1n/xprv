import fs from "node:fs";
import path from "node:path";
import type { Symbol as MorphSymbol } from "ts-morph";

export function findTsConfig(startDir: string): string | undefined {
	let currentDir = startDir;
	const root = path.parse(currentDir).root;

	while (currentDir !== root) {
		const tsconfigPath = path.join(currentDir, "tsconfig.json");
		try {
			if (fs.existsSync(tsconfigPath)) {
				return tsconfigPath;
			}
		} catch {
			// Continue searching
		}
		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) {
			break;
		}
		currentDir = parentDir;
	}

	return undefined;
}

export function joinPaths(base: string, segment: string): string {
	const cleanBase = base === "/" ? "" : base.replace(/\/$/, "");
	const cleanSegment = segment.startsWith("/") ? segment.slice(1) : segment;
	const combined = [cleanBase, cleanSegment].filter(Boolean).join("/");
	return `/${combined}`.replace(/\/+/g, "/") || "/";
}

export function getLiteralString(type: any): string | undefined {
	if (type.isStringLiteral()) {
		return type.getLiteralValue() as string;
	}
	const text = type.getText();
	if (/^".*"$/.test(text)) {
		return text.slice(1, -1);
	}
	return undefined;
}

export function cleanSymbolName(symbol: MorphSymbol): string {
	const name = symbol.getName();
	return name.startsWith("__") ? name.slice(2) : name;
}

export function createOperationId(method: string, pathValue: string): string {
	const sanitized = pathValue.replace(/[^A-Za-z0-9]+/g, "_");
	const trimmed = sanitized.replace(/^_+|_+$/g, "");
	return `${method.toLowerCase()}_${trimmed || "root"}`;
}

