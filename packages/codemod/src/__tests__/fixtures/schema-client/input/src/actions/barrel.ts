"use server";

import { z } from "zod";
import { authClient } from "../lib";

export const b = authClient.schema(z.string()).action(async ({ parsedInput }) => parsedInput);
