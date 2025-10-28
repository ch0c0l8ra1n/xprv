import { Node, Type } from "ts-morph";
import * as TJS from "ts-json-schema-generator";
import { cleanSymbolName } from "./utils.js";
import { splitUndefined } from "./type-utils.js";

export class SchemaGenerator {
	private readonly generator: TJS.SchemaGenerator;
	private readonly components = new Map<string, unknown>();

	constructor(tsconfigPath: string, sourceFilePath: string) {
		const config: TJS.Config = {
			path: sourceFilePath,
			tsconfig: tsconfigPath,
			type: "*",
			expose: "all",
			topRef: true,
			jsDoc: "extended",
			skipTypeCheck: false,
		};

		this.generator = TJS.createGenerator(config)!;
		if (!this.generator) {
			throw new Error("Failed to create schema generator");
		}
	}

	getComponents(): Record<string, unknown> {
		return Object.fromEntries(this.components);
	}

	getSchemaFor(typeList: Type[]): unknown {
		if (typeList.length === 0) {
			return {};
		}
		const [first, ...rest] = typeList;
		if (!first) {
			return {};
		}
		if (rest.length === 0) {
			return this.getSchema(first);
		}
		return {
			oneOf: [this.getSchema(first), ...rest.map((type) => this.getSchema(type))],
		};
	}

	private tryGenerateSchemaByName(type: Type): unknown | null {
		const symbol = type.getSymbol();
		if (!symbol) {
			return null;
		}

		const name = symbol.getName();
		if (!name || name.startsWith("__")) {
			return null;
		}

		const declarations = symbol.getDeclarations() ?? [];
		const isNamed = declarations.some((decl) =>
			Node.isInterfaceDeclaration(decl) ||
			Node.isClassDeclaration(decl) ||
			Node.isTypeAliasDeclaration(decl) ||
			Node.isEnumDeclaration(decl)
		);

		if (!isNamed) {
			return null;
		}

		try {
			const schema = this.generator.createSchema(name);
			if (!schema) {
				return null;
			}

			if (schema.definitions) {
				for (const [defName, defSchema] of Object.entries(schema.definitions)) {
					if (!this.components.has(defName)) {
						this.components.set(defName, defSchema);
					}
				}
				delete schema.definitions;
			}

			if ("$schema" in schema) {
				const { $schema, ...rest } = schema as any;
				return Object.keys(rest).length > 0 ? rest : schema;
			}

			return schema;
		} catch {
			return null;
		}
	}

	getSchema(type: Type): unknown {
		const librarySchema = this.tryGenerateSchemaByName(type);
		if (librarySchema) {
			return librarySchema;
		}

		if (type.isNever()) return { not: {} };
		if (type.isAny()) return { description: "Any value" };
		if (type.isUnknown()) return { description: "Unknown value" };
		if (type.isVoid()) return { type: "null" };
		if (type.isNull()) return { type: "null" };
		if (type.isUndefined()) return {};

		if (type.isBoolean()) return { type: "boolean" };
		if (type.isNumber()) return { type: "number" };
		if (type.isString()) return { type: "string" };

		if (type.isStringLiteral()) {
			return { type: "string", enum: [type.getLiteralValue()] };
		}
		if (type.isNumberLiteral()) {
			return { type: "number", enum: [type.getLiteralValue()] };
		}
		if (type.isBooleanLiteral()) {
			return { type: "boolean", enum: [type.getLiteralValue()] };
		}

		const typeText = type.getText();
		if (typeText === "bigint") return { type: "integer", format: "int64" };
		if (typeText === "symbol") return { type: "string", description: "Symbol (serialized as string)" };
		if (typeText.match(/^\d+n$/)) {
			return { type: "integer", format: "int64", enum: [Number(typeText.slice(0, -1))] };
		}

		if (type.isTuple()) {
			const tupleElements = type.getTupleElements();
			return tupleElements.length === 0
				? { type: "array", items: {} }
				: {
						type: "array",
						prefixItems: tupleElements.map((item) => this.getSchema(item)),
						minItems: tupleElements.length,
				  };
		}

		if (type.isArray()) {
			const element = type.getArrayElementType();
			return { type: "array", items: element ? this.getSchema(element) : {} };
		}

		if (type.isIntersection()) {
			return { allOf: type.getIntersectionTypes().map((p) => this.getSchema(p)) };
		}

		if (type.isUnion()) {
			const parts = type.getUnionTypes();

			if (parts.every((p) => p.isStringLiteral())) {
				return { type: "string", enum: parts.map((p) => p.getLiteralValue()) };
			}
			if (parts.every((p) => p.isNumberLiteral())) {
				return { type: "number", enum: parts.map((p) => p.getLiteralValue()) };
			}
			if (parts.every((p) => p.isBooleanLiteral())) {
				return { type: "boolean" };
			}

			const filtered = parts.filter((p) => !p.isUndefined());
			const schema = this.getSchemaFor(filtered);
			if (schema && typeof schema === "object" && filtered.length !== parts.length) {
				return { ...(schema as Record<string, unknown>), nullable: true };
			}
			return schema;
		}

		if (type.isObject()) {
			const symbol = type.getSymbol();
			if (symbol) {
				const name = symbol.getName();

				if (name === "Promise") {
					const args = type.getTypeArguments();
					return args[0] ? this.getSchema(args[0]) : {};
				}

				if (name === "Date") return { type: "string", format: "date-time" };
				if (name === "RegExp") return { type: "string", format: "regex" };
				if (name === "Map") return { type: "object", additionalProperties: {} };
				if (name === "Set") return { type: "array", items: {}, uniqueItems: true };

				if (name === "Partial" || name === "Required" || name === "Readonly" || 
				    name === "Pick" || name === "Omit") {
					const args = type.getTypeArguments();
					return args[0] ? this.getSchema(args[0]) : {};
				}

				if (name === "Record") {
					const args = type.getTypeArguments();
					return {
						type: "object",
						additionalProperties: args[1] ? this.getSchema(args[1]) : {},
					};
				}

				if (name === "Array" || name === "ReadonlyArray") {
					const args = type.getTypeArguments();
					return {
						type: "array",
						items: args[0] ? this.getSchema(args[0]) : {},
					};
				}
			}

			return this.buildSimpleObjectSchema(type);
		}

		return {};
	}

	private buildSimpleObjectSchema(type: Type): unknown {
		const properties = type.getProperties();
		const schema: Record<string, unknown> = { type: "object" };
		const propSchemas: Record<string, unknown> = {};
		const required: string[] = [];

		for (const property of properties) {
			const name = cleanSymbolName(property);
			if (!name) {
				continue;
			}
			const declaration = property.getValueDeclaration() ?? property.getDeclarations()[0];
			const propertyType = declaration
				? property.getTypeAtLocation(declaration)
				: property.getDeclaredType();
			const { types, optional } = splitUndefined(propertyType);
			const schemaValue = this.getSchemaFor(types);
			propSchemas[name] = schemaValue;
			if (!optional && !property.isOptional()) {
				required.push(name);
			}
		}

		if (Object.keys(propSchemas).length > 0) {
			schema.properties = propSchemas;
		}

		if (required.length > 0) {
			schema.required = required;
		}

		const indexType = type.getStringIndexType();
		if (indexType) {
			schema.additionalProperties = this.getSchema(indexType);
		}

		return schema;
	}
}

