import { z } from 'zod';
export const categories = [
  'Food & drink',
  'Coffee',
  'Outdoors',
  'Arts & culture',
  'Shopping',
  'Entertainment',
  'Other',
] as const;
export const ExtractionSchema = z.object({
  name: z.string().max(160).nullable(),
  city: z.string().max(120).nullable(),
  neighborhood: z.string().max(120).nullable(),
  category: z.enum(categories),
  description: z.string().max(1600).nullable(),
  durationMinutes: z.number().int().min(10).max(480).nullable(),
  cost: z
    .object({
      amount: z.number().min(0).max(100000),
      currency: z.string().length(3),
      evidence: z.string().max(500),
    })
    .nullable(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string().max(500)).max(8),
  missingInfo: z.array(z.string().max(300)).max(12),
});
export type Extraction = z.infer<typeof ExtractionSchema>;
export const PlaceSchema = z.object({
  id: z.string().min(1).max(100),
  sourceUrl: z.string().max(2000),
  sourceKind: z.enum(['link', 'description', 'video']),
  context: z.string().max(12000),
  fileName: z.string().max(200).optional(),
  duplicateKey: z.string().max(2100),
  state: z.enum(['queued', 'processing', 'ready', 'needs_review', 'failed']),
  stage: z.string().max(200),
  extraction: ExtractionSchema.nullable(),
  googlePlaceId: z.string().min(1).max(300).nullable(),
  verification: z.enum([
    'unverified',
    'matched',
    'ambiguous',
    'not_found',
    'unavailable',
    'confirmed',
  ]),
  error: z.string().max(2000).nullable(),
  image: z.string().max(300),
  sample: z.boolean(),
  createdAt: z.string(),
  task: z.enum(['extract', 'verify']).optional(),
  confirmedHours: z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .nullable()
    .optional(),
});
export type SavedPlace = z.infer<typeof PlaceSchema>;
// Provider-owned address, coordinates, opening hours and match alternatives are memory-only.
// Persist only Google Place IDs; do not add these fields to SavedPlace/localStorage.
export interface OpeningPoint {
  day: number;
  hour: number;
  minute: number;
  date?: { year: number; month: number; day: number };
}
export interface GooglePlace {
  id: string;
  name: string;
  address: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string;
  periods: { open: OpeningPoint; close?: OpeningPoint }[];
  currentPeriods: { open: OpeningPoint; close?: OpeningPoint }[];
  weekdayDescriptions: string[];
  businessStatus: string | null;
  attributions: { name: string; uri: string }[];
}
export interface VerificationResult {
  verification: SavedPlace['verification'];
  googlePlaceId: string | null;
  matches: GooglePlace[];
  message: string;
}
export interface ProcessResult extends VerificationResult {
  extraction: Extraction | null;
  state: SavedPlace['state'];
}
export interface Capabilities {
  ai: boolean;
  places: boolean;
  routes: boolean;
  video: boolean;
  maps?: boolean;
}
export interface OutingSuggestion {
  id: string;
  title: string;
  city: string;
  placeIds: string[];
  reason: string;
  image: string;
  sample: boolean;
  verifiedCount: number;
}
export interface ScheduledVisit {
  placeId: string;
  arrival: number;
  departure: number;
  travelMinutes: number;
  waitMinutes: number;
  reason: string;
}
export interface ScheduleResult {
  visits: ScheduledVisit[];
  omitted: { placeId: string; reason: string }[];
  warnings: string[];
  totalCost: number | null;
  quality: 'checked' | 'provisional';
  travelSource: 'google' | 'estimate';
  generatedAt: string;
}
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    alternatives: z.array(z.string()).optional(),
  }),
});
export interface LibraryRepository {
  load(): Promise<SavedPlace[] | null>;
  save(places: SavedPlace[]): Promise<void>;
}
const OpeningPointSchema = z.object({
  day: z.number(),
  hour: z.number(),
  minute: z.number(),
  date: z.object({ year: z.number(), month: z.number(), day: z.number() }).optional(),
});
export const GooglePlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  city: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  mapsUrl: z.string(),
  periods: z.array(z.object({ open: OpeningPointSchema, close: OpeningPointSchema.optional() })),
  currentPeriods: z.array(
    z.object({ open: OpeningPointSchema, close: OpeningPointSchema.optional() }),
  ),
  weekdayDescriptions: z.array(z.string()),
  businessStatus: z.string().nullable(),
  attributions: z.array(z.object({ name: z.string(), uri: z.string() })),
});
export const VerificationResultSchema = z.object({
  verification: PlaceSchema.shape.verification,
  googlePlaceId: z.string().nullable(),
  matches: z.array(GooglePlaceSchema).max(3),
  message: z.string(),
});
export const ProcessResultSchema = VerificationResultSchema.extend({
  extraction: ExtractionSchema.nullable(),
  state: PlaceSchema.shape.state,
});
export const ScheduleResultSchema = z.object({
  visits: z
    .array(
      z.object({
        placeId: z.string(),
        arrival: z.number(),
        departure: z.number(),
        travelMinutes: z.number(),
        waitMinutes: z.number(),
        reason: z.string(),
      }),
    )
    .max(6),
  omitted: z.array(z.object({ placeId: z.string(), reason: z.string() })),
  warnings: z.array(z.string()),
  totalCost: z.number().nullable(),
  quality: z.enum(['checked', 'provisional']),
  travelSource: z.enum(['google', 'estimate']),
  generatedAt: z.string(),
});
