'use client';
import Link from 'next/link';
import { ArrowRight, Check, MapPin, Plus } from 'lucide-react';
import type { Plan } from '@/lib/types';
import { useLibrary } from './library-provider';
import { usePlans } from './plan-provider';
import { placeToVideo } from '@/lib/library-storage';
import { Button } from './ui/button';
import { ImportPlacesButton } from './import-places';
import { Photo } from './shell';
export function PlanPlacePicker({ plan }: { plan: Plan }) {
  const { places } = useLibrary();
  const { updatePlan, notify } = usePlans();
  const selected = plan.placeIds || [];
  const choices = places.filter((p) => !p.sample && p.extraction?.name);
  return (
    <section className="screen-section">
      <div className="screen-title-row">
        <div className="screen-title">
          <span className="section-kicker">01 / YOUR COLLECTED PLACES</span>
          <h2>Good finds, ready for another good day.</h2>
          <p>Reuse your library. Removing a place from this plan leaves it in My Places.</p>
        </div>
        <ImportPlacesButton variant="outline" />
      </div>
      <div className="picker-grid">
        {choices.map((p) => {
          const included = selected.includes(p.id);
          return (
            <button
              key={p.id}
              aria-pressed={included}
              className={included ? 'picker-place selected' : 'picker-place'}
              onClick={() => {
                if (!included && selected.length >= 6) {
                  notify('Choose up to six places for one outing.');
                  return;
                }
                if (included && plan.stops.some((s) => s.videoId === p.id && s.locked)) {
                  notify('Unlock this must-visit stop before removing it from the plan.');
                  return;
                }
                updatePlan(plan.id, (old) => ({
                  ...old,
                  placeIds: included ? selected.filter((id) => id !== p.id) : [...selected, p.id],
                  videos: included
                    ? old.videos.filter((v) => v.id !== p.id)
                    : [...old.videos, placeToVideo(p)],
                  stops: included ? old.stops.filter((s) => s.videoId !== p.id) : old.stops,
                  scheduleStale: true,
                  status: 'Draft',
                }));
              }}
            >
              <span className="picker-photo">
                <Photo src={p.image} alt="Illustrative collection photo" />
              </span>
              <span>
                <b>{p.extraction?.name}</b>
                <small>
                  <MapPin size={11} />
                  {p.extraction?.city} ·{' '}
                  {p.googlePlaceId ? 'Location matched' : 'Needs verification'}
                </small>
              </span>
              <span className="picker-check">
                {included ? <Check size={16} /> : <Plus size={16} />}
              </span>
            </button>
          );
        })}
      </div>
      {!choices.length && (
        <div className="review-message">
          Collect and identify a place in My Places before adding it here.
        </div>
      )}
      <div className="step-footer">
        <span>{selected.length} places selected · up to 6 per outing</span>
        <Button disabled={!selected.length} asChild={!!selected.length}>
          {selected.length ? (
            <Link href={`/plans/${plan.id}/preferences`}>
              Your preferences
              <ArrowRight size={15} />
            </Link>
          ) : (
            <span>Collect a place to continue</span>
          )}
        </Button>
      </div>
    </section>
  );
}
