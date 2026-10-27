import type { ScheduleResult } from './library-types';
export interface Video {
  placeId?: string;
  id: string;
  title: string;
  creator: string;
  category: 'Food & drink' | 'Things to do';
  image: string;
  sourceUrl: string;
  neighborhood: string;
  duration: number;
  cost: number;
  sample: boolean;
}
export interface Preferences {
  endTime?: string;
  startingLocation?: string;
  allowUnknownCosts?: boolean;
  allowRegularHours?: boolean;
  city: string;
  date: string;
  time: string;
  budget: string;
  transport: 'Walking' | 'Public transit' | 'Driving';
  pace: 'Easygoing' | 'A little of everything' | 'Pack it in';
}
export interface Stop {
  id: string;
  videoId: string;
  locked: boolean;
  votes: string[];
}
export interface Member {
  id: string;
  name: string;
  initials: string;
  color: string;
  role: 'Host' | 'Member';
}
export interface Plan {
  placeIds?: string[];
  mode?: 'live' | 'sample';
  schedule?: ScheduleResult;
  planningExplanation?: string;
  scheduleStale?: boolean;
  sample?: boolean;
  id: string;
  name: string;
  description: string;
  image: string;
  status: 'Draft' | 'Ready to go';
  preferences: Preferences;
  videos: Video[];
  stops: Stop[];
  members: Member[];
  createdAt: string;
}
export interface PlanRepository {
  load(): Promise<Plan[]>;
  save(plans: Plan[]): Promise<void>;
}
export interface ItineraryService {
  generate(input: {
    videos: Video[];
    preferences: Preferences;
    existingStops: Stop[];
  }): Promise<Stop[]>;
}
