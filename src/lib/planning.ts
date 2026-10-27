import { z } from 'zod';
import { PlaceSchema } from './library-types';
export const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const PlanningPreferencesSchema = z
  .object({
    city: z.string().trim().min(1).max(120),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((v) => {
        const d = new Date(v + 'T12:00:00Z');
        return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
      }, 'Choose a valid date'),
    time: TimeSchema,
    endTime: TimeSchema.default('17:00'),
    budget: z
      .string()
      .refine(
        (s) =>
          s.trim() !== '' && Number.isFinite(Number(s)) && Number(s) >= 0 && Number(s) <= 10000,
        'Use a budget from 0 to 10000 USD',
      ),
    transport: z.enum(['Walking', 'Public transit', 'Driving']),
    pace: z.enum(['Easygoing', 'A little of everything', 'Pack it in']),
    startingLocation: z.string().max(200).default(''),
    allowUnknownCosts: z.boolean().default(false),
    allowRegularHours: z.boolean().default(false),
  })
  .refine((p) => {
    const [h, m] = p.time.split(':').map(Number);
    const [eh, em] = p.endTime.split(':').map(Number);
    return eh * 60 + em > h * 60 + m && eh * 60 + em - h * 60 - m <= 960;
  }, 'End time must follow start time within a same-day window of up to 16 hours.');
export type PlanningPreferences = z.infer<typeof PlanningPreferencesSchema>;
export const PlanningRequestSchema = z.object({
  places: z.array(PlaceSchema).min(1).max(6),
  preferences: PlanningPreferencesSchema,
  lockedIds: z.array(z.string().max(100)).max(6).default([]),
  fixedOrder: z.array(z.string().max(100)).max(6).optional(),
});
export const minutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};
export const clock = (minute: number) =>
  new Date(Date.UTC(2000, 0, 1, 0, minute)).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
