'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, MapPin, Map } from 'lucide-react';
import { useLibrary } from './library-provider';
import { GoogleAttribution } from './place-editor';
import { Button } from './ui/button';
import type { Plan } from '@/lib/types';
import { ApiErrorSchema } from '@/lib/library-types';
export function LivePlanMap({ plan }: { plan: Plan }) {
  const { places, details, capabilities } = useLibrary();
  const [map, setMap] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = useRef('');
  const stopPlaces = plan.stops
    .map((s) => places.find((p) => p.id === s.videoId))
    .filter((p) => !!p);
  const first = stopPlaces[0];
  const firstDetails = first ? details[first.id] : null;
  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current);
    },
    [],
  );
  async function loadMap() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: stopPlaces.map((p) => p.googlePlaceId) }),
        cache: 'no-store',
      });
      if (!response.ok) {
        const err = ApiErrorSchema.safeParse(await response.json());
        throw new Error(err.success ? err.data.error.message : 'The map could not load.');
      }
      const blob = await response.blob();
      if (current.current) URL.revokeObjectURL(current.current);
      const url = URL.createObjectURL(blob);
      current.current = url;
      setMap(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The map could not load.');
    } finally {
      setBusy(false);
    }
  }
  const destination = stopPlaces[stopPlaces.length - 1];
  const directions = new URL('https://www.google.com/maps/dir/');
  directions.searchParams.set('api', '1');
  if (destination) {
    directions.searchParams.set('destination', destination.extraction?.name || 'Destination');
    if (destination.googlePlaceId)
      directions.searchParams.set('destination_place_id', destination.googlePlaceId);
  }
  if (first && stopPlaces.length > 1) {
    directions.searchParams.set('origin', first.extraction?.name || 'First stop');
    if (first.googlePlaceId) directions.searchParams.set('origin_place_id', first.googlePlaceId);
  }
  if (stopPlaces.length > 2) {
    directions.searchParams.set(
      'waypoints',
      stopPlaces
        .slice(1, -1)
        .map((p) => p.extraction?.name || 'Saved place')
        .join('|'),
    );
    directions.searchParams.set(
      'waypoint_place_ids',
      stopPlaces
        .slice(1, -1)
        .map((p) => p.googlePlaceId)
        .join('|'),
    );
  }
  directions.searchParams.set(
    'travelmode',
    plan.preferences.transport === 'Walking'
      ? 'walking'
      : plan.preferences.transport === 'Driving'
        ? 'driving'
        : 'transit',
  );
  return (
    <aside className="map-card live-map">
      <div className="map-header">
        <h3>Your places, in the real world.</h3>
        <span>VERIFIED LOCATION IDS · NO SIMULATED MAP</span>
      </div>
      {map ? (
        <Image
          src={map}
          width={640}
          height={400}
          unoptimized
          alt="Google map with numbered stop markers; no route line"
          className="live-map-image"
        />
      ) : (
        <div className="live-map-placeholder">
          <Map size={35} />
          <p>
            {capabilities?.maps
              ? 'Load a Google map with your stop markers.'
              : 'Map images need Maps Static API configuration.'}
          </p>
          {capabilities?.maps && (
            <Button variant="outline" size="sm" onClick={loadMap} disabled={busy}>
              {busy ? 'Loading…' : 'Load Google Map'}
            </Button>
          )}
          <small>Markers only; use Google Maps for directions.</small>
        </div>
      )}
      {error && (
        <p role="alert" className="field-error px-4 pb-4">
          {error}
        </p>
      )}
      <div className="live-map-details">
        {firstDetails && (
          <>
            <p>
              <MapPin size={13} />
              {firstDetails.name}
            </p>
            <span>{firstDetails.address}</span>
            <GoogleAttribution place={firstDetails} />
          </>
        )}
        <Button variant="outline" size="sm" asChild>
          <a href={directions.href} target="_blank" rel="noopener noreferrer">
            Open directions in Google Maps
            <ExternalLink size={12} />
          </a>
        </Button>
        <small>
          Directions open at your selected venues. Recheck routing, opening hours, prices, and
          reservations before going.
        </small>
      </div>
    </aside>
  );
}
