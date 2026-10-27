import type {
  GooglePlace,
  SavedPlace,
  ScheduleResult,
  ScheduledVisit,
  OpeningPoint,
} from '../library-types';
import { minutes, type PlanningPreferences } from '../planning';
import type { TravelMatrix } from './routes';
import { ServiceError } from './errors';
export interface PlanningCandidate {
  place: SavedPlace;
  details: GooglePlace;
  reason: string;
}
function dateMinute(point: OpeningPoint, date: string) {
  if (!point.date) return null;
  const selected = Date.parse(date + 'T00:00:00Z');
  return (
    (Date.UTC(point.date.year, point.date.month - 1, point.date.day) - selected) / 60000 +
    point.hour * 60 +
    point.minute
  );
}
export function openingWindows(
  candidate: PlanningCandidate,
  date: string,
  allowRegular = false,
): { windows: [number, number][]; regular: boolean } {
  const { place, details } = candidate;
  if (place.confirmedHours?.date === date) {
    const a = minutes(place.confirmedHours.start),
      b = minutes(place.confirmedHours.end);
    return { windows: b > a ? [[a, b]] : [], regular: false };
  }
  const day = new Date(date + 'T12:00:00Z').getUTCDay();
  const windows: [number, number][] = [];
  const current = details.currentPeriods;
  for (const p of current) {
    const start = dateMinute(p.open, date);
    const end = p.close ? dateMinute(p.close, date) : start == null ? null : start + 7 * 1440;
    if (start != null && end != null && start < 1440 && end > 0)
      windows.push([Math.max(0, start), Math.min(1440, end)]);
  }
  // A date-bounded current-hours response with no overlap means closed, not unknown.
  if (current.some((p) => p.open.date)) {
    const dates = current
      .flatMap((p) => [dateMinute(p.open, date), p.close ? dateMinute(p.close, date) : null])
      .filter((v): v is number => v != null);
    if (windows.length || (Math.min(...dates) <= 0 && Math.max(...dates) >= 1440))
      return { windows, regular: false };
  }
  const periods = details.periods;
  if (
    periods.length === 1 &&
    periods[0].open.day === 0 &&
    periods[0].open.hour === 0 &&
    periods[0].open.minute === 0 &&
    !periods[0].close
  ) {
    return { windows: allowRegular ? [[0, 1440]] : [], regular: true };
  }
  if (!allowRegular) return { windows: [], regular: false };
  for (const p of periods) {
    if (!p.close) continue;
    const start = (p.open.day - day) * 1440 + p.open.hour * 60 + p.open.minute;
    let end = (p.close.day - day) * 1440 + p.close.hour * 60 + p.close.minute;
    while (end <= start) end += 7 * 1440;
    for (const shift of [-10080, 0, 10080]) {
      const a = start + shift,
        b = end + shift;
      if (a < 1440 && b > 0) windows.push([Math.max(0, a), Math.min(1440, b)]);
    }
  }
  return { windows, regular: true };
}
export function solveSchedule(
  candidates: PlanningCandidate[],
  prefs: PlanningPreferences,
  travel: TravelMatrix,
  lockedIds: string[],
  fixedOrder?: string[],
  originIndex?: number,
): ScheduleResult {
  const start = minutes(prefs.time),
    end = minutes(prefs.endTime);
  if (end <= start)
    throw new ServiceError(
      'TIME_WINDOW',
      'The end time must be after the start time on the same day.',
      422,
      ['Choose a later end time or an earlier start.'],
    );
  if (end - start > 960)
    throw new ServiceError('TIME_WINDOW', 'Keep a single outing within a 16-hour window.', 422);
  if (new Set(candidates.map((c) => c.place.id)).size !== candidates.length)
    throw new ServiceError('DUPLICATE_PLACE', 'A plan cannot include the same place twice.');
  if (lockedIds.some((id) => !candidates.some((c) => c.place.id === id)))
    throw new ServiceError(
      'LOCKED_PLACE_MISSING',
      'A locked place is no longer in this library selection. Restore it or unlock it before generating.',
      422,
    );
  const windows = candidates.map((c) => openingWindows(c, prefs.date, prefs.allowRegularHours));
  const problems = new Map<string, string>();
  candidates.forEach((c, i) => {
    const name = c.place.extraction?.name || 'Saved place';
    if (!c.place.extraction?.durationMinutes)
      problems.set(c.place.id, `${name}: confirm an estimated visit duration.`);
    else if (
      c.details.businessStatus === 'CLOSED_PERMANENTLY' ||
      c.details.businessStatus === 'CLOSED_TEMPORARILY'
    )
      problems.set(c.place.id, `${name}: Google marks this business closed.`);
    else if (!windows[i].windows.length)
      problems.set(
        c.place.id,
        `${name}: no confirmed opening window for this date. Add a date-specific availability window, or explicitly allow regular hours as provisional estimates.`,
      );
    else if (!c.place.extraction.cost && !prefs.allowUnknownCosts)
      problems.set(
        c.place.id,
        `${name}: confirm a USD cost estimate, or explicitly allow unknown costs.`,
      );
    else if (c.place.extraction.cost && c.place.extraction.cost.currency.toUpperCase() !== 'USD')
      problems.set(
        c.place.id,
        `${name}: the supplied currency is not USD. Confirm a USD estimate before applying a USD budget.`,
      );
  });
  for (const id of lockedIds)
    if (problems.has(id))
      throw new ServiceError(
        'LOCKED_CONSTRAINT',
        `A must-visit stop cannot be scheduled. ${problems.get(id)}`,
        422,
        [
          'Correct the missing information, choose another date, extend your window, or unlock this stop.',
        ],
      );
  const limit = prefs.pace === 'Easygoing' ? 3 : prefs.pace === 'A little of everything' ? 4 : 6;
  if (lockedIds.length > limit)
    throw new ServiceError(
      'PACE_LOCK_CONFLICT',
      'The number of must-visit stops exceeds the selected pace.',
      422,
      ['Choose a fuller pace or unlock a stop.'],
    );
  let best: { visits: ScheduledVisit[]; cost: number; score: number } | null = null;
  const explore = (order: number[], visits: ScheduledVisit[], time: number, cost: number) => {
    const ids = order.map((i) => candidates[i].place.id);
    if (
      visits.length &&
      lockedIds.every((id) => ids.includes(id)) &&
      (!fixedOrder || ids.length === fixedOrder.length)
    ) {
      const score =
        visits.length * 10000 -
        order.reduce((n, i, pos) => n + i * (candidates.length - pos), 0) * 10 -
        (time - start);
      if (!best || score > best.score) best = { visits: [...visits], cost, score };
    }
    if (order.length >= limit) return;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (order.includes(i) || problems.has(c.place.id)) continue;
      if (fixedOrder && fixedOrder[order.length] !== c.place.id) continue;
      const lockAt = lockedIds.indexOf(c.place.id);
      if (lockAt >= 0 && lockedIds.slice(0, lockAt).some((id) => !ids.includes(id))) continue;
      const previous = order.length ? order[order.length - 1] : originIndex;
      const transit = previous == null ? 0 : (travel.minutes[previous]?.[i] ?? Infinity);
      if (!Number.isFinite(transit) || transit > 960) continue;
      const arrivalAtDoor = time + transit;
      const duration = c.place.extraction!.durationMinutes!;
      const nextCost = cost + (c.place.extraction!.cost?.amount ?? 0);
      if (nextCost > Number(prefs.budget)) continue;
      const window = windows[i].windows
        .slice()
        .sort((a, b) => a[0] - b[0])
        .find(([a, b]) => Math.max(arrivalAtDoor, a) + duration <= Math.min(b, end));
      if (!window) continue;
      const arrival = Math.max(arrivalAtDoor, window[0]),
        departure = arrival + duration;
      explore(
        [...order, i],
        [
          ...visits,
          {
            placeId: c.place.id,
            arrival,
            departure,
            travelMinutes: transit,
            waitMinutes: arrival - arrivalAtDoor,
            reason: c.reason,
          },
        ],
        departure,
        nextCost,
      );
    }
  };
  explore([], [], start, 0);
  if (!best)
    throw new ServiceError(
      'NO_FEASIBLE_PLAN',
      lockedIds.length
        ? 'The must-visit stops do not fit the time, opening hours, budget, and available routes.'
        : 'No saved activity fits the current time, opening hours, budget, and available routes.',
      422,
      [...problems.values()]
        .slice(0, 4)
        .concat([
          'Try another date, widen the time window, increase the budget, confirm missing details, or unlock a must-visit stop.',
        ]),
    );
  const result = best as { visits: ScheduledVisit[]; cost: number; score: number };
  const included = new Set(result.visits.map((v) => v.placeId));
  const selected = result.visits.map((v) => candidates.find((c) => c.place.id === v.placeId)!);
  const regular = result.visits.some(
    (v) => windows[candidates.findIndex((c) => c.place.id === v.placeId)].regular,
  );
  const unknown = selected.some((c) => !c.place.extraction!.cost);
  const provisional =
    travel.source === 'estimate' || prefs.transport === 'Public transit' || regular || unknown;
  return {
    visits: result.visits,
    omitted: candidates
      .filter((c) => !included.has(c.place.id))
      .map((c) => ({
        placeId: c.place.id,
        reason:
          problems.get(c.place.id) ||
          'Does not fit the selected pace, budget, opening windows, or travel time.',
      })),
    warnings: [
      ...travel.warnings,
      ...(regular
        ? [
            'Regular published opening hours are estimates for this date; special closures and holiday exceptions are not confirmed.',
          ]
        : []),
      ...(unknown ? ['Some costs are unknown. The total budget cannot be confirmed.'] : []),
    ],
    totalCost: unknown ? null : result.cost,
    quality: provisional ? 'provisional' : 'checked',
    travelSource: travel.source,
    generatedAt: new Date().toISOString(),
  };
}
