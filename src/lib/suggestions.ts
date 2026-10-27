import type { GooglePlace, OutingSuggestion, SavedPlace } from './library-types';
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dlat = rad(b.latitude - a.latitude),
    dlon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function buildSuggestions(
  places: SavedPlace[],
  details: Record<string, GooglePlace> = {},
): OutingSuggestion[] {
  const groups: SavedPlace[][] = [];
  const seenLocations = new Set<string>();
  for (const p of places.filter(
    (p) =>
      p.extraction?.city &&
      (p.state === 'ready' || p.state === 'needs_review') &&
      p.extraction?.name,
  )) {
    if (p.googlePlaceId && seenLocations.has(p.googlePlaceId)) continue;
    if (p.googlePlaceId) seenLocations.add(p.googlePlaceId);
    const city = p.extraction!.city!.trim().toLocaleLowerCase();
    const match = groups.find(
      (g) =>
        g.length < 6 &&
        g[0].sample === p.sample &&
        g[0].extraction!.city!.trim().toLocaleLowerCase() === city &&
        g.every((other) => {
          const a = details[p.id],
            b = details[other.id];
          if (
            a?.latitude != null &&
            a.longitude != null &&
            b?.latitude != null &&
            b.longitude != null
          )
            return (
              distanceKm(
                { latitude: a.latitude, longitude: a.longitude },
                { latitude: b.latitude, longitude: b.longitude },
              ) <= 4
            );
          return true;
        }),
    );
    if (match) match.push(p);
    else groups.push([p]);
  }
  return groups.map((g) => {
    const city = g[0].extraction!.city!;
    const food = g.every((p) => ['Coffee', 'Food & drink'].includes(p.extraction!.category));
    const located = g.every((p) => details[p.id]?.latitude != null);
    const verifiedCount = g.filter((p) => !!p.googlePlaceId).length;
    return {
      id: g.map((p) => p.id).join(':'),
      city,
      title: food ? `${city} coffee & bites` : `A little day in ${city}`,
      placeIds: g.map((p) => p.id),
      reason: located
        ? `${g.length} saved ${g.length === 1 ? 'place' : 'places'}, within a 4 km cluster. Opening hours, routes, and budget are checked when you generate.`
        : `${g.length} ${g[0].sample ? 'sample' : 'saved'} ${g.length === 1 ? 'place' : 'places'} grouped by their saved city${food ? ' and food interests' : ''}. Exact distance and feasibility still need checking.`,
      image: g[0].image,
      sample: g[0].sample,
      verifiedCount,
    };
  });
}
