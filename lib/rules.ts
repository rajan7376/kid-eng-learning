// 共用規則常數
export const MAX_WEEK_POINTS = 2; // 同一單字表測驗滿分最多累計點數
export const GRADUATE_DAYS = 30; // 錯字滿幾天可畢業
export const EXPIRE_DAYS = 37; // 超過幾天未畢業自動過期(30 + 7 緩衝)

// 台北時區今天 (YYYY-MM-DD)
export function taipeiToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

// 自某時間到今天的天數(以台北日期計)
export function ageDays(createdAt: string): number {
  const created = new Date(
    new Date(createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" }),
  );
  const today = new Date(taipeiToday());
  return Math.floor((today.getTime() - created.getTime()) / 86_400_000);
}
