"use server";

import { actionClient as ac } from "@/lib/safe-action";
import { z } from "zod";

export const a = ac.schema(z.object({ id: z.string() })).action(async () => "ok");
