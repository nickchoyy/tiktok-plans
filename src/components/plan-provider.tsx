'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Plan } from '@/lib/types';
import { localPlanRepository } from '@/lib/services';
import { defaultPreferences, you } from '@/lib/sample-data';
import { uid } from '@/lib/utils';
interface PlanContextValue {
  plans: Plan[];
  ready: boolean;
  error: string;
  notice: string;
  createPlan: (name: string, initial?: Partial<Plan>) => string;
  updatePlan: (id: string, update: (p: Plan) => Plan) => void;
  notify: (message: string) => void;
  retrySave: () => void;
  dismissError: () => void;
}
const PlanContext = createContext<PlanContextValue | null>(null);
export function PlanProvider({ children }: { children: ReactNode }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const loaded = useRef(false);
  const current = useRef<Plan[]>([]);
  useEffect(() => {
    let active = true;
    localPlanRepository
      .load()
      .then((data) => {
        if (active) {
          current.current = data;
          setPlans(data);
          loaded.current = true;
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setError(
            'We couldn’t load saved plans. Browser storage may be blocked or damaged. You can still create a plan for this session; existing storage is preserved.',
          );
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  function save(next: Plan[]) {
    current.current = next;
    setPlans(next);
    if (loaded.current)
      localPlanRepository
        .save(next)
        .catch(() =>
          setError(
            'Your changes are available this session, but could not be saved. Free up browser storage or allow site storage, then retry.',
          ),
        );
  }
  function createPlan(name: string, initial: Partial<Plan> = {}) {
    const id = uid();
    save([
      {
        id,
        name: name.trim(),
        description: 'Something good is in the making.',
        image: '/images/cafe.png',
        status: 'Draft',
        mode: 'sample',
        preferences: { ...defaultPreferences },
        videos: [],
        stops: [],
        members: [you],
        createdAt: new Date().toISOString(),
        ...initial,
      },
      ...current.current,
    ]);
    return id;
  }
  function updatePlan(id: string, update: (p: Plan) => Plan) {
    save(current.current.map((p) => (p.id === id ? update(p) : p)));
  }
  async function retrySave() {
    try {
      let next = current.current;
      // A failed read must never turn a retry into an overwrite of unreadable data.
      if (!loaded.current) {
        const stored = await localPlanRepository.load();
        next = [...next, ...stored.filter((p) => !next.some((session) => session.id === p.id))];
      }
      await localPlanRepository.save(next);
      current.current = next;
      setPlans(next);
      loaded.current = true;
      setError('');
      setNotice('Your plans are saved on this device.');
    } catch {
      setError(
        'Browser storage is still unavailable or unreadable. Your session changes are retained.',
      );
    }
  }
  return (
    <PlanContext.Provider
      value={{
        plans,
        ready,
        error,
        notice,
        createPlan,
        updatePlan,
        notify: setNotice,
        retrySave,
        dismissError: () => setError(''),
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}
export function usePlans() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('PlanProvider is missing');
  return ctx;
}
