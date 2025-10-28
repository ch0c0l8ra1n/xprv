// example/server.ts

import xprv from "xprv";
import express from "express";
import z from "zod";


const pingNode = xprv.node({
	path: "/ping",
	handlers: {
		get: xprv.handler.handle(() => {
			return xprv.json({
				status: 200,
				body: {
					message: "pong!",
				},
				headers: {
					"X-Custom": "value",
				},
			});
		}),
	},
});

const calculatorNode = xprv.node({
	path: "/calculator",
	handlers: {
		post: xprv.handler
			.withInput({
				body: z.object({
					a: z.number(),
					b: z.number(),
					operation: z.enum([
						"add",
						"subtract",
						"multiply",
						"divide",
					]),
				}),
			})
			.handle((input, context) => {
				/*
                (parameter) input: JsonRequest<unknown, unknown, unknown, {
                    a: number;
                    b: number;
                    operation: "add" | "subtract" | "multiply" | "divide";
                }>
                */
				let result: number;
				switch (input.body.operation) {
					case "add":
						result = input.body.a + input.body.b;
						break;
					case "subtract":
						result = input.body.a - input.body.b;
						break;
					case "multiply":
						result = input.body.a * input.body.b;
						break;
					case "divide":
						if (input.body.b === 0) {
							return xprv.json({
								status: 400,
								body: {
									error: "Division by zero",
								},
							});
						}
						result = input.body.a / input.body.b;
						break;
				}
				return xprv.json({
					status: 200,
					body: {
						result,
					},
				});
			}),
	},
});

const utilsNode = xprv.node({
	path: "/utils",
	children: [pingNode, calculatorNode],
});

const rootNode = xprv.node({
	path: "/",
	children: [utilsNode],
});

export const xprvApp = xprv.app({
	rootNode,
	errorHandlers: {
		onInternalServerError: (error, req, res) => {
			return xprv.json({
				status: 500,
				body: { message: "Internal server error" },
			});
		},
	},
});

export type xprvAppType = typeof xprvApp;

const router = xprvApp.buildRouter();

const app = express();

app.use(router);

app.listen(3000, () => {
	console.log("Server is running on port 3000");
});
