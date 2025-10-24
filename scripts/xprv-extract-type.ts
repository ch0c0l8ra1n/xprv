#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import * as ts from "typescript";
import { Project } from "ts-morph";

interface CliArgs {
	sourcePath: string;
	variableName: string;
	outputPath?: string;
}

interface ModuleInfo {
	name: string;
	block: ts.ModuleBlock;
	sourceFile: ts.SourceFile;
}

interface ModuleTransformResult {
	content: string;
	dependencies: Set<string>;
}

function parseArgs(argv: string[]): CliArgs {
	const [, , sourcePath, variableName, outputPath] = argv;

	if (!sourcePath || !variableName) {
		console.error("Usage: xprv-extract-type <source-path> <variable-name> [output-path]");
		process.exitCode = 1;
		throw new Error("Invalid arguments");
	}

	const result: CliArgs = { sourcePath, variableName };
	if (outputPath !== undefined) {
		result.outputPath = outputPath;
	}
	return result;
}

function normalizeModuleName(specifier: string): string {
	const cleaned = specifier.replace(/^\.\//, "");
	return cleaned.replace(/\\/g, "/");
}

function createDeclarationBundle(entryFile: string, compilerOptions: ts.CompilerOptions): string {
	let declarationText = "";

	const host = ts.createCompilerHost(compilerOptions);
	host.writeFile = (fileName, content) => {
		if (fileName.endsWith(".d.ts")) {
			declarationText = content;
		}
	};

	const program = ts.createProgram([entryFile], compilerOptions, host);
	const diagnostics = ts.getPreEmitDiagnostics(program);

	if (diagnostics.length > 0) {
		const formatHost: ts.FormatDiagnosticsHost = {
			getCanonicalFileName: (fileName) => fileName,
			getCurrentDirectory: ts.sys.getCurrentDirectory,
			getNewLine: () => "\n",
		};
		const message = ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost);
		throw new Error(`Failed to emit declarations:\n${message}`);
	}

	const emitResult = program.emit();
	if (emitResult.emitSkipped) {
		throw new Error("Declaration emit was skipped");
	}

	if (!declarationText) {
		throw new Error("No declaration text produced");
	}

	return declarationText;
}

function parseModuleMap(bundleText: string): Map<string, ModuleInfo> {
	const sourceFile = ts.createSourceFile("bundle.d.ts", bundleText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const moduleMap = new Map<string, ModuleInfo>();

	sourceFile.forEachChild((statement) => {
		if (!ts.isModuleDeclaration(statement) || statement.name.kind !== ts.SyntaxKind.StringLiteral) {
			return;
		}

		let body = statement.body;
		while (body && ts.isModuleDeclaration(body)) {
			body = body.body;
		}

		if (!body || !ts.isModuleBlock(body)) {
			return;
		}

		const moduleName = statement.name.text;
		moduleMap.set(moduleName, {
			name: moduleName,
			block: body,
			sourceFile,
		});
	});

	return moduleMap;
}

function sanitizeDtsContent(raw: string, inlineableModules: Set<string>) {
	const NO_SOURCE_MAP = /\/\/#[^\n]*sourceMappingURL[^\n]*\n?/g;
	const inlineImportPattern = /import\("([^"\\]+)"\)\.([A-Za-z0-9_]+)/g;
	const dependencies = new Set<string>();

	const withoutSourceMap = raw.replace(NO_SOURCE_MAP, "");
	const sanitized = withoutSourceMap.replace(inlineImportPattern, (match, modulePath, typeName) => {
		const normalized = normalizeModuleName(modulePath);
		if (inlineableModules.has(normalized)) {
			dependencies.add(normalized);
			return typeName;
		}
		return match;
	});

	return {
		text: sanitized.trim().replace(/\s+$/g, ""),
		dependencies,
	};
}

function transformModule(
	moduleName: string,
	moduleInfo: ModuleInfo,
	inlineableModules: Set<string>,
	externalImports: Set<string>,
	cache: Map<string, ModuleTransformResult>
): ModuleTransformResult {
	const cached = cache.get(moduleName);
	if (cached) {
		return cached;
	}

	const dependencies = new Set<string>();
	const statementTexts: string[] = [];

	for (const statement of moduleInfo.block.statements) {
		if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
			const specifier = normalizeModuleName(statement.moduleSpecifier.text);
			if (inlineableModules.has(specifier)) {
				dependencies.add(specifier);
				continue;
			}
			externalImports.add(statement.getText(moduleInfo.sourceFile));
			continue;
		}

		if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
			const specifier = normalizeModuleName(statement.moduleSpecifier.text);
			if (inlineableModules.has(specifier)) {
				dependencies.add(specifier);
				continue;
			}
		}

		statementTexts.push(statement.getText(moduleInfo.sourceFile));
	}

	const combined = statementTexts.join("\n\n");
	const { text, dependencies: inlineDeps } = sanitizeDtsContent(combined, inlineableModules);

	for (const dep of inlineDeps) {
		if (inlineableModules.has(dep) && dep !== moduleName) {
			dependencies.add(dep);
		}
	}

	const contentLines: string[] = [];
	if (text.trim().length > 0) {
		contentLines.push(`// From module ${moduleName}`);
		contentLines.push(text.trim());
	}

	const result: ModuleTransformResult = {
		content: contentLines.join("\n\n"),
		dependencies,
	};
	cache.set(moduleName, result);
	return result;
}

function buildDefinition(
	moduleMap: Map<string, ModuleInfo>,
	targetModule: string,
	inlineableModules: Set<string>
) {
	const externalImports = new Set<string>();
	const cache = new Map<string, ModuleTransformResult>();
	const emitted = new Set<string>();
	const sections: string[] = [];

	function emitModule(moduleName: string) {
		if (emitted.has(moduleName)) {
			return;
		}
		const moduleInfo = moduleMap.get(moduleName);
		if (!moduleInfo) {
			return;
		}

		const result = transformModule(moduleName, moduleInfo, inlineableModules, externalImports, cache);
		for (const dep of result.dependencies) {
			emitModule(dep);
		}

		if (result.content.trim().length > 0) {
			sections.push(result.content);
		}

		emitted.add(moduleName);
	}

	emitModule(targetModule);

	return {
		sections,
		externalImports,
	};
}

async function main() {
	const args = parseArgs(process.argv);

	const cwd = process.cwd();
	const repoRoot = path.resolve(__dirname, "..");
	const sourcePath = path.resolve(cwd, args.sourcePath);
	const outputPath = args.outputPath
		? path.resolve(cwd, args.outputPath)
		: path.join(path.dirname(sourcePath), `${args.variableName}.type.d.ts`);

	const project = new Project({
		tsConfigFilePath: path.resolve(repoRoot, "tsconfig.json"),
	});

	const sourceFile = project.getSourceFile(sourcePath);
	if (!sourceFile) {
		throw new Error(`Unable to find source file: ${sourcePath}`);
	}

	if (!sourceFile.getVariableDeclaration(args.variableName)) {
		throw new Error(`Variable '${args.variableName}' not found in ${sourcePath}`);
	}

	const compilerOptions = project.getCompilerOptions();
	const rootDir = compilerOptions.rootDir ?? path.resolve(repoRoot, "src");

	const tsCompilerOptions: ts.CompilerOptions = {
		rootDir,
		baseUrl: rootDir,
		declaration: true,
		emitDeclarationOnly: true,
		skipLibCheck: compilerOptions.skipLibCheck ?? true,
		esModuleInterop: true,
		allowSyntheticDefaultImports: true,
		module: ts.ModuleKind.System,
		moduleResolution: ts.ModuleResolutionKind.Node10,
		outFile: path.join(repoRoot, ".xprv-extract-type.d.ts"),
	};

	if (compilerOptions.target !== undefined) {
		tsCompilerOptions.target = compilerOptions.target;
	} else {
		tsCompilerOptions.target = ts.ScriptTarget.ESNext;
	}

	if (compilerOptions.types) {
		tsCompilerOptions.types = compilerOptions.types;
	}

	if (compilerOptions.lib) {
		tsCompilerOptions.lib = compilerOptions.lib;
	}

	if (compilerOptions.paths) {
		tsCompilerOptions.paths = compilerOptions.paths;
	}

	if (compilerOptions.typeRoots) {
		tsCompilerOptions.typeRoots = compilerOptions.typeRoots;
	}

	const bundleText = createDeclarationBundle(sourcePath, tsCompilerOptions);
	const moduleMap = parseModuleMap(bundleText);

	const relativeModulePath = path.relative(rootDir, sourcePath).replace(/\\/g, "/");
	const moduleName = relativeModulePath.replace(/\.[^/.]+$/, "");

	if (!moduleMap.has(moduleName)) {
		throw new Error(`Failed to locate module '${moduleName}' in declaration bundle`);
	}

	const inlineableModules = new Set(moduleMap.keys());
	const { sections, externalImports } = buildDefinition(moduleMap, moduleName, inlineableModules);

	const header = [
		"// Generated by xprv-extract-type",
		`// Source: ${path.relative(repoRoot, sourcePath)} (variable ${args.variableName})`,
		`// Timestamp: ${new Date().toISOString()}`,
	];

	const importLines = Array.from(externalImports).sort();
	const body = sections.join("\n\n");

	const fileContents = [
		header.join("\n"),
		importLines.length > 0 ? importLines.join("\n") : "",
		body,
	]
		.filter((section) => section && section.trim().length > 0)
		.join("\n\n");

	await fs.mkdir(path.dirname(outputPath), { recursive: true });
	await fs.writeFile(outputPath, `${fileContents}\n`, "utf8");

	const relativeOutput = path.relative(cwd, outputPath);
	console.log(`Wrote type definition to ${relativeOutput}`);
}

main().catch((error) => {
	if (!process.exitCode) {
		process.exitCode = 1;
	}
	console.error(error instanceof Error ? error.message : error);
});
