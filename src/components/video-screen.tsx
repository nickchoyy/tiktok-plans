'use client';
import Link from 'next/link';
import {
  ArrowRight,
  Bookmark,
  Check,
  ExternalLink,
  Link2,
  Plus,
  Sparkles,
  Trash2,
  Video as VideoIcon,
} from 'lucide-react';
import { useState } from 'react';
import { usePlans } from './plan-provider';
import { sampleVideos } from '@/lib/sample-data';
import type { Plan, Video } from '@/lib/types';
import { useLibrary } from './library-provider';
import { normalizeTikTokUrl } from '@/lib/imports';
import { Button } from './ui/button';
import { CreatePlanButton, EmptyState, LoadingState, Photo } from './shell';
export function VideoCard({
  video,
  selected,
  onSelect,
  onRemove,
}: {
  video: Video;
  selected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
}) {
  return (
    <article className="video-card">
      <div className="video-image">
        <Photo
          src={video.image}
          alt={
            video.sample
              ? 'Illustrative sample for ' + video.title
              : 'Placeholder photo for your saved link'
          }
        />
        <span className="video-type">{video.sample ? 'SAMPLE VIDEO' : 'SAVED LINK'}</span>
        <span className="video-play">
          <VideoIcon size={19} />
        </span>
        {onSelect && (
          <Button
            size="icon"
            variant={selected ? 'default' : 'outline'}
            className="video-add"
            aria-label={`${selected ? 'Remove' : 'Add'} ${video.title}`}
            aria-pressed={!!selected}
            onClick={onSelect}
          >
            {selected ? <Check size={18} /> : <Plus size={18} />}
          </Button>
        )}
      </div>
      <div className="video-card-body">
        <span className="category-label">{video.category}</span>
        <h3>{video.title}</h3>
        <p>
          {video.sample ? video.creator : 'Add context and review details in My Places'}{' '}
          <span>·</span> {video.neighborhood}
        </p>
        <div className="video-card-bottom">
          <a href={video.sourceUrl} target="_blank" rel="noopener noreferrer">
            {video.sample ? 'Sample source' : 'Open TikTok'}
            <ExternalLink size={12} />
          </a>
          {onRemove && (
            <button className="icon-button" aria-label={`Remove ${video.title}`} onClick={onRemove}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
export function VideoScreen({ plan }: { plan: Plan }) {
  const { updatePlan, notify } = usePlans();
  const { importItems } = useLibrary();
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  function toggle(video: Video) {
    const exists = plan.videos.some((v) => v.id === video.id);
    updatePlan(plan.id, (p) => ({
      ...p,
      videos: exists ? p.videos.filter((v) => v.id !== video.id) : [...p.videos, video],
      stops: exists ? p.stops.filter((s) => s.videoId !== video.id) : p.stops,
    }));
    notify(exists ? 'Removed from your inspiration.' : 'A little inspiration, saved.');
  }
  async function addUrl(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    let parsed: URL;
    try {
      parsed = new URL(normalizeTikTokUrl(url.trim()));
      if (
        parsed.protocol !== 'https:' ||
        ![
          'tiktok.com',
          'www.tiktok.com',
          'vm.tiktok.com',
          'vt.tiktok.com',
          'm.tiktok.com',
        ].includes(parsed.hostname) ||
        parsed.pathname === '/'
      )
        throw new Error();
    } catch {
      setError(
        'Add a valid HTTPS TikTok video or short link, like https://www.tiktok.com/@creator/video/123.',
      );
      return;
    }
    if (plan.videos.some((v) => v.sourceUrl === parsed.href)) {
      setError('That link is already in this plan.');
      return;
    }
    setAdding(true);
    let id: string;
    try {
      const result = await importItems([{ sourceUrl: parsed.href, context: '' }]);
      id = result.ids[0];
      if (!id) throw new Error('This link could not be collected.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This link could not be collected.');
      setAdding(false);
      return;
    }
    setAdding(false);
    const video: Video = {
      id,
      placeId: id,
      title: 'A new place to discover',
      creator: 'Your saved link',
      sourceUrl: parsed.href,
      image: '/images/restaurant.jpg',
      category: 'Things to do',
      neighborhood: 'Location not verified',
      duration: 60,
      cost: 0,
      sample: false,
    };
    updatePlan(plan.id, (p) => ({ ...p, videos: [...p.videos, video] }));
    setUrl('');
    notify(
      'Link added to My Places. Add context there for AI; this blank plan keeps using illustrative sample planning.',
    );
  }
  return (
    <section className="screen-section">
      <div className="screen-title">
        <span className="section-kicker">01 / THE INSPIRATION</span>
        <h2>First, what caught your eye?</h2>
        <p>Bring a few saved videos. We’ll turn “we should go” into a plan.</p>
      </div>
      <form className="url-form" onSubmit={addUrl}>
        <label htmlFor="video-url" className="field-label">
          Paste a TikTok link
        </label>
        <div className="url-input-row">
          <span>
            <Link2 size={19} />
          </span>
          <input
            id="video-url"
            type="url"
            required
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            placeholder="https://www.tiktok.com/@creator/video/…"
            aria-invalid={!!error}
            aria-describedby={error ? 'url-error' : 'url-note'}
          />
          <Button type="submit" disabled={adding}>
            <Plus size={16} />
            Add video
          </Button>
        </div>
        {error ? (
          <p id="url-error" role="alert" className="field-error">
            {error}
          </p>
        ) : (
          <p id="url-note" className="field-help">
            Links are saved as bookmarks. Video details and locations aren’t fetched yet.
          </p>
        )}
      </form>
      {plan.videos.filter((v) => !v.sample).length > 0 && (
        <>
          <h3 className="subheading">
            Your links{' '}
            <span className="count-pill">{plan.videos.filter((v) => !v.sample).length}</span>
          </h3>
          <div className="video-grid mb-8">
            {plan.videos
              .filter((v) => !v.sample)
              .map((v) => (
                <VideoCard key={v.id} video={v} onRemove={() => toggle(v)} />
              ))}
          </div>
        </>
      )}
      <div className="section-heading">
        <div>
          <h3 className="subheading">
            <Sparkles size={17} /> A little inspiration to get started
          </h3>
          <p>Try these sample videos. Places, creators, and details are illustrative.</p>
        </div>
        <span className="sample-tag">DEMO COLLECTION</span>
      </div>
      <div className="video-grid">
        {sampleVideos.map((v) => (
          <VideoCard
            key={v.id}
            video={v}
            selected={plan.videos.some((p) => p.id === v.id)}
            onSelect={() => toggle(v)}
          />
        ))}
      </div>
      <div className="step-footer">
        <span>
          <Bookmark size={16} />
          {plan.videos.length} {plan.videos.length === 1 ? 'video' : 'videos'} in your plan
        </span>
        <Button asChild={plan.videos.length > 0} disabled={!plan.videos.length}>
          {plan.videos.length > 0 ? (
            <Link href={`/plans/${plan.id}/preferences`}>
              Make it your kind of day <ArrowRight size={16} />
            </Link>
          ) : (
            <span>Add a video to continue</span>
          )}
        </Button>
      </div>
    </section>
  );
}
export function InspirationLibrary() {
  const { plans, ready } = usePlans();
  const [filter, setFilter] = useState('All inspiration');
  if (!ready) return <LoadingState />;
  const saved = [...new Map(plans.flatMap((p) => p.videos).map((v) => [v.id, v])).values()];
  const shown =
    filter === 'Your bookmarks'
      ? saved.filter((v) => !v.sample)
      : filter === 'Food & drink'
        ? saved.filter((v) => v.category === 'Food & drink')
        : saved;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FOR YOUR NEXT “LET’S GO”</p>
          <h1>Your saved inspiration.</h1>
          <p>All the little places that could become a very good day.</p>
        </div>
        <CreatePlanButton />
      </div>
      <div className="info-note">
        <Sparkles size={18} />
        <p>
          Save videos inside a plan to build your collection. Sample cards are illustrative, with no
          real video or venue data.
        </p>
      </div>
      <div className="filter-tabs my-7" role="group" aria-label="Filter inspiration">
        {['All inspiration', 'Food & drink', 'Your bookmarks'].map((f) => (
          <button
            key={f}
            className={filter === f ? 'active' : ''}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="video-grid library-grid">
          {shown.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Your next great find belongs here."
          description="Create a plan and paste a TikTok link to save your first bookmark."
        >
          <CreatePlanButton />
        </EmptyState>
      )}
      <div className="bottom-callout mt-10">
        <span className="callout-symbol">
          <Bookmark size={24} />
        </span>
        <div>
          <h3>One good find is all it takes.</h3>
          <p>Your saved videos become the starting point for a plan.</p>
        </div>
        <Link href="/">
          Back to your plans <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
}
