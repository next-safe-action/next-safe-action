import { z } from "zod";

export const buyProductSchema = z.object({
	productId: z.string().min(1, "Product ID is required"),
	quantity: z.coerce.number().min(1, "Must order at least 1").max(99, "Max 99 items"),
});

export const addItemSchema = z.object({
	name: z.string().min(1, "Name is required").max(50),
});
