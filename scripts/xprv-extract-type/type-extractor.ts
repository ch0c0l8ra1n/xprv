import { Project, Type } from "ts-morph";

export interface TypeInfo {
	typeText: string;
	type: Type;
	symbolName: string | undefined;
}

export class TypeExtractor {
	private readonly project: Project;

	constructor(tsconfigPath: string) {
		this.project = new Project({
			tsConfigFilePath: tsconfigPath,
		});
	}

	extractVariableType(sourcePath: string, variableName: string): TypeInfo {
		// Try to get existing source file, or add it if not already in project
		let sourceFile = this.project.getSourceFile(sourcePath);
		if (!sourceFile) {
			sourceFile = this.project.addSourceFileAtPath(sourcePath);
		}

		const variableDeclaration = sourceFile.getVariableDeclaration(variableName);
		if (!variableDeclaration) {
			throw new Error(`Variable '${variableName}' not found in ${sourcePath}`);
		}

		const type = variableDeclaration.getType();
		const typeText = type.getText();
		const symbol = type.getSymbol();
		const symbolName = symbol?.getName();

		return {
			typeText,
			type,
			symbolName,
		};
	}
}

