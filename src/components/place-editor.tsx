'use client';
import { useState } from 'react';
import { Check, ExternalLink, MapPin, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import {
  categories,
  type Extraction,
  type GooglePlace,
  type SavedPlace,
} from '@/lib/library-types';
import { useLibrary } from './library-provider';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog';
import { TimeSchema, minutes } from '@/lib/planning';
export function GoogleAttribution({ place }: { place: GooglePlace }) {
  return (
    <div className="google-attribution">
      <a href={place.mapsUrl} target="_blank" rel="noopener noreferrer">
        Google Maps <ExternalLink size={11} />
      </a>
      {place.attributions
        .filter((a) => a.name !== 'Google Maps')
        .map((a) => (
          <a href={a.uri} key={a.name} target="_blank" rel="noopener noreferrer">
            {a.name}
          </a>
        ))}
    </div>
  );
}
export function PlaceEditor({ place }: { place: SavedPlace }) {
  const { updatePlace, deletePlace, verifyPlace, details, matches } = useLibrary();
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState(place.context);
  const [name, setName] = useState(place.extraction?.name || '');
  const [city, setCity] = useState(place.extraction?.city || '');
  const [neighborhood, setNeighborhood] = useState(place.extraction?.neighborhood || '');
  const [description, setDescription] = useState(place.extraction?.description || '');
  const [category, setCategory] = useState<Extraction['category']>(
    place.extraction?.category || 'Other',
  );
  const [duration, setDuration] = useState(String(place.extraction?.durationMinutes || ''));
  const [cost, setCost] = useState(
    place.extraction?.cost?.currency === 'USD' ? place.extraction.cost.amount.toString() : '',
  );
  const [date, setDate] = useState(place.confirmedHours?.date || '');
  const [start, setStart] = useState(place.confirmedHours?.start || '');
  const [end, setEnd] = useState(place.confirmedHours?.end || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  function initialize() {
    setContext(place.context);
    setName(place.extraction?.name || '');
    setCity(place.extraction?.city || '');
    setNeighborhood(place.extraction?.neighborhood || '');
    setDescription(place.extraction?.description || '');
    setCategory(place.extraction?.category || 'Other');
    setDuration(String(place.extraction?.durationMinutes || ''));
    setCost(
      place.extraction?.cost?.currency === 'USD' ? place.extraction.cost.amount.toString() : '',
    );
    setDate(place.confirmedHours?.date || '');
    setStart(place.confirmedHours?.start || '');
    setEnd(place.confirmedHours?.end || '');
    setError('');
    setDeleting(false);
  }
  function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (
      (date || start || end) &&
      (!date ||
        !TimeSchema.safeParse(start).success ||
        !TimeSchema.safeParse(end).success ||
        minutes(end) <= minutes(start))
    ) {
      setError('Use a complete date and a confirmed availability window ending after it starts.');
      return;
    }
    if (context === place.context && (!name.trim() || !city.trim())) {
      setError('Add a place name and city, or provide new source context for AI to analyze.');
      return;
    }
    const extraction: Extraction = {
      name: name.trim() || null,
      city: city.trim() || null,
      neighborhood: neighborhood.trim() || null,
      category,
      description: description.trim() || null,
      durationMinutes: duration ? Number(duration) : null,
      cost:
        cost === ''
          ? null
          : { amount: Number(cost), currency: 'USD', evidence: 'User-confirmed USD estimate.' },
      confidence: place.extraction?.confidence ?? 0,
      evidence: place.extraction?.evidence || [],
      missingInfo: [],
    };
    updatePlace(place.id, extraction, context, date ? { date, start, end } : null);
    setOpen(false);
  }
  async function verify(id?: string) {
    setBusy(true);
    setError('');
    try {
      await verifyPlace(place.id, id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  }
  const current = details[place.id];
  const alternatives = matches[place.id] || [];
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) initialize();
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Review ${place.extraction?.name || 'import'}`}
        >
          <Pencil size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent className="place-editor">
        <DialogTitle className="text-2xl font-semibold pr-6">
          Make sure it’s your kind of place.
        </DialogTitle>
        <DialogDescription className="mt-2 mb-5 text-sm text-muted leading-relaxed">
          {place.sample
            ? 'This is an illustrative sample, never a verified listing.'
            : 'Review AI’s understanding. Your corrections and estimates are saved independently of Google’s data.'}
        </DialogDescription>
        {place.error && <div className="review-message">{place.error}</div>}
        {!place.sample && (
          <div className="verification-box">
            <div className="flex justify-between items-center gap-3">
              <h3>
                <MapPin size={15} />
                {current ? 'Google location' : 'Confirm the real location'}
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => verify()}
                disabled={busy || !place.extraction}
              >
                {busy ? <RefreshCw size={13} className="animate-spin" /> : <MapPin size={13} />}Find
                matches
              </Button>
            </div>
            {current && (
              <>
                <b>{current.name}</b>
                <p>{current.address}</p>
                {current.weekdayDescriptions.length > 0 && (
                  <details>
                    <summary>Published regular hours</summary>
                    <ul>
                      {current.weekdayDescriptions.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <GoogleAttribution place={current} />
              </>
            )}
            {!current && <p>{place.stage}</p>}
            {alternatives.length > 0 && !place.googlePlaceId && (
              <div className="match-list">
                {alternatives.map((m) => (
                  <div key={m.id}>
                    <div>
                      <b>{m.name}</b>
                      <p>{m.address}</p>
                      <GoogleAttribution place={m} />
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => verify(m.id)}
                    >
                      <Check size={13} />
                      This one
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <small>
              Addresses, coordinates, matches and hours are fetched on demand, kept in memory only,
              and are not saved to browser storage.
            </small>
          </div>
        )}
        <form onSubmit={save}>
          <label className="field-label mt-5" htmlFor={`context-${place.id}`}>
            Source description or transcript
          </label>
          <textarea
            id={`context-${place.id}`}
            className="field textarea"
            rows={3}
            maxLength={12000}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Tell us what’s in the video. Include the business name and city if known."
          />
          <p className="field-help">
            Changing source context automatically re-runs AI. Editing the fields below queues
            location verification only.
          </p>
          <div className="form-grid mt-5">
            <div className="col-span-full">
              <label className="field-label" htmlFor="place-name">
                Place name
              </label>
              <input
                id="place-name"
                className="field"
                maxLength={160}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="place-city">
                City
              </label>
              <input
                id="place-city"
                className="field"
                maxLength={120}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="place-neighborhood">
                Neighborhood
              </label>
              <input
                id="place-neighborhood"
                className="field"
                maxLength={120}
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
              />
            </div>
            <div className="col-span-full">
              <label className="field-label" htmlFor="place-category">
                Activity type
              </label>
              <select
                id="place-category"
                className="field"
                value={category}
                onChange={(e) => setCategory(e.target.value as Extraction['category'])}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="place-duration">
                Visit estimate (minutes)
              </label>
              <input
                id="place-duration"
                type="number"
                min="10"
                max="480"
                className="field"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="place-cost">
                Your estimate (USD / person)
              </label>
              <input
                id="place-cost"
                type="number"
                min="0"
                max="100000"
                step="0.01"
                className="field"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="Unknown"
              />
            </div>
            <div className="col-span-full">
              <label className="field-label" htmlFor="place-description">
                Experience
              </label>
              <textarea
                id="place-description"
                rows={2}
                className="field textarea"
                maxLength={1600}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <details className="availability-details">
            <summary>Already checked availability for a specific date?</summary>
            <p className="field-help">
              Only add a window you have confirmed yourself. This is your planning context, not a
              reservation or Google data.
            </p>
            <div className="form-grid mt-4">
              <div className="col-span-full">
                <label htmlFor="availability-date" className="field-label">
                  Confirmed date
                </label>
                <input
                  id="availability-date"
                  type="date"
                  className="field"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="availability-start" className="field-label">
                  Available from
                </label>
                <input
                  id="availability-start"
                  type="time"
                  className="field"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="availability-end" className="field-label">
                  Available until
                </label>
                <input
                  id="availability-end"
                  type="time"
                  className="field"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
          </details>
          {place.extraction?.missingInfo.length ? (
            <div className="review-message">
              <b>AI flagged for review</b>
              <ul>
                {place.extraction.missingInfo.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {place.extraction?.evidence.length ? (
            <details className="evidence-details">
              <summary>
                What AI used · confidence {Math.round(place.extraction.confidence * 100)}%
              </summary>
              <ul>
                {place.extraction.evidence.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              <p>AI confidence is not a guarantee of real-world accuracy.</p>
            </details>
          ) : null}
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <div className="editor-footer">
            <Button type="button" variant="destructive" size="sm" onClick={() => setDeleting(true)}>
              <Trash2 size={13} />
              Delete
            </Button>
            <Button type="submit">
              {context !== place.context ? 'Save context & analyze' : 'Save corrections'}
            </Button>
          </div>
          {deleting && (
            <div role="alert" className="delete-confirm">
              <p>Remove this place from your library? Existing plans keep their saved snapshots.</p>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => {
                  deletePlace(place.id);
                  setOpen(false);
                }}
              >
                Yes, delete place
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setDeleting(false)}>
                Keep it
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
