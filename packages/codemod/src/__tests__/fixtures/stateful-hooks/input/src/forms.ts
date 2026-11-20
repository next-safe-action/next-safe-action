export { useStateAction } from 'next-safe-action/stateful-hooks';

export const load = () => import("next-safe-action/stateful-hooks");
const cjs = require("next-safe-action/stateful-hooks");

vi.mock("next-safe-action/stateful-hooks", () => ({ useStateAction: vi.fn() }));
jest.mock(`next-safe-action/stateful-hooks`);

export { cjs };
