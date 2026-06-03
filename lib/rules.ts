// 共用規則常數
export const MAX_WEEK_POINTS = 2; // 同一單字表測驗滿分最多累計點數
export const GRADUATE_DAYS = 30; // 錯字滿幾天可畢業
export const EXPIRE_DAYS = 37; // 超過幾天未畢業自動過期(30 + 7 緩衝)

// 動物照顧：距上次餵食/打掃幾天的狀態門檻
export const CARE_HUNGRY = 3; // >= 餓/髒
export const CARE_SICK = 5; // >= 生病
export const CARE_AWAY = 7; // >= 離家出走
export const CARE_ITEM_CAP = 30; // 道具庫存上限
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
