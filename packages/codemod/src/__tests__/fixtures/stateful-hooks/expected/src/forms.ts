export { useStateAction } from 'next-safe-action/hooks';

export const load = () => import("next-safe-action/hooks");
const cjs = require("next-safe-action/hooks");

vi.mock("next-safe-action/hooks", () => ({ useStateAction: vi.fn() }));
jest.mock(`next-safe-action/hooks`);

export { cjs };
