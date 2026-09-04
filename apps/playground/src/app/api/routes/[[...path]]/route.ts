import { createRouteHandlers } from "@next-safe-action/adapter-routes";
import { routeCounter } from "../actions";

export const { POST, PUT, PATCH, DELETE, OPTIONS } = createRouteHandlers({ actions: [routeCounter] });
