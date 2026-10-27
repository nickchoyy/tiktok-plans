'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  Bookmark,
  ChevronRight,
  CircleHelp,
  Compass,
  LayoutGrid,
  MapPin,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog';
import { useLibrary } from './library-provider';
import { ImportPlacesButton } from './import-places';
import { usePlans } from './plan-provider';
import { cn } from '@/lib/utils';
export function CreatePlanButton({
  className,
  variant = 'default',
  children,
}: {
  className?: string;
  variant?: 'default' | 'lime' | 'outline';
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const { createPlan } = usePlans();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={className} variant={variant}>
          <Plus size={17} />
          {children ?? 'Create a plan'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <span className="dialog-icon">
          <Sparkles size={24} />
        </span>
        <DialogTitle className="text-2xl font-semibold tracking-tight">
          Something to look forward to.
        </DialogTitle>
        <DialogDescription className="mt-2 mb-6 text-sm leading-relaxed text-muted">
          Name a blank plan for manual sample planning. For a real AI outing, collect and verify
          places in My Places first.
        </DialogDescription>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const id = createPlan(name);
            setOpen(false);
            setName('');
            router.push(`/plans/${id}/videos`);
          }}
        >
          <label className="field-label" htmlFor="plan-name">
            Plan name
          </label>
          <input
            id="plan-name"
            autoFocus
            required
            maxLength={70}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Saturday with the group chat"
            className="field"
          />
          <p className="mt-3 mb-6 text-xs text-muted">Saved on this device. No account needed.</p>
          <Button type="submit" className="w-full" disabled={!name.trim()}>
            Let’s make a plan <ArrowUpRight size={17} />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { places } = useLibrary();
  const { plans, ready, error, notice, retrySave, dismissError } = usePlans();
  const isPlan = pathname.startsWith('/plans/');
  return (
    <div className="app-layout">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="TikTok Plans home">
          <span className="brand-mark">
            <Compass size={23} strokeWidth={1.7} />
          </span>
          <span>
            tiktok<span className="font-normal">plans</span>
            <span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="sidebar-section-label">YOUR LITTLE CORNER</div>
        <nav className="side-nav" aria-label="Main navigation">
          <Link className={cn('nav-item', !isPlan && pathname === '/' && 'active')} href="/">
            <LayoutGrid size={19} />
            Overview
          </Link>
          <Link
            className={cn(
              'nav-item',
              (pathname === '/places' || pathname === '/videos') && 'active',
            )}
            href="/places"
          >
            <Bookmark size={19} />
            My Places
            <span className="nav-count">{places.length}</span>
          </Link>
        </nav>
        <div className="sidebar-section-label mt-9 flex justify-between items-center">
          YOUR PLANS
          <CreatePlanButton className="sidebar-plus" variant="outline">
            <span className="sr-only">Create a plan</span>
          </CreatePlanButton>
        </div>
        <nav aria-label="Your plans" className="recent-plans">
          {plans.slice(0, 4).map((p, i) => (
            <Link
              href={`/plans/${p.id}/${p.stops.length ? 'itinerary' : 'videos'}`}
              key={p.id}
              className={cn('recent-plan', pathname.includes(p.id) && 'selected')}
            >
              <span
                className={cn('plan-dot', i % 3 === 1 ? 'green' : i % 3 === 2 ? 'peach' : '')}
              />
              <span className="truncate">{p.name}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="little-note">
            <span className="note-spark">✳︎</span>
            <p>
              Good plans start
              <br />
              with a little inspiration.
            </p>
            <Link href="/places">
              Find your next thing <ArrowUpRight size={13} />
            </Link>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <button className="how-button">
                <CircleHelp size={18} /> A little help?
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle className="text-xl font-semibold">
                From saved to see you there.
              </DialogTitle>
              <DialogDescription className="mt-3 text-sm text-muted">
                Your guide to a very good day out.
              </DialogDescription>
              <ol className="help-list">
                <li>
                  <b>1. Collect your inspiration.</b> Bring links, descriptions, or permitted videos
                  to My Places.
                </li>
                <li>
                  <b>2. Let the collection come together.</b> AI organizes your content, asks about
                  uncertainty, and suggests outings from your places.
                </li>
                <li>
                  <b>3. Make the plan yours.</b> Rearrange stops, lock favorites, and invite your
                  crew to vote locally.
                </li>
              </ol>
              <p className="text-xs text-muted">
                This independent prototype is not affiliated with TikTok. All plans stay in this
                browser. AI and Google verification use server-side credentials when configured. No
                private TikTok access or shared sync.
              </p>
            </DialogContent>
          </Dialog>
        </div>
        <div className="sidebar-profile">
          <span className="avatar lavender">YO</span>
          <div>
            <b>Your personal space</b>
            <span>No account needed</span>
          </div>
          <span className="local-dot" title="Local demo" />
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <Link href="/" className="mobile-brand">
            <Compass size={22} />
            tiktokplans.
          </Link>
          <div className="breadcrumb">
            <span>Your space</span>
            <ChevronRight size={14} />
            <b>
              {isPlan
                ? 'Your plan'
                : pathname === '/videos' || pathname === '/places'
                  ? 'My Places'
                  : 'Overview'}
            </b>
          </div>
          <div className="topbar-right">
            <span className="device-label">
              <span className="local-dot" />{' '}
              {error ? 'Session only' : ready ? 'Saved on this device' : 'Getting ready…'}
            </span>
            <span className="avatar lavender small" aria-label="You, local user">
              YO
            </span>
          </div>
        </header>
        {error && (
          <div role="alert" className="error-banner">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={retrySave}>
              Retry save
            </Button>
            <button aria-label="Dismiss storage error" onClick={dismissError}>
              <X size={16} />
            </button>
          </div>
        )}
        <main id="main" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>A little less someday. A little more let’s go.</span>
          <span>Independent prototype · Sample content · Not affiliated with TikTok</span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <Link href="/" className={pathname === '/' ? 'selected' : ''}>
          <LayoutGrid size={20} />
          Overview
        </Link>
        <ImportPlacesButton className="mobile-create">Collect</ImportPlacesButton>
        <Link
          href="/places"
          className={pathname === '/videos' || pathname === '/places' ? 'selected' : ''}
        >
          <Bookmark size={20} />
          My Places
        </Link>
      </nav>
      {notice && (
        <div className="toast" role="status">
          <span className="local-dot" />
          {notice}
        </div>
      )}
    </div>
  );
}
export function Avatars({
  members,
  small = false,
}: {
  members: { initials: string; color: string; name: string }[];
  small?: boolean;
}) {
  return (
    <div className={cn('avatar-stack', small && 'compact')}>
      {members.slice(0, 4).map((m) => (
        <span key={m.name} className={cn('avatar', m.color)} title={m.name}>
          {m.initials}
        </span>
      ))}
      {members.length > 4 && <span className="avatar neutral">+{members.length - 4}</span>}
    </div>
  );
}
export function Photo({
  src,
  alt,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      unoptimized
      className={cn('object-cover', className)}
      sizes="(max-width: 700px) 100vw, 40vw"
    />
  );
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <MapPin size={25} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function LoadingState() {
  return (
    <div role="status" className="loading-state">
      <span className="loading-orbit" />
      <p>Getting your good plans together…</p>
    </div>
  );
}
