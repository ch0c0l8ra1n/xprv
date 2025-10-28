#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { parseArgs } from "./cli.js";
import { findTsConfig } from "./utils.js";
import { TypeExtractor } from "./type-extractor.js";
import { formatType, printFormattedType } from "./formatter.js";

async function main() {
	const args = parseArgs(process.argv);
	const cwd = process.cwd();
	const sourcePath = path.resolve(cwd, args.sourcePath);

	// Determine tsconfig path
	let tsconfigPath: string | undefined;
	if (args.tsconfigPath) {
		tsconfigPath = path.resolve(cwd, args.tsconfigPath);
	} else {
		const sourceDir = path.dirname(sourcePath);
		tsconfigPath = findTsConfig(sourceDir);
	}

	if (!tsconfigPath) {
		throw new Error(
			`Unable to find tsconfig.json. Searched from ${path.dirname(sourcePath)} upwards. ` +
			`Specify one explicitly with --tsconfig <path>`
		);
	}

	// Extract type information
	const extractor = new TypeExtractor(tsconfigPath);
	const typeInfo = extractor.extractVariableType(sourcePath, args.variableName);

	// Format and print
	const formatted = formatType(args.variableName, typeInfo.type);
	printFormattedType(formatted);
}

main().catch((error) => {
	if (!process.exitCode) {
		process.exitCode = 1;
	}
	console.error(error instanceof Error ? error.message : error);
});

