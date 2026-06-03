// 共用規則常數
export const MAX_WEEK_POINTS = 2; // 同一單字表測驗滿分最多累計點數
export const GRADUATE_DAYS = 30; // 錯字滿幾天可畢業
export const EXPIRE_DAYS = 37; // 超過幾天未畢業自動過期(30 + 7 緩衝)

// 動物照顧 —— 餵食(以天計)
export const FEED_WARN = 3; // >= 需照顧
export const FEED_SICK = 5; // >= 生病
export const FEED_AWAY = 7; // >= 離家出走

// 動物照顧 —— 清潔(以大便數計，每 POOP_HOURS 小時長 1 個)
export const POOP_HOURS = 12;
export const POOP_WARN = 3; // >= 需照顧 (1.5 天)
export const POOP_SICK = 6; // >= 生病   (3 天)
export const POOP_AWAY = 14; // >= 離家   (7 天，與餵食對齊)
export const POOP_MAX_RENDER = 10; // 畫面最多畫幾坨

export const CARE_ITEM_CAP = 5; // 道具庫存上限(最多存 5 天緩衝，避免囤積)
export const CARE_START_ITEMS = 3; // 初次贈送道具數

// 台北時區今天 (YYYY-MM-DD)
export function taipeiToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

// 兩個 YYYY-MM-DD 日期相差天數(to - from)
export function daysBetweenDates(from: string, to: string): number {
  return Math.floor(
    (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000,
  );
}

// 自某時間到今天的天數(以台北日期計)
export function ageDays(createdAt: string): number {
  const created = new Date(
    new Date(createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" }),
  );
  const today = new Date(taipeiToday());
  return Math.floor((today.getTime() - created.getTime()) / 86_400_000);
}
