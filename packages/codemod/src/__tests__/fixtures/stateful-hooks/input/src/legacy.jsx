import { useStateAction } from "next-safe-action/stateful-hooks";

export const Legacy = () => <div>{String(useStateAction)}</div>;
