'use client';
import Link from 'next/link';
import { ArrowLeft, Check, ChevronRight, Film, Map, Settings2, Users } from 'lucide-react';
import { usePlans } from './plan-provider';
import { Avatars, EmptyState, LoadingState } from './shell';
import { Button } from './ui/button';
import { PlanPlacePicker } from './plan-place-picker';
import { VideoScreen } from './video-screen';
import { PreferencesScreen } from './preferences-screen';
import { ItineraryScreen } from './itinerary-screen';
import { CollaborationScreen } from './collaboration-screen';
import { cn } from '@/lib/utils';
const steps = [
  { key: 'videos', label: 'Your places', icon: Film },
  { key: 'preferences', label: 'Your preferences', icon: Settings2 },
  { key: 'itinerary', label: 'The itinerary', icon: Map },
  { key: 'collaboration', label: 'Your people', icon: Users },
];
export function PlanWorkspace({ id, step }: { id: string; step: string }) {
  const { plans, ready } = usePlans();
  if (!ready) return <LoadingState />;
  const plan = plans.find((p) => p.id === id);
  const index = steps.findIndex((s) => s.key === step);
  if (!plan || index < 0)
    return (
      <EmptyState
        title="That plan took a different turn."
        description="We couldn’t find this plan on this device. Head back to your space to start something good."
      >
        <Button asChild>
          <Link href="/">Back to overview</Link>
        </Button>
      </EmptyState>
    );
  return (
    <>
      <Link href="/" className="back-link">
        <ArrowLeft size={15} />
        All plans
      </Link>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">A GOOD DAY IN THE MAKING</p>
          <h1>{plan.name}</h1>
          <p>
            {plan.preferences.city} <span className="mx-1">·</span>{' '}
            <span className="text-xs">Local prototype</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Avatars members={plan.members} />
          <Button variant="outline" size="sm" asChild>
            <Link href={`/plans/${id}/collaboration`}>
              <Users size={14} />
              Your people
            </Link>
          </Button>
        </div>
      </div>
      <nav className="step-nav" aria-label="Plan steps">
        {steps.map((s, i) => (
          <Link
            key={s.key}
            href={`/plans/${id}/${s.key}`}
            aria-current={i === index ? 'step' : undefined}
            className={cn('step-link', i === index && 'active', i < index && 'complete')}
          >
            <span className="step-number">{i < index ? <Check size={14} /> : i + 1}</span>
            <span>{s.label}</span>
            <ChevronRight className="step-chevron" size={14} />
          </Link>
        ))}
      </nav>
      {step === 'videos' ? (
        plan.mode === 'live' ? (
          <PlanPlacePicker plan={plan} />
        ) : (
          <VideoScreen plan={plan} />
        )
      ) : step === 'preferences' ? (
        <PreferencesScreen plan={plan} />
      ) : step === 'itinerary' ? (
        <ItineraryScreen plan={plan} />
      ) : (
        <CollaborationScreen plan={plan} />
      )}
    </>
  );
}
