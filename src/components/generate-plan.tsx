'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ChevronDown, Sparkles } from 'lucide-react';
import { useLibrary } from './library-provider';
import { usePlans } from './plan-provider';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { defaultPreferences } from '@/lib/sample-data';
import { buildSuggestions } from '@/lib/suggestions';
import { placeToVideo } from '@/lib/library-storage';
import { generateFromLibrary } from '@/lib/plan-generation';
import { ClientError } from '@/lib/api-client';
import type { Preferences } from '@/lib/types';
function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const y = date.getFullYear(),
    m = String(date.getMonth() + 1).padStart(2, '0'),
    d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
export function GeneratePlanButton({
  placeIds,
  title,
  variant = 'default',
  className,
  children,
}: {
  placeIds?: string[];
  title?: string;
  variant?: 'default' | 'lime' | 'outline' | 'secondary';
  className?: string;
  children?: React.ReactNode;
}) {
  const { places, details } = useLibrary();
  const { createPlan, notify } = usePlans();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [prefs, setPrefs] = useState<Preferences>({
    ...defaultPreferences,
    date: tomorrow(),
    endTime: '17:00',
    startingLocation: '',
    allowUnknownCosts: false,
    allowRegularHours: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const suggestions = buildSuggestions(places, details);
  const chosen = places.filter((p) => selected.includes(p.id));
  const sample = chosen.length > 0 && chosen.every((p) => p.sample);
  function initialize() {
    const initial = placeIds || suggestions[0]?.placeIds || [];
    const first = places.find((p) => p.id === initial[0]);
    setSelected(initial);
    setName(title || `${first?.extraction?.city || 'A little'} day out`);
    setPrefs({
      ...defaultPreferences,
      date: tomorrow(),
      city: first?.extraction?.city || '',
      endTime: '17:00',
      startingLocation: '',
      allowUnknownCosts: false,
      allowRegularHours: false,
    });
    setError('');
    setAlternatives([]);
  }
  function change<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setAlternatives([]);
    if (!chosen.length) {
      setError('Collect a place with a name and city first.');
      return;
    }
    setBusy(true);
    try {
      const result = await generateFromLibrary(chosen, prefs);
      const id = createPlan(name.trim() || 'A good day out', {
        ...result,
        placeIds: chosen.map((p) => p.id),
        videos: chosen.map(placeToVideo),
        preferences: prefs,
        image: chosen[0].image,
        mode: sample ? 'sample' : 'live',
        sample,
      });
      setOpen(false);
      notify(
        sample
          ? 'Your sample plan is ready.'
          : result.schedule?.quality === 'checked'
            ? 'Your schedule passed the planning checks.'
            : 'Your provisional plan is ready for review.',
      );
      router.push(`/plans/${id}/itinerary`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This plan could not be generated.');
      if (e instanceof ClientError) setAlternatives(e.alternatives);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) initialize();
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant} className={className}>
          <Sparkles size={16} />
          {children || 'Generate Plan'}
          <ArrowRight size={15} />
        </Button>
      </DialogTrigger>
      <DialogContent className="generate-dialog">
        <span className="dialog-icon">
          <Sparkles size={24} />
        </span>
        <DialogTitle className="text-2xl font-semibold tracking-tight">
          A good day, minus the back-and-forth.
        </DialogTitle>
        <DialogDescription className="mt-2 mb-6 text-sm leading-relaxed text-muted">
          {sample
            ? 'An illustrative sample plan. No AI or real-world verification will run.'
            : 'Start with your saved places. Pick when you’re free; we’ll check what can fit.'}
        </DialogDescription>
        {!places.some((p) => p.extraction?.name && p.extraction.city) ? (
          <div className="review-message">
            <p>Your library needs a place name and city before it can suggest an outing.</p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/places" onClick={() => setOpen(false)}>
                Open My Places
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit}>
            {!placeIds && (
              <>
                <label className="field-label" htmlFor="outing-selection">
                  Start with a saved collection
                </label>
                <select
                  id="outing-selection"
                  className="field mb-5"
                  value={suggestions.find((s) => s.placeIds.join() === selected.join())?.id || ''}
                  onChange={(e) => {
                    const suggestion = suggestions.find((s) => s.id === e.target.value);
                    if (suggestion) {
                      setSelected(suggestion.placeIds);
                      setName(suggestion.title);
                      change('city', suggestion.city);
                    }
                  }}
                >
                  {suggestions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} · {s.placeIds.length} {s.sample ? 'sample places' : 'places'}
                    </option>
                  ))}
                </select>
              </>
            )}
            <div className="generation-places">
              <span>
                {chosen.length} {sample ? 'sample places' : 'saved places'}
              </span>
              <p>{chosen.map((p) => p.extraction?.name || 'Unknown place').join(' · ')}</p>
            </div>
            <div className="form-grid mt-5">
              <div className="col-span-full">
                <label htmlFor="generate-date" className="field-label">
                  When are you free?
                </label>
                <input
                  id="generate-date"
                  type="date"
                  required
                  className="field"
                  value={prefs.date}
                  onChange={(e) => change('date', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="generate-start" className="field-label">
                  From
                </label>
                <input
                  id="generate-start"
                  type="time"
                  required
                  className="field"
                  value={prefs.time}
                  onChange={(e) => change('time', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="generate-end" className="field-label">
                  Until
                </label>
                <input
                  id="generate-end"
                  type="time"
                  required
                  className="field"
                  value={prefs.endTime}
                  onChange={(e) => change('endTime', e.target.value)}
                />
              </div>
            </div>
            <details className="generation-defaults">
              <summary>
                Make it your kind of day <ChevronDown size={14} />
              </summary>
              <label htmlFor="generate-name" className="field-label mt-4">
                Plan name
              </label>
              <input
                id="generate-name"
                className="field"
                maxLength={70}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <label htmlFor="generate-city" className="field-label mt-4">
                City
              </label>
              <input
                id="generate-city"
                required
                className="field"
                maxLength={120}
                value={prefs.city}
                onChange={(e) => change('city', e.target.value)}
              />
              <div className="form-grid mt-4">
                <div>
                  <label htmlFor="generate-budget" className="field-label">
                    Budget (USD / person)
                  </label>
                  <input
                    id="generate-budget"
                    type="number"
                    required
                    min="0"
                    max="10000"
                    className="field"
                    value={prefs.budget}
                    onChange={(e) => change('budget', e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="generate-transport" className="field-label">
                    Getting around
                  </label>
                  <select
                    id="generate-transport"
                    className="field"
                    value={prefs.transport}
                    onChange={(e) =>
                      change('transport', e.target.value as Preferences['transport'])
                    }
                  >
                    {['Walking', 'Public transit', 'Driving'].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <label htmlFor="generate-pace" className="field-label">
                Pace
              </label>
              <select
                id="generate-pace"
                className="field"
                value={prefs.pace}
                onChange={(e) => change('pace', e.target.value as Preferences['pace'])}
              >
                {['Easygoing', 'A little of everything', 'Pack it in'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <label htmlFor="generate-origin" className="field-label mt-4">
                Starting location <span className="optional-label">optional</span>
              </label>
              <input
                id="generate-origin"
                className="field"
                maxLength={200}
                value={prefs.startingLocation}
                onChange={(e) => change('startingLocation', e.target.value)}
                placeholder="Business name and full address"
              />
              <p className="field-help">
                Blank means you start at the first stop; travel to it is not included. A supplied
                origin must match a unique real location.
              </p>
              {!sample && (
                <>
                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={prefs.allowRegularHours}
                      onChange={(e) => change('allowRegularHours', e.target.checked)}
                    />
                    <span>
                      Allow regular opening hours as provisional estimates when date-specific hours
                      aren’t available.
                    </span>
                  </label>
                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={prefs.allowUnknownCosts}
                      onChange={(e) => change('allowUnknownCosts', e.target.checked)}
                    />
                    <span>Allow unknown costs. The plan’s total budget will be unconfirmed.</span>
                  </label>
                </>
              )}
            </details>
            <p className="field-help mt-4">
              Defaults: ${prefs.budget} per person · {prefs.transport} · {prefs.pace}. You can edit
              everything above.
            </p>
            {error && (
              <div role="alert" className="review-message error">
                <p>{error}</p>
                {alternatives.length > 0 && (
                  <ul>
                    {alternatives.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                )}
                <Link href="/places" onClick={() => setOpen(false)}>
                  Review saved places <ArrowRight size={13} />
                </Link>
              </div>
            )}
            <Button type="submit" disabled={busy || !chosen.length} className="w-full mt-6">
              {busy ? (
                <>
                  <span className="button-spinner" />
                  Finding a day that fits…
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  {sample ? 'Generate sample plan' : 'Generate my plan'}
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
