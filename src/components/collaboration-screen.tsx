'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, Heart, Plus, UserPlus, Users, X } from 'lucide-react';
import type { Plan } from '@/lib/types';
import { usePlans } from './plan-provider';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog';
import { Avatars, EmptyState, Photo } from './shell';
import { cn, formatDate, uid } from '@/lib/utils';
export function CollaborationScreen({ plan }: { plan: Plan }) {
  const { updatePlan, notify } = usePlans();
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  function addMember(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (plan.members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('That person is already in your crew.');
      return;
    }
    updatePlan(plan.id, (p) => ({
      ...p,
      members: [
        ...p.members,
        {
          id: uid(),
          name: trimmed,
          initials: trimmed
            .split(/\s+/)
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase(),
          color: ['peach', 'green', 'lavender'][p.members.length % 3],
          role: 'Member',
        },
      ],
    }));
    setName('');
    setOpen(false);
    setError('');
    notify('Added to your local crew. No invitation was sent.');
  }
  async function copySummary() {
    const summary = `${plan.name}\n${plan.preferences.city} · ${formatDate(plan.preferences.date)}\n${plan.stops.map((s, i) => `${i + 1}. ${plan.videos.find((v) => v.id === s.videoId)?.title}`).join('\n')}\n${plan.mode === 'live' ? 'Plan from TikTok Plans. Confirm current hours, costs, routes and bookings before going.' : 'Sample plan from TikTok Plans. Confirm all places and details before going.'}`;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      notify('Plan summary copied. Share it wherever your people are.');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError(
        'Clipboard access is unavailable. You can copy the plan details from the itinerary.',
      );
    }
  }
  function vote(stopId: string) {
    updatePlan(plan.id, (p) => ({
      ...p,
      stops: p.stops.map((s) =>
        s.id === stopId
          ? {
              ...s,
              votes: s.votes.includes('you')
                ? s.votes.filter((id) => id !== 'you')
                : [...s.votes, 'you'],
            }
          : s,
      ),
    }));
  }
  return (
    <section className="screen-section">
      <div className="screen-title-row">
        <div className="screen-title">
          <span className="section-kicker">04 / BETTER TOGETHER</span>
          <h2>Good days need good company.</h2>
          <p>Get the crew together. Find the stops everyone’s excited about.</p>
        </div>
        <Button variant="outline" onClick={copySummary}>
          {copied ? <Check size={15} /> : <Copy size={15} />}{' '}
          {copied ? 'Copied!' : 'Copy plan summary'}
        </Button>
      </div>
      <div className="collab-layout">
        <section className="members-panel">
          <div className="section-heading">
            <h3>
              Your people <span className="count-pill">{plan.members.length}</span>
            </h3>
            <Dialog
              open={open}
              onOpenChange={(v) => {
                setOpen(v);
                setError('');
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <UserPlus size={14} />
                  Add a friend
                </Button>
              </DialogTrigger>
              <DialogContent>
                <span className="dialog-icon">
                  <Users size={23} />
                </span>
                <DialogTitle className="text-2xl font-semibold">
                  Better with your people.
                </DialogTitle>
                <DialogDescription className="mt-2 mb-6 text-sm text-muted">
                  Add a friend to this local demo. This won’t send an invitation or create a real
                  account.
                </DialogDescription>
                <form onSubmit={addMember}>
                  <label className="field-label" htmlFor="friend-name">
                    Friend’s name
                  </label>
                  <input
                    className="field"
                    id="friend-name"
                    required
                    maxLength={50}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError('');
                    }}
                    placeholder="e.g. Jamie Chen"
                  />
                  {error && (
                    <p className="field-error" role="alert">
                      {error}
                    </p>
                  )}
                  <Button type="submit" className="w-full mt-6" disabled={!name.trim()}>
                    <Plus size={16} />
                    Add to local crew
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="members-list">
            {plan.members.map((m) => (
              <div className="member-row" key={m.id}>
                <span className={cn('avatar', m.color)}>{m.initials}</span>
                <div>
                  <b>{m.name}</b>
                  <span>{m.id === 'you' ? 'That’s you' : 'Local demo member'}</span>
                </div>
                <span className="member-role">{m.role}</span>
                {m.id !== 'you' && (
                  <button
                    className="icon-button"
                    aria-label={`Remove member ${m.name}`}
                    onClick={() => {
                      updatePlan(plan.id, (p) => ({
                        ...p,
                        members: p.members.filter((n) => n.id !== m.id),
                        stops: p.stops.map((s) => ({
                          ...s,
                          votes: s.votes.filter((v) => v !== m.id),
                        })),
                      }));
                      notify('Removed from the local crew.');
                    }}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="info-note">
            <Users size={18} />
            <p>
              Local demo only. Members and votes stay in this browser. Shared links, invitations,
              and live collaboration need a backend.
            </p>
          </div>
        </section>
        <div className="crew-note">
          <span className="note-spark">♡</span>
          <h3>
            The best part
            <br />
            is who you go with.
          </h3>
          <p>A shared plan starts with a little “I’m in.” Give the stops you love a heart.</p>
          <Avatars members={plan.members} />
        </div>
      </div>
      <section className="voting-section">
        <div className="section-heading">
          <div>
            <h3>The group chat, but with a plan.</h3>
            <p>Vote as yourself. One heart per stop, and you can change your mind.</p>
          </div>
          <span className="sample-tag">{plan.stops.length} STOPS TO VOTE ON</span>
        </div>
        {!plan.stops.length ? (
          <EmptyState
            title="First, a few good possibilities."
            description="Build your itinerary to give your crew something to look forward to."
          >
            <Button asChild>
              <Link href={`/plans/${plan.id}/preferences`}>
                {plan.mode === 'live' ? 'Generate an itinerary' : 'Build a sample itinerary'}{' '}
                <ArrowRight size={16} />
              </Link>
            </Button>
          </EmptyState>
        ) : (
          <div className="vote-list">
            {plan.stops.map((s, i) => {
              const v = plan.videos.find((v) => v.id === s.videoId);
              if (!v) return null;
              return (
                <article className="vote-card" key={s.id}>
                  <span className="vote-number">0{i + 1}</span>
                  <div className="vote-image">
                    <Photo src={v.image} alt={`Illustrative photo for ${v.title}`} />
                  </div>
                  <div className="vote-copy">
                    <span className="category-label">{v.category}</span>
                    <h4>{v.title}</h4>
                    <p>
                      {s.votes.length
                        ? `${s.votes.length} ${s.votes.length === 1 ? 'person is' : 'people are'} in${s.votes.includes('you') ? ' · Including you' : ''}`
                        : 'Be the first to say “I’m in”'}
                    </p>
                  </div>
                  <Button
                    variant={s.votes.includes('you') ? 'secondary' : 'outline'}
                    size="sm"
                    aria-pressed={s.votes.includes('you')}
                    aria-label={`Vote for ${v.title}`}
                    onClick={() => vote(s.id)}
                  >
                    <Heart size={16} fill={s.votes.includes('you') ? 'currentColor' : 'none'} />
                    {s.votes.length}
                    <span className="hidden sm:inline">
                      {s.votes.includes('you') ? 'You’re in' : 'I’m in'}
                    </span>
                  </Button>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {error && !open && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="step-footer">
        <Button variant="ghost" asChild>
          <Link href={`/plans/${plan.id}/itinerary`}>
            <ArrowLeft size={16} />
            Back to the itinerary
          </Link>
        </Button>
        <Button asChild>
          <Link href="/">
            Back to your space <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
    </section>
  );
}
