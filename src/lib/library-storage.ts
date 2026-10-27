import { z } from 'zod';
import { PlaceSchema, type LibraryRepository, type SavedPlace } from './library-types';
import type { Plan, Video } from './types';
export const LIBRARY_KEY = 'tiktok-plans:places:v1';
export const localLibraryRepository: LibraryRepository = {
  async load() {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (raw === null) return null;
    return z.array(PlaceSchema).max(1000).parse(JSON.parse(raw));
  },
  async save(places) {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(z.array(PlaceSchema).parse(places)));
  },
};
export function migratePlanVideos(plans: Plan[]): SavedPlace[] {
  const found = new Map<string, SavedPlace>();
  for (const plan of plans)
    for (const v of plan.videos) {
      if (found.has(v.id)) continue;
      found.set(v.id, {
        id: v.id,
        sourceUrl: v.sourceUrl,
        sourceKind: 'link',
        context: '',
        duplicateKey: v.sample ? `sample:${v.id}` : v.sourceUrl,
        state: v.sample ? 'ready' : 'needs_review',
        stage: v.sample
          ? 'Sample place · not verified'
          : 'Add a description or transcript to identify this place',
        extraction: v.sample
          ? {
              name: v.title,
              city: plan.preferences.city.split(',')[0],
              neighborhood: v.neighborhood,
              category: v.category === 'Food & drink' ? 'Food & drink' : 'Outdoors',
              description: 'Illustrative content from an existing sample plan.',
              durationMinutes: v.duration,
              cost: {
                amount: v.cost,
                currency: 'USD',
                evidence: 'Sample estimate, not a real price.',
              },
              confidence: 0,
              evidence: [],
              missingInfo: [],
            }
          : null,
        googlePlaceId: null,
        verification: 'unverified',
        error: null,
        image: v.image,
        sample: v.sample,
        createdAt: plan.createdAt,
      });
    }
  return [...found.values()];
}
export function placeToVideo(p: SavedPlace): Video {
  return {
    id: p.id,
    placeId: p.id,
    title: p.extraction?.name || 'A place to identify',
    creator:
      p.sourceKind === 'video'
        ? 'Your uploaded video'
        : p.sourceKind === 'description'
          ? 'Your description'
          : 'Your saved TikTok',
    category: ['Coffee', 'Food & drink'].includes(p.extraction?.category || '')
      ? 'Food & drink'
      : 'Things to do',
    image: p.image,
    sourceUrl: p.sourceUrl,
    neighborhood: p.extraction?.neighborhood || p.extraction?.city || 'Location unconfirmed',
    duration: p.extraction?.durationMinutes ?? 60,
    cost: p.extraction?.cost?.amount ?? 0,
    sample: p.sample,
  };
}
