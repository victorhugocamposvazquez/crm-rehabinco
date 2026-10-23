export type PunchType = "in" | "out" | "pause_start" | "pause_end";
export type PunchMode = "office" | "remote";
export type DayPhase = "out" | "working" | "paused";
export type CorrectionStatus = "pending" | "approved" | "rejected";

export type Punch = {
  id: string;
  user_id: string;
  type: PunchType;
  at: string;
  client_at?: string | null;
  mode: PunchMode;
  work_center_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  source: string;
  client_id?: string | null;
  superseded_by?: string | null;
  sequence_ok?: boolean;
};

export type WorkCenter = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius_m: number;
};

export type DayReplay = {
  phase: DayPhase;
  effectiveMs: number;
  pauseMs: number;
  openSince: string | null;
  lastPunch: Punch | null;
  events: Punch[];
  missingOut: boolean;
  overNineHours: boolean;
};
