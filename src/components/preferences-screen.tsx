'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Bike,
  CalendarDays,
  Check,
  Clock3,
  Footprints,
  MapPin,
  Sparkles,
  TrainFront,
} from 'lucide-react';
import type { Plan, Preferences } from '@/lib/types';
import { Button } from './ui/button';
import { usePlans } from './plan-provider';
import { regenerateExistingPlan } from '@/lib/plan-generation';
import { useLibrary } from './library-provider';
import { ClientError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
export function PreferencesScreen({ plan }: { plan: Plan }) {
  const { updatePlan, notify } = usePlans();
  const { places } = useLibrary();
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function change<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    updatePlan(plan.id, (p) => ({
      ...p,
      preferences: { ...p.preferences, [key]: value },
      ...(p.mode === 'live' ? { scheduleStale: true, status: 'Draft' as const } : {}),
    }));
  }
  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setAlternatives([]);
    if (!plan.videos.length) {
      setError('Add at least one video before creating an itinerary.');
      return;
    }
    setBusy(true);
    try {
      const result = await regenerateExistingPlan(plan, places);
      updatePlan(plan.id, (p) => ({ ...p, ...result }));
      notify(
        plan.mode === 'live'
          ? 'Your itinerary has been checked against the selected constraints.'
          : 'Your sample itinerary is ready to make your own.',
      );
      router.push(`/plans/${plan.id}/itinerary`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'The itinerary couldn’t be created. Your preferences are saved. Try again.',
      );
      if (e instanceof ClientError) setAlternatives(e.alternatives);
      setBusy(false);
    }
  }
  return (
    <section className="screen-section">
      <div className="screen-title">
        <span className="section-kicker">02 / YOUR KIND OF DAY</span>
        <h2>A little more you.</h2>
        <p>A few details to give your plan the right rhythm.</p>
      </div>
      <form onSubmit={generate}>
        <fieldset disabled={busy}>
          <div className="preferences-layout">
            <div className="preferences-card">
              <h3>
                <MapPin size={19} />
                The where & when
              </h3>
              <div className="form-grid">
                <div className="col-span-full">
                  <label htmlFor="city" className="field-label">
                    City or neighborhood
                  </label>
                  <input
                    id="city"
                    required
                    maxLength={100}
                    className="field"
                    value={plan.preferences.city}
                    onChange={(e) => change('city', e.target.value)}
                    placeholder="e.g. San Francisco, CA"
                  />
                </div>
                <div>
                  <label htmlFor="date" className="field-label">
                    <CalendarDays size={14} /> Date
                  </label>
                  <input
                    id="date"
                    type="date"
                    required
                    className="field"
                    value={plan.preferences.date}
                    onChange={(e) => change('date', e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="time" className="field-label">
                    <Clock3 size={14} /> Start time
                  </label>
                  <input
                    id="time"
                    type="time"
                    required
                    className="field"
                    value={plan.preferences.time}
                    onChange={(e) => change('time', e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="end-time" className="field-label">
                    Available until
                  </label>
                  <input
                    id="end-time"
                    type="time"
                    required
                    className="field"
                    value={plan.preferences.endTime || '17:00'}
                    onChange={(e) => change('endTime', e.target.value)}
                  />
                </div>
                <div className="col-span-full">
                  <label htmlFor="starting-location" className="field-label">
                    Starting location (optional)
                  </label>
                  <input
                    id="starting-location"
                    className="field"
                    maxLength={200}
                    value={plan.preferences.startingLocation || ''}
                    onChange={(e) => change('startingLocation', e.target.value)}
                    placeholder="Business name and full address"
                  />
                  <p className="field-help">
                    Blank starts at the first stop; travel to that stop is not included. Other
                    origins must match a real location.
                  </p>
                </div>
                <div className="col-span-full">
                  <label htmlFor="budget" className="field-label">
                    <Banknote size={14} /> Budget per person
                  </label>
                  <div className="budget-input">
                    <span>$</span>
                    <input
                      id="budget"
                      type="number"
                      min="0"
                      max="10000"
                      required
                      className="field"
                      value={plan.preferences.budget}
                      onChange={(e) => change('budget', e.target.value)}
                    />
                    <span>USD / person</span>
                  </div>
                  <p className="field-help">A target for the day, not a booking or payment.</p>
                </div>
              </div>
              <fieldset>
                <legend className="field-label">How are you getting around?</legend>
                <div className="choice-grid">
                  {(
                    [
                      { name: 'Walking', icon: Footprints },
                      { name: 'Public transit', icon: TrainFront },
                      { name: 'Driving', icon: Bike },
                    ] as const
                  ).map((item) => (
                    <label
                      key={item.name}
                      className={cn(
                        'choice-card',
                        plan.preferences.transport === item.name && 'selected',
                      )}
                    >
                      <input
                        type="radio"
                        name="transport"
                        value={item.name}
                        checked={plan.preferences.transport === item.name}
                        onChange={() => change('transport', item.name)}
                        className="sr-only"
                      />
                      <item.icon size={23} />
                      <span>{item.name}</span>
                      {plan.preferences.transport === item.name && (
                        <Check className="choice-check" size={13} />
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="mt-7">
                <legend className="field-label">Pick your pace</legend>
                <div className="pace-options">
                  {[
                    {
                      name: 'Easygoing',
                      symbol: '☁',
                      description: '2–3 stops. Room for the unexpected.',
                    },
                    {
                      name: 'A little of everything',
                      symbol: '✳︎',
                      description: 'Up to 4 stops. A happy little balance.',
                    },
                    {
                      name: 'Pack it in',
                      symbol: '↗',
                      description: 'Up to 6 stops. Make a day of it.',
                    },
                  ].map((item) => (
                    <label
                      key={item.name}
                      className={cn(
                        'pace-option',
                        plan.preferences.pace === item.name && 'selected',
                      )}
                    >
                      <input
                        type="radio"
                        name="pace"
                        checked={plan.preferences.pace === item.name}
                        onChange={() => change('pace', item.name as Preferences['pace'])}
                      />
                      <span className="pace-symbol">{item.symbol}</span>
                      <span>
                        <b>{item.name}</b>
                        <small>{item.description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <aside className="preferences-aside">
              <div className="preview-note">
                <span className="note-spark">✳︎</span>
                <h3>A plan with a little breathing room.</h3>
                <p>
                  Good days have a rhythm. Leave space for an extra coffee, a detour, or staying
                  just a little longer.
                </p>
                <div className="preview-summary">
                  <span>{plan.videos.length} saved videos</span>
                  <span>{plan.preferences.city || 'Your city'}</span>
                  <span>{plan.preferences.pace}</span>
                </div>
              </div>
              <div className="info-note">
                <Sparkles size={18} />
                <p>
                  {plan.mode === 'live'
                    ? 'AI ranks your saved activities. The scheduler checks opening windows, visit durations, budget, routes, and must-visit stops. Missing facts lead to a review step.'
                    : 'This is an illustrative sample planner. It does not verify venues, budgets, opening hours or routes.'}
                </p>
              </div>
            </aside>
          </div>
        </fieldset>
        {plan.mode === 'live' && (
          <div className="planning-consents">
            <label className="consent-check">
              <input
                type="checkbox"
                checked={plan.preferences.allowRegularHours || false}
                onChange={(e) => change('allowRegularHours', e.target.checked)}
              />
              <span>
                Allow published regular opening hours as provisional estimates when date-specific
                hours are unavailable.
              </span>
            </label>
            <label className="consent-check">
              <input
                type="checkbox"
                checked={plan.preferences.allowUnknownCosts || false}
                onChange={(e) => change('allowUnknownCosts', e.target.checked)}
              />
              <span>Allow unknown costs. The total budget will remain unconfirmed.</span>
            </label>
          </div>
        )}
        {alternatives.length > 0 && (
          <ul className="constraint-alternatives">
            {alternatives.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="step-footer">
          <Button variant="ghost" asChild>
            <Link href={`/plans/${plan.id}/videos`}>
              <ArrowLeft size={16} />
              Back to inspiration
            </Link>
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? (
              <>
                <span className="button-spinner" />
                Putting the day together…
              </>
            ) : (
              <>
                <Sparkles size={16} />
                {plan.mode === 'live' ? 'Generate my itinerary' : 'Build my sample itinerary'}{' '}
                <ArrowRight size={16} />
              </>
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}
