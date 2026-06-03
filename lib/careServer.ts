import {
  CARE_ITEM_CAP,
  CARE_START_ITEMS,
  FEED_AWAY,
  FEED_SICK,
  FEED_WARN,
  POOP_AWAY,
  POOP_HOURS,
  POOP_SICK,
  POOP_WARN,
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
  poopCount: number;
  hungerStage: CareStage;
  messStage: CareStage;
  away: boolean;
  fedToday: boolean;
  cleanedToday: boolean;
}

// 確保 care 有合理初始值；首次擁有動物時給起始道具並把餵/掃時間設為現在
export function normalizeCare(
  raw: unknown,
  today: string,
  hasAnimals: boolean,
): { care: CareRow; changed: boolean } {
  const care: CareRow = { ...(raw as CareRow) };
  let changed = false;
  if (hasAnimals && !care.last_fed) {
    care.last_fed = today; // 餵食以「天」計，存日期
    care.last_cleaned = new Date().toISOString(); // 清潔以「12 小時」計，存時間戳
    care.feed = care.feed ?? CARE_START_ITEMS;
    care.broom = care.broom ?? CARE_START_ITEMS;
    changed = true;
  }
  return { care, changed };
}

function feedStage(days: number): CareStage {
  if (days >= FEED_AWAY) return "away";
  if (days >= FEED_SICK) return "sick";
  if (days >= FEED_WARN) return "warn";
  return "ok";
}

function poopStage(poops: number): CareStage {
  if (poops >= POOP_AWAY) return "away";
  if (poops >= POOP_SICK) return "sick";
  if (poops >= POOP_WARN) return "warn";
  return "ok";
}

function tpeDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

export function computeCareView(care: CareRow, today: string): CareView {
  const dsf = care.last_fed ? daysBetweenDates(care.last_fed, today) : 0;
  const poopCount = care.last_cleaned
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(care.last_cleaned).getTime()) /
            (POOP_HOURS * 3_600_000),
        ),
      )
    : 0;
  const hungerStage = feedStage(dsf);
  const messStage = poopStage(poopCount);
  return {
    feed: care.feed ?? 0,
    broom: care.broom ?? 0,
    daysSinceFed: dsf,
    poopCount,
    hungerStage,
    messStage,
    away: hungerStage === "away" || messStage === "away",
    fedToday: dsf === 0 && !!care.last_fed,
    cleanedToday: !!care.last_cleaned && tpeDate(care.last_cleaned) === today,
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

export function doClean(care: CareRow, _today: string): boolean {
  if ((care.broom ?? 0) < 1) return false;
  care.broom = (care.broom ?? 0) - 1;
  care.last_cleaned = new Date().toISOString(); // 清光所有大便
  return true;
}
