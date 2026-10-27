'use client';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Clock3,
  ExternalLink,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Video,
} from 'lucide-react';
import { categories, type SavedPlace } from '@/lib/library-types';
import { cn } from '@/lib/utils';
import { useLibrary } from './library-provider';
import { ImportPlacesButton } from './import-places';
import { GeneratePlanButton } from './generate-plan';
import { PlaceEditor, GoogleAttribution } from './place-editor';
import { EmptyState, LoadingState, Photo } from './shell';
import { Button } from './ui/button';
const labels = {
  queued: 'Queued',
  processing: 'AI is organizing',
  ready: 'Ready to plan',
  needs_review: 'Needs your eye',
  failed: 'Processing paused',
};
export function PlaceCard({
  place,
  selected,
  onSelect,
}: {
  place: SavedPlace;
  selected: boolean;
  onSelect: () => void;
}) {
  const { details } = useLibrary();
  const live = details[place.id];
  return (
    <article className="place-card">
      <div className="place-card-photo">
        <Photo
          src={place.image}
          alt={`Illustrative ${place.extraction?.category || 'experience'} photo, not a photo of the named venue`}
        />
        <span className={cn('processing-badge', place.state)}>
          {place.state === 'processing' ? (
            <span className="mini-spinner" />
          ) : place.state === 'ready' ? (
            <Check size={11} />
          ) : (
            <Clock3 size={11} />
          )}{' '}
          {place.sample ? 'Sample place' : labels[place.state]}
        </span>
        <label className="select-place">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            aria-label={`Select ${place.extraction?.name || place.fileName || 'import'}`}
          />
          <span>
            <Check size={14} />
          </span>
        </label>
        <span className="place-photo-caption">ILLUSTRATIVE PHOTO</span>
      </div>
      <div className="place-card-copy">
        <span className="category-label">
          {place.extraction?.category || 'Waiting to discover'}
        </span>
        <h3>{place.extraction?.name || place.fileName || 'A new place to discover'}</h3>
        <p className="place-card-city">
          <MapPin size={12} />
          {place.extraction?.city || 'City needed'}
          {place.extraction?.neighborhood && ` · ${place.extraction.neighborhood}`}
        </p>
        <p className="place-description">
          {place.extraction?.description || place.context || place.stage}
        </p>
        {(place.state === 'needs_review' || place.state === 'failed') && (
          <p className="place-review-note">{place.error || place.stage}</p>
        )}
        <div className="place-facts">
          <span>
            {place.extraction?.durationMinutes
              ? `~${place.extraction.durationMinutes} min`
              : 'Duration unknown'}
          </span>
          <span>
            {place.extraction?.cost
              ? `${place.extraction.cost.currency} ${place.extraction.cost.amount} est.`
              : 'Cost unknown'}
          </span>
        </div>
        {live && (
          <div className="place-google-summary">
            <p>{live.address}</p>
            <GoogleAttribution place={live} />
          </div>
        )}
        <div className="place-card-actions">
          {place.sourceUrl ? (
            <a href={place.sourceUrl} target="_blank" rel="noopener noreferrer">
              {place.sample ? 'Sample source' : 'Original TikTok'}
              <ExternalLink size={12} />
            </a>
          ) : (
            <span>
              <Video size={12} />
              {place.sourceKind === 'video' ? 'Your video' : 'Your description'}
            </span>
          )}
          <PlaceEditor place={place} />
        </div>
      </div>
    </article>
  );
}
export function ServiceStatus() {
  const { capabilities, refreshCapabilities, retryFailed, places } = useLibrary();
  const failed = places.some((p) => p.state === 'failed' || p.verification === 'unavailable');
  return (
    <div className={cn('service-status', capabilities?.ai && capabilities.places && 'connected')}>
      <span className="status-light" />
      <p>
        {capabilities === null
          ? 'Checking AI services…'
          : capabilities.ai && capabilities.places
            ? 'AI extraction & Google Places connected'
            : !capabilities.ai
              ? 'AI is waiting for server configuration. Your imports are still saved.'
              : 'AI is connected. Google Places still needs configuration to verify locations.'}
      </p>
      <button
        onClick={async () => {
          await refreshCapabilities();
          retryFailed();
        }}
      >
        <RefreshCw size={12} />
        {failed ? 'Retry processing' : 'Refresh status'}
      </button>
    </div>
  );
}
export function PlacesLibrary() {
  const { places, ready, storageError, retryStorage } = useLibrary();
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('All cities');
  const [category, setCategory] = useState('All types');
  const [state, setState] = useState('All places');
  const [group, setGroup] = useState('City');
  const [selected, setSelected] = useState<string[]>([]);
  const shown = useMemo(
    () =>
      places.filter(
        (p) =>
          `${p.extraction?.name || ''} ${p.extraction?.description || ''} ${p.context} ${p.extraction?.city || ''}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase()) &&
          (city === 'All cities' || p.extraction?.city === city) &&
          (category === 'All types' || p.extraction?.category === category) &&
          (state === 'All places' ||
            (state === 'Your collection' && !p.sample) ||
            (state === 'Needs review' && ['needs_review', 'failed'].includes(p.state)) ||
            (state === 'Processing' && ['queued', 'processing'].includes(p.state)) ||
            (state === 'Samples' && p.sample)),
      ),
    [places, search, city, category, state],
  );
  if (!ready) return <LoadingState />;
  const cities = [
    ...new Set(places.map((p) => p.extraction?.city).filter((c): c is string => !!c)),
  ].sort();
  const grouped = shown.reduce<Record<string, SavedPlace[]>>((result, p) => {
    const key =
      group === 'City'
        ? p.extraction?.city || 'Still finding its city'
        : p.extraction?.category || 'Still finding its kind';
    (result[key] ||= []).push(p);
    return result;
  }, {});
  const processing = places.filter((p) => p.state === 'processing' || p.state === 'queued').length;
  const chosen = selected.filter((id) => places.some((p) => p.id === id));
  return (
    <>
      <div className="page-heading library-heading">
        <div>
          <p className="eyebrow">
            <Sparkles size={12} />
            YOUR SAVES, WITH A LITTLE MORE POSSIBILITY
          </p>
          <h1>
            My Places<span className="heading-dot">.</span>
          </h1>
          <p>Collect once. Discover what goes together. Make a day of it.</p>
        </div>
        <ImportPlacesButton />
      </div>
      <ServiceStatus />
      {storageError && (
        <div className="error-banner library-storage-error" role="alert">
          <span>{storageError}</span>
          <Button size="sm" variant="outline" onClick={retryStorage}>
            Retry library storage
          </Button>
        </div>
      )}
      <section className="library-intro">
        <div>
          <span className="library-intro-icon">
            <MapPin size={22} />
          </span>
          <div>
            <h2>A personal collection of “we should go.”</h2>
            <p>Links, descriptions, and permitted videos live here independently of your plans.</p>
          </div>
        </div>
        <GeneratePlanButton variant="secondary" placeIds={chosen.length ? chosen : undefined}>
          {chosen.length ? `Plan with ${chosen.length} places` : 'Generate Plan'}
        </GeneratePlanButton>
      </section>
      {processing > 0 && (
        <div className="queue-progress" role="status">
          <span className="mini-spinner" />
          <div>
            <b>
              {processing} {processing === 1 ? 'import is' : 'imports are'} being organized
            </b>
            <span>AI checks your content, then searches for a real location match.</span>
          </div>
          <span>
            {places.filter((p) => p.state === 'processing').length} processing ·{' '}
            {places.filter((p) => p.state === 'queued').length} queued
          </span>
        </div>
      )}
      <div className="library-toolbar">
        <label className="library-search">
          <Search size={17} />
          <input
            aria-label="Search My Places"
            placeholder="A place, a city, a little inspiration…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Filter city</span>
          <select
            className="field"
            aria-label="Filter city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            <option>All cities</option>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter activity type</span>
          <select
            className="field"
            aria-label="Filter activity type"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>All types</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="library-filter-row">
        <div className="filter-tabs" role="group" aria-label="Filter places">
          {['All places', 'Your collection', 'Needs review', 'Processing', 'Samples'].map((s) => (
            <button
              key={s}
              aria-pressed={state === s}
              className={state === s ? 'active' : ''}
              onClick={() => setState(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <label className="group-select">
          Group by{' '}
          <select
            aria-label="Group places by"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option>City</option>
            <option>Activity type</option>
          </select>
        </label>
      </div>
      {!shown.length ? (
        <EmptyState
          title={
            places.length ? 'Nothing here, just yet.' : 'Your next good day starts with a save.'
          }
          description={
            places.length
              ? 'Try another search or filter, or collect something new.'
              : 'Add TikTok links, descriptions, transcripts, or permitted videos. AI will organize what you provide and ask for anything missing.'
          }
        >
          <ImportPlacesButton />
        </EmptyState>
      ) : (
        Object.entries(grouped).map(([name, items]) => (
          <section className="place-group" key={name}>
            <div className="section-heading">
              <h2>
                <MapPin size={17} />
                {name}
                <span className="count-pill">{items.length}</span>
              </h2>
              <span>
                {items.filter((p) => !p.sample).length} in your collection ·{' '}
                {items.filter((p) => p.sample).length} samples
              </span>
            </div>
            <div className="place-grid">
              {items.map((p) => (
                <PlaceCard
                  key={p.id}
                  place={p}
                  selected={chosen.includes(p.id)}
                  onSelect={() =>
                    setSelected((ids) =>
                      ids.includes(p.id) ? ids.filter((id) => id !== p.id) : [...ids, p.id],
                    )
                  }
                />
              ))}
            </div>
          </section>
        ))
      )}
      <div className="collection-footnote">
        <Sparkles size={15} />
        <p>
          No TikTok Favorites access or private scraping. This is your independent collection,
          organized from the content you provide.
        </p>
        <ArrowRight size={15} />
      </div>
    </>
  );
}
