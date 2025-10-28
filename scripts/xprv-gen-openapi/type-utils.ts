import type { Type } from "ts-morph";

export function splitUndefined(type: Type): { types: Type[]; optional: boolean } {
	if (type.isUnion()) {
		const all = type.getUnionTypes();
		const filtered = all.filter((t) => !t.isUndefined());
		return {
			types: filtered,
			optional: filtered.length !== all.length,
		};
	}
	return { types: [type], optional: false };
}

export function isTrivialRequestComponent(type: Type | undefined): boolean {
	if (!type) {
		return true;
	}
	if (type.isUndefined() || type.isUnknown() || type.isAny() || type.isVoid() || type.isNever()) {
		return true;
	}
	if (type.isUnion()) {
		return type.getUnionTypes().every((unionMember) => isTrivialRequestComponent(unionMember));
	}
	if (type.isObject()) {
		const properties = type.getProperties();
		if (properties.length === 0 && !type.getStringIndexType()) {
			return true;
		}
	}
	return false;
}

export function hasRequestValidation(requestType: Type | undefined): boolean {
	if (!requestType) {
		return false;
	}
	const args = requestType.getTypeArguments();
	if (args.length < 4) {
		return false;
	}
	return args.some((arg) => !isTrivialRequestComponent(arg));
}

