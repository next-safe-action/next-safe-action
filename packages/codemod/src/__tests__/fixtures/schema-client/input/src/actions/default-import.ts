import client from "@/lib/default-client";
import { z } from "zod";

export const g = client.schema(z.string()).action(async () => null);
