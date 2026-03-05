import { redirect } from "next/navigation";
import { expect, test } from "vitest";
import { z } from "zod";
import {
	createMiddleware,
	createSafeActionClient,
	DEFAULT_SERVER_ERROR_MESSAGE,
	formatValidationErrors,
	returnValidationErrors,
} from "..";
import { FrameworkErrorHandler } from "../next/errors";

const ac = createSafeActionClient({
	handleServerError(e) {
		// disable server error logging for these tests
		return {
			message: e.message,
		};
	},
}).use(async ({ next }) => {
	return next({ ctx: { foo: "bar" } });
});

test("instance context value is accessible in server code function", async () => {
	const action = ac.action(async ({ ctx }) => {
		return {
			ctx,
		};
	});

	const actualResult = await action();
	const expectedResult = {
		data: {
			ctx: { foo: "bar" },
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("instance context value is extended in action middleware and both values are accessible in server code function", async () => {
	const action = ac
		.use(async ({ next }) => {
			return next({ ctx: { bar: "baz" } });
		})
		.action(async ({ ctx }) => {
			return {
				ctx,
			};
		});

	const actualResult = await action();
	const expectedResult = {
		data: {
			ctx: { foo: "bar", bar: "baz" },
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("instance context value is correctly overridden in subsequent middleware", async () => {
	const action = ac
		.use(async ({ next }) => {
			return next({ ctx: { foo: "baz" } });
		})
		.use(async ({ ctx, next }) => {
			if (ctx.foo !== "baz") {
				throw new Error("Expected ctx.foo to be 'baz'");
			}
			return next();
		})
		.action(async ({ ctx }) => {
			return {
				ctx,
			};
		});

	const actualResult = await action();
	const expectedResult = {
		data: {
			ctx: { foo: "baz" },
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action client inputs are passed to middleware", async () => {
	const action = ac
		.inputSchema(async () =>
			z.object({
				username: z.string(),
			})
		)
		.bindArgsSchemas([z.object({ age: z.number().positive() })])
		.use(async ({ clientInput, bindArgsClientInputs, next }) => {
			return next({ ctx: { clientInput, bindArgsClientInputs } });
		})
		.action(async ({ ctx }) => {
			return {
				clientInput: ctx.clientInput,
				bindArgsClientInputs: ctx.bindArgsClientInputs,
			};
		});

	const inputs = [{ age: 30 }, { username: "johndoe" }] as const;

	const actualResult = await action(...inputs);

	const expectedResult = {
		data: {
			bindArgsClientInputs: [inputs[0]],
			clientInput: inputs[1],
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("invalid bind args give back a serverError result", async () => {
	const action = ac
		.inputSchema(async () =>
			z.object({
				username: z.string(),
			})
		)
		.bindArgsSchemas([z.object({ age: z.number().positive() })])
		.use(async ({ clientInput, bindArgsClientInputs, next }) => {
			return next({ ctx: { clientInput, bindArgsClientInputs } });
		})
		.action(async ({ ctx }) => {
			return {
				clientInput: ctx.clientInput,
				bindArgsClientInputs: ctx.bindArgsClientInputs,
			};
		});

	const inputs = [{ age: -1 }, { username: "johndoe" }] as const;

	const actualResult = await action(...inputs);

	const expectedResult = {
		serverError: {
			message: "Server Action bind args validation error(s) occurred",
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("happy path execution result from middleware is correct", async () => {
	let middlewareResult = {};

	const action = ac
		.inputSchema(async () =>
			z.object({
				username: z.string(),
			})
		)
		.bindArgsSchemas([z.object({ age: z.number().positive() })])
		.use(async ({ next }) => {
			// Await action execution.
			const res = await next();
			middlewareResult = res;
			return res;
		})
		.action(async () => {
			return {
				ok: "123",
			};
		});

	const inputs = [{ age: 30 }, { username: "johndoe" }] as const;
	await action(...inputs);

	const expectedResult = {
		success: true,
		ctx: {
			foo: "bar",
		},
		data: {
			ok: "123",
		},
		parsedInput: {
			username: "johndoe",
		},
		bindArgsParsedInputs: [
			{
				age: 30,
			},
		],
	};

	expect(middlewareResult).toStrictEqual(expectedResult);
});

test("server error execution result from middleware is correct", async () => {
	let middlewareResult = {};

	const action = ac
		.inputSchema(async () =>
			z.object({
				username: z.string(),
			})
		)
		.bindArgsSchemas([z.object({ age: z.number().positive() })])
		.use(async ({ next }) => {
			// Await action execution.
			const res = await next();
			middlewareResult = res;
			return res;
		})
		.action(async () => {
			throw new Error("Server error message");
		});

	const inputs = [{ age: 30 }, { username: "johndoe" }] as const;
	await action(...inputs);

	const expectedResult = {
		success: false,
		ctx: {
			foo: "bar",
		},
		serverError: {
			message: "Server error message",
		},
	};

	expect(middlewareResult).toStrictEqual(expectedResult);
});

test("validation errors in execution result from middleware are correct", async () => {
	let middlewareResult = {};

	const action = ac
		.inputSchema(async () =>
			z.object({
				username: z.string().max(3),
			})
		)
		.use(async ({ next }) => {
			// Await action execution.
			const res = await next();
			middlewareResult = res;
			return res;
		})
		.action(async () => {
			return {
				ok: "123",
			};
		});

	await action({ username: "johndoe" });

	const expectedResult = {
		success: false,
		ctx: {
			foo: "bar",
		},
		validationErrors: {
			username: {
				_errors: ["Too big: expected string to have <=3 characters"],
			},
		},
	};

	expect(middlewareResult).toStrictEqual(expectedResult);
});

test("server validation errors in execution result from middleware are correct", async () => {
	let middlewareResult = {};

	const schema = z.object({
		username: z.string(),
	});

	const action = ac
		.inputSchema(schema)
		.bindArgsSchemas([z.object({ age: z.number().positive() })])
		.use(async ({ next }) => {
			// Await action execution.
			const res = await next();
			middlewareResult = res;
			return res;
		})
		.action(async () => {
			returnValidationErrors(schema, {
				username: {
					_errors: ["User suspended"],
				},
			});
		});

	const inputs = [{ age: 30 }, { username: "johndoe" }] as const;
	await action(...inputs);

	const expectedResult = {
		success: false,
		ctx: {
			foo: "bar",
		},
		validationErrors: {
			username: {
				_errors: ["User suspended"],
			},
		},
	};

	expect(middlewareResult).toStrictEqual(expectedResult);
});

test("framework error result from middleware is correct", async () => {
	let middlewareResult = {};

	const action = ac
		.inputSchema(async () =>
			z.object({
				username: z.string(),
			})
		)
		.bindArgsSchemas([z.object({ age: z.number().positive() })])
		.use(async ({ next }) => {
			// Await action execution.
			const res = await next();
			middlewareResult = res;
			return res;
		})
		.action(async () => {
			redirect("/newPath");
		});

	const inputs = [{ age: 30 }, { username: "johndoe" }] as const;
	await action(...inputs).catch((e) => {
		if (!FrameworkErrorHandler.isNavigationError(e)) {
			throw e;
		}
	});

	const expectedResult = {
		success: false,
		ctx: {
			foo: "bar",
		},
		navigationKind: "redirect",
		parsedInput: {
			username: "johndoe",
		},
		bindArgsParsedInputs: [
			{
				age: 30,
			},
		],
	};

	expect(middlewareResult).toStrictEqual(expectedResult);
});

test("framework error is thrown within middleware", async () => {
	const action = ac
		.use(async () => {
			redirect("/newPath");
		})
		.action(async () => {
			return null;
		});

	try {
		await action();
		expect.unreachable("A framework error to be thrown");
	} catch (e) {
		expect(FrameworkErrorHandler.isNavigationError(e)).toBe(true);
	}
});

// Flattened validation errors shape.

const flac = createSafeActionClient({
	handleServerError: () => DEFAULT_SERVER_ERROR_MESSAGE, // disable server errors logging for these tests
	defaultValidationErrorsShape: "flattened",
});

test("flattened validation errors in execution result from middleware are correct", async () => {
	let middlewareResult = {};

	const action = flac
		.inputSchema(async () =>
			z.object({
				username: z.string().max(3),
			})
		)
		.use(async ({ next }) => {
			// Await action execution.
			const res = await next();
			middlewareResult = res;
			return res;
		})
		.action(async () => {
			return {
				ok: "123",
			};
		});

	await action({ username: "johndoe" });

	const expectedResult = {
		success: false,
		ctx: {},
		validationErrors: {
			formErrors: [],
			fieldErrors: {
				username: ["Too big: expected string to have <=3 characters"],
			},
		},
	};

	expect(middlewareResult).toStrictEqual(expectedResult);
});

test("overridden formatted validation errors in execution result from middleware are correct", async () => {
	let middlewareResult = {};

	const action = flac
		.inputSchema(
			async () =>
				z.object({
					username: z.string().max(3),
				}),
			{ handleValidationErrorsShape: async (ve) => formatValidationErrors(ve) }
		)
		.use(async ({ next }) => {
			// Await action execution.
			const res = await next();
			middlewareResult = res;
			return res;
		})
		.action(async () => {
			return {
				ok: "123",
			};
		});

	await action({ username: "johndoe" });

	const expectedResult = {
		success: false,
		ctx: {},
		validationErrors: {
			username: {
				_errors: ["Too big: expected string to have <=3 characters"],
			},
		},
	};

	expect(middlewareResult).toStrictEqual(expectedResult);
});

test("standalone middleware extends context", async () => {
	const myMiddleware = createMiddleware<{ ctx: { foo: string } }>().define(async ({ next }) => {
		return next({ ctx: { baz: "qux" } });
	});

	const action = ac.use(myMiddleware).action(async ({ ctx }) => {
		return {
			ctx,
		};
	});

	const actualResult = await action();
	const expectedResult = {
		data: {
			ctx: { foo: "bar", baz: "qux" },
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});
