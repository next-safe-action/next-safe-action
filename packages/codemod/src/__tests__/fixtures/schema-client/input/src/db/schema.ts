import { actionClient } from "@/lib/safe-action";
import { drizzle } from "drizzle-orm/node-postgres";
import { z } from "zod";

const db = drizzle("postgres://localhost/db");

export const tables = db.schema("app");
export const shape = z.object({}).schema("unrelated");
export const afterAction = actionClient.action(async () => 1).schema("not a client");
