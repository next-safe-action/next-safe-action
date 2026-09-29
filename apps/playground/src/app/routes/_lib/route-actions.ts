import { routeCounter } from "../_actions/counter-action";
import { createReport } from "../_actions/create-report-action";
import { reserveUsername } from "../_actions/reserve-username-action";
import { addToTotal } from "../_actions/running-total-action";
import { updateTodo } from "../_actions/update-todo-action";

// One list, shared by the catch-all route handler and the OpenAPI route, so both always describe the same endpoints.
export const routeActions = [routeCounter, updateTodo, reserveUsername, addToTotal, createReport];
