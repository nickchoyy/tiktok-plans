'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Clock3,
  ExternalLink,
  Footprints,
  GripVertical,
  LockKeyhole,
  MapPin,
  RefreshCw,
  Sparkles,
  Trash2,
  UnlockKeyhole,
  Users,
} from 'lucide-react';
import type { Plan, Stop, Video } from '@/lib/types';
import { usePlans } from './plan-provider';
import { Button } from './ui/button';
import { EmptyState, Photo } from './shell';
import { cn, formatDate } from '@/lib/utils';
import { regenerateExistingPlan } from '@/lib/plan-generation';
import { useLibrary } from './library-provider';
import { LivePlanMap } from './live-plan-map';
import { ClientError } from '@/lib/api-client';
import { clock } from '@/lib/planning';
function stopTime(plan: Plan, index: number) {
  if (plan.mode === 'live') {
    if (plan.scheduleStale || !plan.schedule) return 'Recheck times';
    const visit = plan.schedule.visits.find((v) => v.placeId === plan.stops[index]?.videoId);
    return visit ? clock(visit.arrival) : 'Not scheduled';
  }
  const [hours, minutes] = plan.preferences.time.split(':').map(Number);
  let total = hours * 60 + minutes;
  plan.stops.slice(0, index).forEach((s) => {
    total += (plan.videos.find((v) => v.id === s.videoId)?.duration || 60) + 15;
  });
  return new Date(2026, 0, 1, 0, total).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
function SortableStop({
  stop,
  video,
  index,
  plan,
  onLock,
  onRemove,
  onMove,
}: {
  stop: Stop;
  video: Video;
  index: number;
  plan: Plan;
  onLock: () => void;
  onRemove: () => void;
  onMove: (direction: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.id,
    disabled: stop.locked,
  });
  const beforeLocked = index > 0 && plan.stops[index - 1].locked;
  const afterLocked = index < plan.stops.length - 1 && plan.stops[index + 1].locked;
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('stop-card', isDragging && 'dragging', stop.locked && 'locked')}
    >
      <div className="stop-time">
        <span>{stopTime(plan, index)}</span>
        <span className="timeline-node">{index + 1}</span>
      </div>
      <div className="stop-inner">
        <div className="stop-image">
          <Photo
            src={video.image}
            alt={
              video.sample ? 'Illustrative sample for ' + video.title : 'Saved video placeholder'
            }
          />
        </div>
        <div className="stop-content">
          <span className="category-label">
            {video.category}{' '}
            {stop.locked && (
              <span className="locked-label">
                <LockKeyhole size={10} />
                Locked
              </span>
            )}
          </span>
          <h3>{video.title}</h3>
          <p>
            <MapPin size={12} />
            {video.neighborhood}
          </p>
          <div className="stop-meta">
            <span>
              <Clock3 size={12} />
              {video.duration} min
            </span>
            <span>
              {video.sample
                ? video.cost
                  ? `~$${video.cost} / person`
                  : 'Free · sample estimate'
                : 'Cost unverified'}
            </span>
            {video.sourceUrl && (
              <a href={video.sourceUrl} target="_blank" rel="noopener noreferrer">
                {video.sample ? 'Sample source' : 'Video source'}
                <ExternalLink size={11} />
              </a>
            )}
          </div>
        </div>
        <div className="stop-actions">
          <button
            {...attributes}
            {...listeners}
            disabled={stop.locked}
            className="drag-handle"
            aria-label={`Reorder ${video.title}`}
          >
            <GripVertical size={20} />
          </button>
          <div className="stop-action-buttons">
            <button
              className="icon-button"
              aria-label={`${stop.locked ? 'Unlock' : 'Lock'} ${video.title}`}
              aria-pressed={stop.locked}
              onClick={onLock}
            >
              {stop.locked ? <LockKeyhole size={16} /> : <UnlockKeyhole size={16} />}
            </button>
            <button
              className="icon-button remove-stop"
              aria-label={`Remove stop ${video.title}`}
              disabled={stop.locked}
              onClick={onRemove}
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="move-buttons">
            <button
              aria-label={`Move ${video.title} up`}
              disabled={stop.locked || index === 0 || beforeLocked}
              onClick={() => onMove(-1)}
            >
              <ArrowUp size={13} />
            </button>
            <button
              aria-label={`Move ${video.title} down`}
              disabled={stop.locked || index === plan.stops.length - 1 || afterLocked}
              onClick={() => onMove(1)}
            >
              <ArrowDown size={13} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
export function ItineraryScreen({ plan }: { plan: Plan }) {
  const { updatePlan, notify } = usePlans();
  const { places } = useLibrary();
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function reorder(oldIndex: number, newIndex: number) {
    if (oldIndex < 0 || newIndex < 0 || newIndex >= plan.stops.length || oldIndex === newIndex)
      return;
    const low = Math.min(oldIndex, newIndex),
      high = Math.max(oldIndex, newIndex);
    if (plan.stops.slice(low, high + 1).some((s) => s.locked)) {
      notify('Unlock the stops in between before moving across them.');
      return;
    }
    updatePlan(plan.id, (p) => ({
      ...p,
      stops: arrayMove(p.stops, oldIndex, newIndex),
      ...(p.mode === 'live' ? { scheduleStale: true, status: 'Draft' as const } : {}),
    }));
    notify('A new order for your day.');
  }
  function onDragEnd(e: DragEndEvent) {
    if (e.over)
      reorder(
        plan.stops.findIndex((s) => s.id === e.active.id),
        plan.stops.findIndex((s) => s.id === e.over?.id),
      );
  }
  async function regenerate(fixed = false) {
    setBusy(true);
    setError('');
    try {
      setAlternatives([]);
      const result = await regenerateExistingPlan(
        plan,
        places,
        fixed ? plan.stops.map((s) => s.videoId) : undefined,
      );
      updatePlan(plan.id, (p) => ({ ...p, ...result }));
      notify(
        plan.mode === 'live'
          ? 'Planning checks completed. Review any assumptions below.'
          : 'Sample plan refreshed. Locked stops kept their place.',
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Couldn’t refresh the itinerary. Please try again.',
      );
      if (e instanceof ClientError) setAlternatives(e.alternatives);
    } finally {
      setBusy(false);
    }
  }
  const total = plan.stops.reduce(
    (n, s) => n + (plan.videos.find((v) => v.id === s.videoId)?.cost || 0),
    0,
  );
  return (
    <section className="screen-section">
      <div className="screen-title-row">
        <div className="screen-title">
          <span className="section-kicker">03 / FROM SAVED TO SCHEDULED</span>
          <h2>Well, this is a good-looking day.</h2>
          <p>Move things around. Keep your favorites. Make it feel like you.</p>
        </div>
        {plan.stops.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => regenerate()} disabled={busy}>
            <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
            {busy
              ? 'Refreshing…'
              : plan.mode === 'live'
                ? 'Regenerate plan'
                : 'Refresh sample plan'}
          </Button>
        )}
      </div>
      <div className="itinerary-chips">
        <span>
          <CalendarDays size={14} />
          {formatDate(plan.preferences.date)}
        </span>
        <span>
          <MapPin size={14} />
          {plan.preferences.city}
        </span>
        <span>
          <Footprints size={14} />
          {plan.preferences.transport}
        </span>
        <span>
          {plan.mode === 'live'
            ? plan.schedule?.totalCost == null
              ? 'Budget unconfirmed'
              : `~$${plan.schedule.totalCost} / person`
            : `~$${total} / person`}
          <small>{plan.mode === 'live' ? 'source/user estimates' : 'sample estimate'}</small>
        </span>
      </div>
      <div className="info-note itinerary-notice">
        <Sparkles size={17} />
        <p>
          {plan.mode === 'live'
            ? plan.scheduleStale || !plan.schedule
              ? 'This plan has changed or its live data was not retained. Recheck its order before relying on the times. Google-derived hours and routing data are kept in memory only.'
              : plan.schedule.quality === 'checked'
                ? 'This schedule passed the available hours, duration, budget and route checks. AI supplied the priorities; deterministic checks supplied the schedule. Confirm live availability and any bookings before going.'
                : 'A provisional itinerary. Review the assumptions below; unavailable facts have not been presented as verified.'
            : 'An illustrative sample itinerary, not a verified route. Photos, durations, prices and travel times are samples. Check all details before heading out.'}
        </p>
      </div>
      {plan.mode === 'live' && plan.scheduleStale && (
        <Button
          variant="secondary"
          className="mb-5"
          onClick={() => regenerate(true)}
          disabled={busy}
        >
          Check edited order
        </Button>
      )}
      {plan.mode === 'live' && plan.planningExplanation && (
        <p className="planning-explanation">
          <Sparkles size={15} />
          {plan.planningExplanation}
        </p>
      )}
      {plan.mode === 'live' && plan.schedule && !plan.scheduleStale && (
        <div className="schedule-assumptions">
          {plan.schedule.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          {plan.schedule.omitted.length > 0 && (
            <details>
              <summary>
                {plan.schedule.omitted.length} saved{' '}
                {plan.schedule.omitted.length === 1 ? 'activity' : 'activities'} didn’t fit
              </summary>
              <ul>
                {plan.schedule.omitted.map((o) => (
                  <li key={o.placeId}>
                    <b>{plan.videos.find((v) => v.id === o.placeId)?.title}</b> — {o.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
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
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {!plan.stops.length ? (
        <EmptyState
          title="A good day starts with a first stop."
          description="Add a few videos, then build a sample itinerary from your preferences."
        >
          <Button asChild>
            <Link href={`/plans/${plan.id}/preferences`}>
              Build your itinerary
              <ArrowRight size={16} />
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="itinerary-layout">
          <div className="timeline">
            <div className="timeline-heading">
              <h3>
                Your day, stop by stop <span className="count-pill">{plan.stops.length}</span>
              </h3>
              <span>Drag or use the arrows to reorder</span>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext
                items={plan.stops.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {plan.stops.map((stop, index) => {
                  const video = plan.videos.find((v) => v.id === stop.videoId);
                  if (!video) return null;
                  return (
                    <div key={stop.id}>
                      <SortableStop
                        stop={stop}
                        video={video}
                        index={index}
                        plan={plan}
                        onLock={() =>
                          updatePlan(plan.id, (p) => ({
                            ...p,
                            stops: p.stops.map((s) =>
                              s.id === stop.id ? { ...s, locked: !s.locked } : s,
                            ),
                          }))
                        }
                        onRemove={() => {
                          updatePlan(plan.id, (p) => ({
                            ...p,
                            stops: p.stops.filter((s) => s.id !== stop.id),
                            ...(p.mode === 'live'
                              ? {
                                  placeIds: p.placeIds?.filter((id) => id !== stop.videoId),
                                  videos: p.videos.filter((v) => v.id !== stop.videoId),
                                  scheduleStale: true,
                                  status: 'Draft' as const,
                                }
                              : {}),
                          }));
                          notify('Stop removed. Its video is still saved.');
                        }}
                        onMove={(direction) => reorder(index, index + direction)}
                      />
                      {index < plan.stops.length - 1 && (
                        <div className="travel-note">
                          <Footprints size={12} />
                          <span>
                            {plan.mode === 'live'
                              ? plan.scheduleStale
                                ? 'Travel needs rechecking'
                                : `${plan.schedule?.visits[index + 1]?.travelMinutes ?? '?'} min ${plan.schedule?.travelSource === 'google' ? 'Google route estimate' : 'unverified travel estimate'}`
                              : '15 min buffer · sample travel time'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </SortableContext>
            </DndContext>
            <div className="day-end">
              <span>✧</span> Good plans. Great company. Room for a little serendipity.
            </div>
          </div>
          {plan.mode === 'live' ? (
            <LivePlanMap plan={plan} key={plan.stops.map((s) => s.id).join()} />
          ) : (
            <aside className="map-card">
              <div className="map-header">
                <h3>A little lay of the land</h3>
                <span>ILLUSTRATIVE MAP</span>
              </div>
              <div className="map-placeholder">
                <svg viewBox="0 0 380 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                  <rect width="380" height="400" fill="#eeeae2" />
                  <path d="M0 0H90Q70 100 100 150T20 400H0Z" fill="#c9deda" />
                  <path
                    d="M250 0L200 120 250 180 320 160 350 40Z M100 290L200 260 230 390 120 400Z"
                    fill="#dce2cb"
                  />
                  <g stroke="#fffdf7" strokeWidth="9">
                    <path d="M105 0L210 400M180 0L290 400M270 0L380 400M50 70L380 30M55 150L380 110M70 230L380 195M35 320L380 280M30 400L380 365" />
                  </g>
                  <path
                    d="M155 85Q300 80 265 210T170 320"
                    fill="none"
                    stroke="#8e6da4"
                    strokeWidth="3"
                    strokeDasharray="5 6"
                  />
                </svg>
                <span className="map-water-label">THE BAY</span>
                {plan.stops.slice(0, 5).map((s, i) => (
                  <span key={s.id} className={`map-pin pin-${i}`}>
                    <MapPin size={32} fill="#533765" stroke="#fff" />
                    <b>{i + 1}</b>
                  </span>
                ))}
                <span className="map-city-label">YOUR GOOD DAY</span>
                <div className="map-placeholder-label">Real maps & routing coming later</div>
              </div>
              <div className="map-footnote">
                <MapPin size={15} />
                <p>
                  Markers show stop order only.
                  <br />
                  No real coordinates or directions.
                </p>
              </div>
              <div className="budget-summary">
                <span>Estimated day total</span>
                <b>
                  ${total} <small>/ person</small>
                </b>
                <p>Sample costs · Your budget: ${plan.preferences.budget}</p>
                {total > Number(plan.preferences.budget) && (
                  <p className="budget-warning">This sample plan is above your target budget.</p>
                )}
              </div>
            </aside>
          )}
        </div>
      )}
      <div className="step-footer">
        <Button variant="ghost" asChild>
          <Link href={`/plans/${plan.id}/preferences`}>
            <ArrowLeft size={16} />
            Adjust preferences
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/plans/${plan.id}/collaboration`}>
            <Users size={16} />
            Bring your people <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
    </section>
  );
}
