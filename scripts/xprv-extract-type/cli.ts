import process from "node:process";
import type { CliArgs } from "./types.js";

export function parseArgs(argv: string[]): CliArgs {
	const positional: string[] = [];
	let tsconfigPath: string | undefined;

	for (let i = 2; i < argv.length; i++) {
		const arg = argv[i];
		if (arg?.startsWith("--tsconfig=")) {
			tsconfigPath = arg.slice("--tsconfig=".length);
		} else if (arg === "--tsconfig") {
			tsconfigPath = argv[++i];
		} else if (arg) {
			positional.push(arg);
		}
	}

	const [sourcePath, variableName] = positional;

	if (!sourcePath || !variableName) {
		console.error("Usage: xprv-extract-type <source-path> <variable-name> [--tsconfig <path>]");
		process.exitCode = 1;
		throw new Error("Invalid arguments");
	}

	const args: CliArgs = { sourcePath, variableName };
	if (tsconfigPath) {
		args.tsconfigPath = tsconfigPath;
	}
	return args;
}

