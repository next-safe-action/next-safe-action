"use server";

import * as lib from "@/lib/safe-action";
import { z } from "zod";

export const n = lib.actionClient.inputSchema(z.string()).action(async () => null);
