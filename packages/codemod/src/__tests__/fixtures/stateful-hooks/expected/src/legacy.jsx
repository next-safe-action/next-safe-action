import { useStateAction } from "next-safe-action/hooks";

export const Legacy = () => <div>{String(useStateAction)}</div>;
