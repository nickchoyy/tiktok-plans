'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { usePlans } from './plan-provider';
import { localLibraryRepository, migratePlanVideos, placeToVideo } from '@/lib/library-storage';
import {
  categoryImage,
  contentKey,
  normalizeTikTokUrl,
  MAX_BATCH,
  MAX_UPLOAD_BYTES,
} from '@/lib/imports';
import { apiRequest } from '@/lib/api-client';
import {
  GooglePlaceSchema,
  ProcessResultSchema,
  VerificationResultSchema,
  type Capabilities,
  type GooglePlace,
  type SavedPlace,
  type Extraction,
} from '@/lib/library-types';
interface ImportItem {
  sourceUrl?: string;
  context: string;
  file?: File;
}
interface LibraryContextValue {
  places: SavedPlace[];
  ready: boolean;
  storageError: string;
  capabilities: Capabilities | null;
  details: Record<string, GooglePlace>;
  matches: Record<string, GooglePlace[]>;
  importItems: (
    items: ImportItem[],
  ) => Promise<{ added: number; duplicates: number; updated: number; ids: string[] }>;
  updatePlace: (
    id: string,
    extraction: Extraction,
    context: string,
    confirmedHours: SavedPlace['confirmedHours'],
  ) => void;
  deletePlace: (id: string) => void;
  verifyPlace: (id: string, selectedId?: string) => Promise<void>;
  refreshCapabilities: () => Promise<void>;
  retryFailed: () => void;
  retryStorage: () => Promise<void>;
}
const LibraryContext = createContext<LibraryContextValue | null>(null);
export function LibraryProvider({ children }: { children: ReactNode }) {
  const { plans, ready: plansReady, notify, updatePlan } = usePlans();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [details, setDetails] = useState<Record<string, GooglePlace>>({});
  const [matches, setMatches] = useState<Record<string, GooglePlace[]>>({});
  const current = useRef<SavedPlace[]>([]);
  const persistAllowed = useRef(false);
  const worker = useRef(false);
  const files = useRef(new Map<string, File>());
  const hydratedDetails = useRef(new Set<string>());
  function invalidatePlans(id: string, place?: SavedPlace) {
    plans
      .filter((p) => p.mode === 'live' && (p.placeIds || p.videos.map((v) => v.id)).includes(id))
      .forEach((p) =>
        updatePlan(p.id, (old) => ({
          ...old,
          scheduleStale: true,
          status: 'Draft',
          videos: place?.extraction?.name
            ? old.videos.map((v) => (v.id === id ? placeToVideo(place) : v))
            : old.videos,
        })),
      );
  }
  async function refreshCapabilities() {
    try {
      const response = await fetch('/api/capabilities', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const value = z
        .object({
          ai: z.boolean(),
          places: z.boolean(),
          routes: z.boolean(),
          video: z.boolean(),
          maps: z.boolean().optional(),
        })
        .parse(await response.json());
      setCapabilities(value);
    } catch {
      setCapabilities(null);
    }
  }
  useEffect(() => {
    void refreshCapabilities();
    const onFocus = () => {
      void refreshCapabilities();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);
  function commit(next: SavedPlace[]) {
    current.current = next;
    setPlaces(next);
    if (persistAllowed.current)
      void localLibraryRepository
        .save(next)
        .catch(() =>
          setStorageError(
            'Changes are available this session, but My Places could not be saved. Allow browser storage or free up space, then retry.',
          ),
        );
  }
  function change(id: string, update: (p: SavedPlace) => SavedPlace) {
    commit(current.current.map((p) => (p.id === id ? update(p) : p)));
  }
  useEffect(() => {
    if (!plansReady || ready) return;
    let active = true;
    localLibraryRepository
      .load()
      .then((saved) => {
        if (!active) return;
        const initial = (saved ?? migratePlanVideos(plans)).map((p) =>
          p.state === 'processing' || (p.state === 'queued' && p.sourceKind === 'video')
            ? {
                ...p,
                state: p.sourceKind === 'video' ? ('needs_review' as const) : ('queued' as const),
                stage:
                  p.sourceKind === 'video'
                    ? 'Upload not retained. Re-import the video or add a transcript.'
                    : 'Queued after interruption',
              }
            : p,
        );
        current.current = initial;
        setPlaces(initial);
        persistAllowed.current = true;
        setReady(true);
        return localLibraryRepository.save(initial).catch(() => {
          if (active)
            setStorageError(
              'My Places is available this session, but browser storage could not be updated.',
            );
        });
      })
      .catch(() => {
        if (active) {
          setStorageError(
            'Saved places could not be read. Existing storage is preserved; you may collect new places for this session and retry later.',
          );
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [plansReady, plans, ready]);
  useEffect(() => {
    if (!ready || worker.current) return;
    const next = places.find((p) => p.state === 'queued');
    if (!next) return;
    worker.current = true;
    change(next.id, (p) => ({
      ...p,
      state: 'processing',
      stage:
        p.task === 'verify'
          ? 'Checking the real location…'
          : 'AI is reading your content and checking its location…',
      error: null,
    }));
    void (async () => {
      try {
        if (next.task === 'verify' && next.extraction) {
          const result = VerificationResultSchema.parse(
            await apiRequest('/api/verify', {
              extraction: next.extraction,
              selectedId:
                next.verification === 'confirmed' && next.googlePlaceId
                  ? next.googlePlaceId
                  : undefined,
            }),
          );
          setMatches((m) => ({ ...m, [next.id]: result.matches }));
          if (result.googlePlaceId && result.matches[0])
            setDetails((d) => ({ ...d, [next.id]: result.matches[0] }));
          change(next.id, (p) => ({
            ...p,
            ...{ verification: result.verification, googlePlaceId: result.googlePlaceId },
            state: result.googlePlaceId ? 'ready' : 'needs_review',
            stage: result.message,
            error: null,
          }));
        } else {
          let body: unknown = { sourceUrl: next.sourceUrl, context: next.context };
          if (next.sourceKind === 'video' && (!next.context || files.current.has(next.id))) {
            const file = files.current.get(next.id);
            if (!file) {
              change(next.id, (p) => ({
                ...p,
                state: 'needs_review',
                stage: 'Video files stay in memory only. Re-import this video or add a transcript.',
              }));
              return;
            }
            const form = new FormData();
            form.set('video', file);
            form.set('context', next.context);
            form.set('permission', 'true');
            body = form;
          }
          const result = ProcessResultSchema.parse(await apiRequest('/api/process', body));
          setMatches((m) => ({ ...m, [next.id]: result.matches }));
          if (result.googlePlaceId && result.matches[0])
            setDetails((d) => ({ ...d, [next.id]: result.matches[0] }));
          change(next.id, (p) => ({
            ...p,
            extraction: result.extraction,
            googlePlaceId: result.googlePlaceId,
            verification: result.verification,
            state: result.state,
            stage: result.message,
            error: null,
            image: result.extraction ? categoryImage(result.extraction.category) : p.image,
          }));
        }
      } catch (e) {
        change(next.id, (p) => ({
          ...p,
          state: 'failed',
          stage: 'Processing paused',
          error: e instanceof Error ? e.message : 'Processing failed. Try again later.',
        }));
      } finally {
        files.current.delete(next.id);
        worker.current = false;
        setPlaces([...current.current]);
      }
    })();
    // The worker deliberately owns transitions; changing the queue starts the next item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, ready]);
  useEffect(() => {
    if (!capabilities?.places || !ready) return;
    const pending = places
      .filter((p) => p.googlePlaceId && !details[p.id] && !hydratedDetails.current.has(p.id))
      .slice(0, 6);
    if (!pending.length) return;
    pending.forEach((p) => hydratedDetails.current.add(p.id));
    void apiRequest('/api/details', { ids: pending.map((p) => p.googlePlaceId) })
      .then((raw) => {
        const fetched = z.object({ places: z.array(GooglePlaceSchema) }).parse(raw).places;
        setDetails((d) => ({
          ...d,
          ...Object.fromEntries(
            pending.flatMap((p) => {
              const match = fetched.find((g) => g.id === p.googlePlaceId);
              return match ? [[p.id, match]] : [];
            }),
          ),
        }));
      })
      .catch(() => {
        /* Keep the saved ID; verification can be retried explicitly. */
      });
  }, [places, capabilities, ready, details]);
  async function importItems(items: ImportItem[]) {
    if (!items.length || items.length > MAX_BATCH)
      throw new Error(`Import between 1 and ${MAX_BATCH} items at a time.`);
    if (current.current.length + items.length > 1000)
      throw new Error(
        'Your local library is full (1,000 places). Remove some places before importing.',
      );
    const next: SavedPlace[] = [];
    const refreshed = new Map<string, SavedPlace>();
    const ids: string[] = [];
    const seen = new Set(current.current.map((p) => p.duplicateKey));
    let duplicates = 0;
    for (const item of items) {
      if (item.context.length > 12000)
        throw new Error('Keep each description or transcript within 12,000 characters.');
      const sourceUrl = item.sourceUrl ? normalizeTikTokUrl(item.sourceUrl) : '';
      if (
        item.file &&
        (item.file.size > MAX_UPLOAD_BYTES ||
          !['video/mp4', 'video/quicktime', 'video/webm'].includes(item.file.type))
      )
        throw new Error('Choose MP4, MOV, or WebM videos of 12 MB or less.');
      if (!sourceUrl && !item.context.trim() && !item.file) continue;
      const duplicateKey =
        sourceUrl ||
        (item.file
          ? 'video:' +
            (await contentKey(
              [
                ...new Uint8Array(
                  await crypto.subtle.digest('SHA-256', await item.file.arrayBuffer()),
                ),
              ].join(','),
            ))
          : 'text:' + (await contentKey(item.context)));
      if (seen.has(duplicateKey)) {
        duplicates++;
        const existing =
          current.current.find((p) => p.duplicateKey === duplicateKey) ||
          next.find((p) => p.duplicateKey === duplicateKey);
        if (existing) {
          ids.push(existing.id);
          if (
            (item.file || (item.context.trim() && !existing.context)) &&
            ['failed', 'needs_review'].includes(existing.state)
          ) {
            if (item.file) files.current.set(existing.id, item.file);
            refreshed.set(existing.id, {
              ...existing,
              context: item.context.trim() || existing.context,
              state: 'queued',
              task: 'extract',
              error: null,
              stage: 'New context received; queued automatically',
            });
          }
        }
        continue;
      }
      seen.add(duplicateKey);
      const id = crypto.randomUUID();
      ids.push(id);
      if (item.file) files.current.set(id, item.file);
      next.push({
        id,
        sourceUrl,
        sourceKind: item.file ? 'video' : sourceUrl ? 'link' : 'description',
        context: item.context.trim(),
        fileName: item.file?.name.slice(0, 200),
        duplicateKey,
        state: 'queued',
        stage: 'Waiting for automatic processing',
        extraction: null,
        googlePlaceId: null,
        verification: 'unverified',
        error: null,
        image: '/images/cafe.png',
        sample: false,
        createdAt: new Date().toISOString(),
        task: 'extract',
      });
    }
    commit([...next, ...current.current].map((p) => refreshed.get(p.id) || p));
    notify(
      `${next.length} new imports${refreshed.size ? ` · ${refreshed.size} existing imports requeued` : ''}${duplicates > refreshed.size ? ` · ${duplicates - refreshed.size} duplicates skipped` : ''}.`,
    );
    return { added: next.length, duplicates, updated: refreshed.size, ids };
  }
  function updatePlace(
    id: string,
    extraction: Extraction,
    context: string,
    confirmedHours: SavedPlace['confirmedHours'],
  ) {
    setDetails((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
    setMatches((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
    change(id, (p) => {
      const newContext = context !== p.context;
      return {
        ...p,
        context,
        extraction: newContext ? null : extraction,
        googlePlaceId: p.sample
          ? null
          : newContext ||
              p.extraction?.name !== extraction.name ||
              p.extraction?.city !== extraction.city
            ? null
            : p.googlePlaceId,
        state: p.sample ? 'ready' : 'queued',
        task: newContext ? 'extract' : 'verify',
        error: null,
        confirmedHours,
        stage: p.sample
          ? 'Edited sample · not a verified location'
          : 'Queued after your corrections',
        image: categoryImage(extraction.category),
      };
    });
    invalidatePlans(
      id,
      current.current.find((p) => p.id === id),
    );
  }
  async function verifyPlace(id: string, selectedId?: string) {
    const place = current.current.find((p) => p.id === id);
    if (!place?.extraction) throw new Error('Add the place name and city first.');
    const result = VerificationResultSchema.parse(
      await apiRequest('/api/verify', { extraction: place.extraction, selectedId }),
    );
    setMatches((m) => ({ ...m, [id]: result.matches }));
    if (result.matches[0] && result.googlePlaceId)
      setDetails((d) => ({ ...d, [id]: result.matches[0] }));
    change(id, (p) => ({
      ...p,
      googlePlaceId: result.googlePlaceId,
      verification: result.verification,
      state: result.googlePlaceId ? 'ready' : 'needs_review',
      stage: result.message,
      error: null,
    }));
    if (result.googlePlaceId !== place.googlePlaceId) invalidatePlans(id);
  }
  function deletePlace(id: string) {
    invalidatePlans(id);
    files.current.delete(id);
    commit(current.current.filter((p) => p.id !== id));
    setDetails((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
    setMatches((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
    notify('Removed from My Places. Existing plans keep their saved stop snapshots.');
  }
  function retryFailed() {
    commit(
      current.current.map((p) =>
        p.state === 'failed' || p.verification === 'unavailable'
          ? {
              ...p,
              state:
                p.sourceKind === 'video' && !p.context
                  ? ('needs_review' as const)
                  : ('queued' as const),
              task: p.extraction ? ('verify' as const) : ('extract' as const),
              error: null,
              stage:
                p.sourceKind === 'video' && !p.context
                  ? 'Re-import the video or add a transcript; files are not retained.'
                  : 'Queued for retry',
            }
          : p,
      ),
    );
  }
  async function retryStorage() {
    try {
      const stored = persistAllowed.current ? [] : ((await localLibraryRepository.load()) ?? []);
      const merged = [
        ...current.current,
        ...stored.filter((p) => !current.current.some((n) => n.id === p.id)),
      ];
      await localLibraryRepository.save(merged);
      persistAllowed.current = true;
      current.current = merged;
      setPlaces(merged);
      setStorageError('');
    } catch {
      setStorageError(
        'Browser storage is still unavailable or unreadable. Your existing data has not been overwritten.',
      );
    }
  }
  return (
    <LibraryContext.Provider
      value={{
        places,
        ready,
        storageError,
        capabilities,
        details,
        matches,
        importItems,
        updatePlace,
        deletePlace,
        verifyPlace,
        refreshCapabilities,
        retryFailed,
        retryStorage,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}
export function useLibrary() {
  const value = useContext(LibraryContext);
  if (!value) throw new Error('LibraryProvider is missing');
  return value;
}
