import type { Type } from "ts-morph";

export interface FormattedTypeInfo {
	variableName: string;
	typeText: string;
	symbolName: string | undefined;
	typeArguments: string[] | undefined;
	properties: string[] | undefined;
}

export function formatType(variableName: string, type: Type): FormattedTypeInfo {
	const typeText = type.getText();
	const symbol = type.getSymbol();
	const symbolName = symbol?.getName();

	// Extract type arguments if present
	const typeArguments = type.getTypeArguments();
	const typeArgumentsArray = typeArguments.length > 0 
		? typeArguments.map((arg) => arg.getText())
		: undefined;

	// Extract properties if it's an object type
	let propertiesArray: string[] | undefined = undefined;
	if (type.isObject()) {
		const properties = type.getProperties();
		if (properties.length > 0) {
			propertiesArray = properties.map((prop) => prop.getName()).slice(0, 10); // Limit to first 10
		}
	}

	return {
		variableName,
		typeText,
		symbolName,
		typeArguments: typeArgumentsArray,
		properties: propertiesArray,
	};
}

export function printFormattedType(info: FormattedTypeInfo): void {
	console.log("\n=== Type Information ===\n");
	console.log(`Variable: ${info.variableName}`);
	
	if (info.symbolName) {
		console.log(`Symbol Name: ${info.symbolName}`);
	}
	
	console.log(`\nType:\n${info.typeText}`);

	if (info.typeArguments && info.typeArguments.length > 0) {
		console.log(`\nType Arguments (${info.typeArguments.length}):`);
		info.typeArguments.forEach((arg, index) => {
			console.log(`  [${index}]: ${arg}`);
		});
	}

	if (info.properties && info.properties.length > 0) {
		console.log(`\nProperties (showing first ${info.properties.length}):`);
		info.properties.forEach((prop) => {
			console.log(`  - ${prop}`);
		});
	}

	console.log("\n========================\n");
}

