import * as nsa from "next-safe-action";
import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";

export const e = createSafeActionClient().schema(z.string());
export const f = nsa.createSafeActionClient().bindArgsSchemas([]).schema(z.string());
