import client from "@/lib/default-client";
import { z } from "zod";

export const g = client.inputSchema(z.string()).action(async () => null);
