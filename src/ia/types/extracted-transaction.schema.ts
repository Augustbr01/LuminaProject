import { Category } from '@prisma/client';
import { z } from 'zod';

export const ExtractedTransactionSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format'),
  description: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(['debit', 'credit']),
  category: z.enum(Category),
  confidence: z.number().min(0).max(1),
});

export const ExtractedTransactionsResponseSchema = z.object({
  transactions: z.array(ExtractedTransactionSchema),
});

export type ExtractedTransaction = z.infer<typeof ExtractedTransactionSchema>;
export type ExtractedTransactionsResponse = z.infer<
  typeof ExtractedTransactionsResponseSchema
>;
