import { createSamples } from './sample-data';
import type { ItineraryService, Plan, PlanRepository } from './types';
const STORAGE_KEY = 'tiktok-plans:v1';
function validPlans(value: unknown): value is Plan[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (p) =>
      p &&
      typeof p.id === 'string' &&
      typeof p.name === 'string' &&
      typeof p.image === 'string' &&
      ['Draft', 'Ready to go'].includes(p.status) &&
      p.preferences &&
      ['city', 'date', 'time', 'budget', 'transport', 'pace'].every(
        (k) => typeof p.preferences[k] === 'string',
      ) &&
      Array.isArray(p.videos) &&
      p.videos.every(
        (v: Record<string, unknown>) =>
          v &&
          ['id', 'title', 'creator', 'image', 'sourceUrl', 'neighborhood'].every(
            (k) => typeof v[k] === 'string',
          ) &&
          typeof v.duration === 'number' &&
          typeof v.cost === 'number',
      ) &&
      Array.isArray(p.stops) &&
      p.stops.every(
        (s: Record<string, unknown>) =>
          s &&
          typeof s.id === 'string' &&
          typeof s.videoId === 'string' &&
          typeof s.locked === 'boolean' &&
          Array.isArray(s.votes),
      ) &&
      Array.isArray(p.members) &&
      p.members.every(
        (m: Record<string, unknown>) =>
          m && ['id', 'name', 'initials', 'color', 'role'].every((k) => typeof m[k] === 'string'),
      ),
  );
}
export const localPlanRepository: PlanRepository = {
  async load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSamples();
    const parsed: unknown = JSON.parse(raw);
    if (!validPlans(parsed))
      throw new Error('Saved plans could not be read. Your browser data has not been changed.');
    return parsed;
  },
  async save(plans) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        plans.map((p) => {
          if (p.mode !== 'live') return p;
          const { schedule, ...retained } = p;
          void schedule;
          return { ...retained, scheduleStale: true, status: 'Draft' };
        }),
      ),
    );
  },
};
// Replace this adapter with an API route. It deliberately makes no AI or scraping calls.
export const mockItineraryService: ItineraryService = {
  async generate({ videos, preferences, existingStops }) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    const limit =
      preferences.pace === 'Easygoing' ? 3 : preferences.pace === 'A little of everything' ? 4 : 6;
    const locked = existingStops.filter((s) => s.locked && videos.some((v) => v.id === s.videoId));
    // Keep locked positions even when a newly selected pace would suggest fewer stops.
    const stopLimit = Math.max(limit, ...locked.map((s) => existingStops.indexOf(s) + 1));
    const unlocked = videos
      .filter((v) => !locked.some((s) => s.videoId === v.id))
      .slice(0, Math.max(0, stopLimit - locked.length))
      .map(
        (v) =>
          existingStops.find((s) => s.videoId === v.id) ?? {
            id: crypto.randomUUID(),
            videoId: v.id,
            locked: false,
            votes: [],
          },
      );
    const result = [...unlocked];
    locked.forEach((s) => result.splice(Math.min(existingStops.indexOf(s), result.length), 0, s));
    return result;
  },
};
