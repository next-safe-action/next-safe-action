import { makeClient } from "@/lib/factory";
import { z } from "zod";

export const w = makeClient().schema(z.string()).action(async () => null);
