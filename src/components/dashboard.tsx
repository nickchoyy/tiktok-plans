'use client';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Coffee,
  MapPin,
  Play,
  Search,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import { LibraryHome } from './library-home';
import { ImportPlacesButton } from './import-places';
import { GeneratePlanButton } from './generate-plan';
import { useState } from 'react';
import { usePlans } from './plan-provider';
import { Avatars, CreatePlanButton, EmptyState, LoadingState, Photo } from './shell';
import { cn, formatDate } from '@/lib/utils';
export function Dashboard() {
  const { plans, ready } = usePlans();
  const [filter, setFilter] = useState('All plans');
  const [search, setSearch] = useState('');
  if (!ready) return <LoadingState />;
  const shown = plans.filter(
    (p) =>
      (filter !== 'Upcoming' || p.status === 'Ready to go') &&
      (filter !== 'Drafts' || p.status === 'Draft') &&
      `${p.name} ${p.preferences.city}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <span className="tiny-spark">✳︎</span> LESS SOMEDAY, MORE SATURDAY
          </p>
          <h1>Your next good plan starts here.</h1>
          <p>Turn the places you save into the days you’ll remember.</p>
        </div>
        <GeneratePlanButton variant="outline" />
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span className="hero-kicker-dot" /> FROM YOUR FEED TO YOUR FEET
          </span>
          <h2>
            Less scrolling.
            <br />
            More{' '}
            <span className="hero-going">
              going.
              <svg viewBox="0 0 210 16" aria-hidden="true">
                <path d="M4 12 Q96 -1 204 7 M10 15 Q110 5 190 10" />
              </svg>
            </span>
          </h2>
          <p>
            Collect the places that catch your eye.
            <br className="hidden sm:block" />
            Let AI help turn them into your next day out.
          </p>
          <ImportPlacesButton variant="lime">
            Collect something good <ArrowUpRight size={16} />
          </ImportPlacesButton>
          <div className="hero-bottom">
            <span className="tiny-avatars">
              <span>J</span>
              <span>A</span>
              <span>You</span>
            </span>
            <span>Better plans. Even better company.</span>
          </div>
        </div>
        <div className="hero-art" aria-label="A collage of sample food and travel inspiration">
          <div className="hero-doodle doodle-one">✧</div>
          <div className="hero-doodle doodle-two">✳︎</div>
          <div className="hero-photo hero-photo-back">
            <Photo src="/images/coast.jpg" alt="Sunlit coastline and blue water" priority />
            <div className="photo-caption">
              <MapPin size={12} /> a little adventure
            </div>
          </div>
          <div className="hero-photo hero-photo-front">
            <Photo src="/images/cafe.png" alt="Coffee grinder and a fresh cup of coffee" priority />
            <div className="photo-caption">
              <Coffee size={12} /> your new favorite spot
            </div>
            <span className="photo-play" aria-hidden="true">
              <Play fill="currentColor" strokeWidth={0} size={25} />
            </span>
          </div>
          <div className="floating-label">
            <span className="check-bubble">
              <Check size={14} />
            </span>{' '}
            From “saved” to “see you there” <span>↗</span>
          </div>
          <span className="hero-arrow">↝</span>
          <span className="hero-handwritten">this could be your weekend</span>
        </div>
      </section>
      <LibraryHome />
      <section className="stats-row" aria-label="Your plan summary">
        <div>
          <span className="stat-icon lavender">
            <CalendarDays size={19} />
          </span>
          <p>
            <b>{plans.length}</b>
            <span>plans in the making</span>
          </p>
        </div>
        <div>
          <span className="stat-icon peach">
            <Video size={19} />
          </span>
          <p>
            <b>{new Set(plans.flatMap((p) => p.videos.map((v) => v.id))).size}</b>
            <span>little sparks of inspiration</span>
          </p>
        </div>
        <div>
          <span className="stat-icon green">
            <Users size={19} />
          </span>
          <p>
            <b>
              {
                new Set(
                  plans.flatMap((p) => p.members.filter((m) => m.id !== 'you').map((m) => m.id)),
                ).size
              }
            </b>
            <span>friends along for the ride</span>
          </p>
        </div>
      </section>
      <section className="plans-section">
        <div className="section-heading">
          <div>
            <h2>
              Your plans <span className="count-pill">{plans.length}</span>
            </h2>
            <p>A few good things to look forward to.</p>
          </div>
          <CreatePlanButton variant="outline">Create a plan</CreatePlanButton>
        </div>
        <div className="plans-toolbar">
          <div className="filter-tabs" role="group" aria-label="Filter plans">
            {['All plans', 'Upcoming', 'Drafts'].map((f) => (
              <button
                key={f}
                aria-label={f}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(filter === f && 'active')}
              >
                {f}
                {f === 'All plans' && <span>{plans.length}</span>}
              </button>
            ))}
          </div>
          <label className="search-box">
            <Search size={16} />
            <input
              aria-label="Search plans"
              placeholder="Find a plan…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="search-key">⌕</span>
          </label>
        </div>
        <div className="plan-grid">
          {shown.map((p) => (
            <Link
              className="plan-card group"
              href={`/plans/${p.id}/${p.stops.length ? 'itinerary' : 'videos'}`}
              key={p.id}
            >
              <div className="plan-card-image">
                <Photo src={p.image} alt={`Sample inspiration for ${p.name}`} />
                <span className={cn('status-badge', p.status === 'Draft' && 'draft')}>
                  {p.status === 'Draft' ? <Clock3 size={11} /> : <span className="badge-dot" />}
                  {p.status}
                </span>
                <span className="image-sample-label">{p.sample ? 'SAMPLE PLAN' : 'YOUR PLAN'}</span>
                <span className="card-open">
                  <ArrowUpRight size={20} />
                </span>
              </div>
              <div className="plan-card-body">
                <div className="plan-location">
                  <MapPin size={12} />
                  {p.preferences.city.split(',')[0]}
                </div>
                <h3>{p.name}</h3>
                <div className="plan-meta">
                  <span>
                    <CalendarDays size={13} />
                    {formatDate(p.preferences.date)}
                  </span>
                  <span className="meta-dot">·</span>
                  <span>
                    {p.stops.length || p.videos.length} {p.stops.length ? 'stops' : 'saved videos'}
                  </span>
                </div>
                <div className="plan-card-footer">
                  <Avatars members={p.members} small />
                  <span>
                    {p.members.length === 1
                      ? 'Just you, for now'
                      : `${p.members.length} people, one good day`}{' '}
                    <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
          {shown.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                title={search ? 'No plans found' : 'A little possibility, right here.'}
                description={
                  search
                    ? 'Try another name or city.'
                    : 'Create a plan and turn your saved inspiration into a day out.'
                }
              >
                {!search && <CreatePlanButton />}
              </EmptyState>
            </div>
          )}
        </div>
      </section>
      <section className="bottom-callout">
        <div className="callout-symbol">
          <Sparkles size={25} />
        </div>
        <div>
          <h3>Your saved folder called. It wants to go outside.</h3>
          <p>Collect inspiration once. Reuse it for every kind of day.</p>
        </div>
        <Link href="/places">
          Find some inspiration <ArrowRight size={16} />
        </Link>
      </section>
      <div className="dashboard-footnote">
        <span className="local-dot" /> A little heads-up: these are sample plans. Make one of your
        own to get started.
      </div>
    </>
  );
}
