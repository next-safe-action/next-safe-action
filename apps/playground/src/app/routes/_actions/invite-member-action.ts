"use server";

import { z } from "zod";
import { actionClient } from "../_lib/route-client";
import { inviteBodySchema } from "../_lib/shared";

export const inviteMember = actionClient
	.inputSchema(inviteBodySchema.extend({ orgId: z.string() }))
	.outputSchema(inviteBodySchema.extend({ orgId: z.string(), role: z.literal("member") }))
	.action(async ({ parsedInput }) => {
		// Demonstration only: nothing is stored or sent.
		return { ...parsedInput, role: "member" as const };
	});
