'use client';
import Link from 'next/link';
import { ArrowRight, Check, MapPin, Sparkles } from 'lucide-react';
import { useLibrary } from './library-provider';
import { buildSuggestions } from '@/lib/suggestions';
import { GeneratePlanButton } from './generate-plan';
import { ImportPlacesButton } from './import-places';
import { Photo } from './shell';
export function LibraryHome() {
  const { places, ready, details } = useLibrary();
  if (!ready)
    return (
      <div className="library-home-loading" role="status">
        Organizing your collection…
      </div>
    );
  const suggestions = buildSuggestions(places, details);
  const real = places.filter((p) => !p.sample);
  const readyCount = real.filter((p) => p.state === 'ready').length;
  const reviewCount = real.filter((p) => p.state === 'needs_review' || p.state === 'failed').length;
  return (
    <section className="library-home">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            <Sparkles size={12} />A LITTLE INSPIRATION, ALREADY CONNECTED
          </p>
          <h2>
            {real.length
              ? `${real.length} saved ${real.length === 1 ? 'place' : 'places'}. A few very good possibilities.`
              : 'Try a sample collection. Then make it your own.'}
          </h2>
          <p>
            {real.length
              ? `${readyCount} ready for planning${reviewCount ? ` · ${reviewCount} need a little context or verification` : ''}. Suggestions update as your library changes.`
              : 'These suggestions are built from the clearly labeled sample places in your library.'}
          </p>
        </div>
        <Link href="/places" className="text-link">
          My Places <ArrowRight size={14} />
        </Link>
      </div>
      {suggestions.length ? (
        <div className="suggestion-grid">
          {suggestions.slice(0, 3).map((s) => (
            <article className="suggestion-card" key={s.id}>
              <div className="suggestion-photo">
                <Photo src={s.image} alt="Illustrative collection image" />
                <span>
                  {s.sample
                    ? 'SAMPLE COLLECTION'
                    : `${s.verifiedCount}/${s.placeIds.length} LOCATION MATCHES`}
                </span>
              </div>
              <div className="suggestion-copy">
                <span className="category-label">
                  <MapPin size={11} />
                  {s.city} · {s.placeIds.length} {s.sample ? 'sample places' : 'saved places'}
                </span>
                <h3>{s.title}</h3>
                <p>{s.reason}</p>
                <GeneratePlanButton variant="outline" placeIds={s.placeIds} title={s.title}>
                  {s.sample ? 'Try this sample' : 'Make a day of it'}
                </GeneratePlanButton>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="library-home-empty">
          <Sparkles size={27} />
          <h3>A place, a little context, a whole new possibility.</h3>
          <p>
            Collect something with a name and city. We’ll start connecting your saves into outing
            ideas.
          </p>
          <ImportPlacesButton />
        </div>
      )}
      <div className="library-value-strip">
        <span>
          <Check size={13} />
          Collect without creating a plan
        </span>
        <span>
          <Check size={13} />
          AI asks when it’s unsure
        </span>
        <span>
          <Check size={13} />
          Reuse your places anytime
        </span>
      </div>
    </section>
  );
}
