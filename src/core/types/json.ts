type JsonPrimitive = string | number | boolean | null;

type JsonObject = { [key: string]: ValidJson };
type JsonArray = ValidJson[];

type ValidJson = JsonPrimitive | JsonObject | JsonArray;

// Recursively check if T is JSON-compatible (mirrors ValidJson structure)
// NEEDED FOR ACCEPTING INTERFACES WITHOUT INDEX SIGNATURES
export type AssertValidJson<T> = T extends ValidJson
	? T
	: T extends readonly (infer U)[]
	? U extends ValidJson
		? readonly AssertValidJson<U>[]
		: never
	: T extends object
	? { [K in keyof T]: T[K] extends ValidJson ? AssertValidJson<T[K]> : never }
	: never;

function onlyAcceptsValidJson<T>(val: AssertValidJson<T>): AssertValidJson<T> {
	return val;
}

const validJson = {
	name: "John",
	age: 30,
	city: "New York",
};

const invalidJson = {
	name: "John",
	dob: new Date(),
};

// This should work
onlyAcceptsValidJson(validJson);

// This should not work
// @ts-expect-error
onlyAcceptsValidJson(invalidJson); // Error: Argument of type `typeof invalidJson` is not assignable to parameter of type `ValidJson`.

interface User {
	name: string;
	age: number;
	city: string;
}

function createRandomUser(): User {
	return {
		name: "John",
		age: 30,
		city: "New York",
	};
}

onlyAcceptsValidJson(createRandomUser());
