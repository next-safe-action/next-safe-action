import { expect, test } from "vitest";
import { DEFAULT_SERVER_ERROR_MESSAGE, createSafeActionClient } from "..";

class ActionError extends Error {}

const ac1 = createSafeActionClient({
	handleServerError(e) {
		// disable server error logging for these tests
		if (e instanceof ActionError) {
			return e.message;
		}

		return DEFAULT_SERVER_ERROR_MESSAGE;
	},
});

test("unknown error occurred in server code function is masked by default", async () => {
	const action = ac1.action(async () => {
		throw new Error("Something bad happened");
	});

	const actualResult = await action();

	const expectedResult = {
		serverError: DEFAULT_SERVER_ERROR_MESSAGE,
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("unknown error occurred in middleware function is masked by default", async () => {
	const action = ac1
		.use(async ({ next }) => next())
		.use(async () => {
			throw new Error("Something bad happened");
		})
		.action(async () => {
			return {
				ok: true,
			};
		});

	const actualResult = await action();

	const expectedResult = {
		serverError: DEFAULT_SERVER_ERROR_MESSAGE,
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("known error occurred in server code function is unmasked", async () => {
	const action = ac1.action(async () => {
		throw new ActionError("Something bad happened");
	});

	const actualResult = await action();

	const expectedResult = {
		serverError: "Something bad happened",
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("known error occurred in middleware function is unmasked", async () => {
	const action = ac1
		.use(async ({ next }) => next())
		.use(async () => {
			throw new ActionError("Something bad happened");
		})
		.action(async () => {
			return {
				ok: true,
			};
		});

	const actualResult = await action();

	const expectedResult = {
		serverError: "Something bad happened",
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("error occurred with `throwServerError` set to true at the action level throws", async () => {
	const action = ac1.action(
		async () => {
			throw new Error("Something bad happened");
		},
		{ throwServerError: true }
	);

	await expect(async () => await action()).rejects.toThrow();
});

// Server error is an object with a 'message' property.
const ac2 = createSafeActionClient({
	handleServerError(e) {
		// disable server errors logging for these tests
		return {
			message: e.message,
		};
	},
});

test("error occurred in server code function has the correct shape defined by `handleServerError`", async () => {
	const action = ac2.action(async () => {
		throw new Error("Something bad happened");
	});

	const actualResult = await action();

	const expectedResult = {
		serverError: { message: "Something bad happened" },
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("error occurred in middleware function has the correct shape defined by `handleServerError`", async () => {
	const action = ac2
		.use(async ({ next }) => next())
		.use(async () => {
			throw new Error("Something bad happened");
		})
		.action(async () => {
			return {
				ok: true,
			};
		});

	const actualResult = await action();

	const expectedResult = {
		serverError: { message: "Something bad happened" },
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

// Rethrow all server errors.
const ac3 = createSafeActionClient({
	handleServerError(e) {
		// disable server error logging for these tests
		throw e;
	},
});

test("action throws if an error occurred in server code function and `handleServerError` rethrows it", async () => {
	const action = ac3.action(async () => {
		throw new Error("Something bad happened");
	});

	await expect(() => action()).rejects.toThrow();
});

test("action throws if an error occurred in middleware function and `handleServerError` rethrows it", async () => {
	const action = ac3
		.use(async ({ next }) => next())
		.use(async () => {
			throw new Error("Something bad happened");
		})
		.action(async () => {
			return {
				ok: true,
			};
		});

	await expect(() => action()).rejects.toThrow();
});
