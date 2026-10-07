"use server";

import * as lib from "@/lib/safe-action";
import { z } from "zod";

export const n = lib.actionClient.schema(z.string()).action(async () => null);
