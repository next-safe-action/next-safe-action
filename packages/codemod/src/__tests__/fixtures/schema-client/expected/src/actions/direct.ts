import * as nsa from "next-safe-action";
import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";

export const e = createSafeActionClient().inputSchema(z.string());
export const f = nsa.createSafeActionClient().bindArgsSchemas([]).inputSchema(z.string());
