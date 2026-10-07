"use server";

import { z } from "zod";
import { authClient } from "../lib";

export const b = authClient.inputSchema(z.string()).action(async ({ parsedInput }) => parsedInput);
