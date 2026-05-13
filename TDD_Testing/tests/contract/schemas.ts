import { z } from 'zod';

export const ClientTypeSchema = z.enum(['Individual', 'Business', 'Enterprise', 'Non-profit']);
export const ClientStatusSchema = z.enum(['Active', 'Inactive', 'Prospect']);
export const IndustrySchema = z.enum([
  'Technology',
  'Healthcare',
  'Finance',
  'Retail',
  'Manufacturing',
  'Education',
  'Other',
]);

export const ClientSchema = z.object({
  id: z.string().min(1),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  companyName: z.string(),
  clientType: ClientTypeSchema,
  status: ClientStatusSchema,
  industry: IndustrySchema,
  annualRevenue: z.number().nullable(),
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ClientListSchema = z.array(ClientSchema);

export const LookupsSchema = z.object({
  clientTypes: z.array(ClientTypeSchema),
  statuses: z.array(ClientStatusSchema),
  industries: z.array(IndustrySchema),
});

export const ValidationErrorSchema = z.object({
  errors: z.record(z.string(), z.string()),
});
