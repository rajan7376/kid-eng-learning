import {
  CARE_AWAY,
  CARE_HUNGRY,
  CARE_ITEM_CAP,
  CARE_SICK,
  CARE_START_ITEMS,
  daysBetweenDates,
} from "./rules";

export interface CareRow {
  last_fed?: string | null;
  last_cleaned?: string | null;
  feed?: number;
  broom?: number;
  lastFeedEarned?: string | null;
  lastBroomEarned?: string | null;
}

export type CareStage = "ok" | "warn" | "sick" | "away";

export interface CareView {
  feed: number;
  broom: number;
  daysSinceFed: number;
  daysSinceCleaned: number;
  hungerStage: CareStage;
  messStage: CareStage;
  away: boolean;
  fedToday: boolean;
  cleanedToday: boolean;
}

// 確保 care 有合理初始值；首次擁有動物時給起始道具並把餵/掃日期設為今天
export function normalizeCare(
  raw: unknown,
  today: string,
  hasAnimals: boolean,
): { care: CareRow; changed: boolean } {
  const care: CareRow = { ...(raw as CareRow) };
  let changed = false;
  if (hasAnimals && !care.last_fed) {
    care.last_fed = today;
    care.last_cleaned = today;
    care.feed = care.feed ?? CARE_START_ITEMS;
    care.broom = care.broom ?? CARE_START_ITEMS;
    changed = true;
  }
  return { care, changed };
}

function stage(days: number): CareStage {
  if (days >= CARE_AWAY) return "away";
  if (days >= CARE_SICK) return "sick";
  if (days >= CARE_HUNGRY) return "warn";
  return "ok";
}

export function computeCareView(care: CareRow, today: string): CareView {
  const dsf = care.last_fed ? daysBetweenDates(care.last_fed, today) : 0;
  const dsc = care.last_cleaned ? daysBetweenDates(care.last_cleaned, today) : 0;
  return {
    feed: care.feed ?? 0,
    broom: care.broom ?? 0,
    daysSinceFed: dsf,
    daysSinceCleaned: dsc,
    hungerStage: stage(dsf),
    messStage: stage(dsc),
    away: Math.max(dsf, dsc) >= CARE_AWAY,
    fedToday: dsf === 0 && !!care.last_fed,
    cleanedToday: dsc === 0 && !!care.last_cleaned,
  };
}

// 每天第一次發飼料；回傳是否有變動
export function grantFeedDaily(care: CareRow, today: string): boolean {
  if (care.lastFeedEarned === today) return false;
  care.feed = Math.min(CARE_ITEM_CAP, (care.feed ?? 0) + 1);
  care.lastFeedEarned = today;
  return true;
}

export function grantBroomDaily(care: CareRow, today: string): boolean {
  if (care.lastBroomEarned === today) return false;
  care.broom = Math.min(CARE_ITEM_CAP, (care.broom ?? 0) + 1);
  care.lastBroomEarned = today;
  return true;
}

// 餵食 / 打掃；道具不足回傳 false
export function doFeed(care: CareRow, today: string): boolean {
  if ((care.feed ?? 0) < 1) return false;
  care.feed = (care.feed ?? 0) - 1;
  care.last_fed = today;
  return true;
}

export function doClean(care: CareRow, today: string): boolean {
  if ((care.broom ?? 0) < 1) return false;
  care.broom = (care.broom ?? 0) - 1;
  care.last_cleaned = today;
  return true;
}
