import { z } from 'zod';

export const loginInputSchema = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string().min(1).max(128),
});
export const hrUserSchema = z.strictObject({
  id: z.uuid(),
  email: z.email(),
  role: z.literal('HR_MANAGER'),
});
export const csrfResponseSchema = z.object({
  data: z.object({ csrfToken: z.string().regex(/^[a-f0-9]{64}$/) }),
});
export const meResponseSchema = z.object({
  data: z.object({ user: hrUserSchema }),
});
export const loginResponseSchema = z.object({
  data: z.object({
    user: hrUserSchema,
    csrfToken: z.string().regex(/^[a-f0-9]{64}$/),
  }),
});
export type LoginInput = z.infer<typeof loginInputSchema>;
export type HrUser = z.infer<typeof hrUserSchema>;
