import fs from "node:fs";
import path from "node:path";

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

