import { createAdminClient } from "@/lib/supabase/admin";
import AdminClient from "@/components/AdminClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = createAdminClient();
  
  // 1. 取得所有學生的進度資料
  const { data: progressList } = await admin
    .from("student_progress")
    .select("*");

  const progressMap = new Map<string, any>();
  progressList?.forEach((p) => {
    progressMap.set(p.user_id, p);
  });

  // 2. 從 Supabase Auth 完整撈取所有使用者
  let allAuthUsers: any[] = [];
  let page = 1;
  const perPage = 50;
  while (true) {
    const { data: res, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !res?.users || res.users.length === 0) break;
    allAuthUsers = allAuthUsers.concat(res.users);
    if (res.users.length < perPage) break;
    page++;
  }

  // 3. 組合清單：以 user_metadata 或 email 前綴作為正確的帳號顯示
  const users = allAuthUsers.map((u) => {
    const prog = progressMap.get(u.id) || {};
    const care = prog.care || {};
    const metadata = u.user_metadata || {};
    
    // 如果 metadata 有記錄自訂帳號，優先使用；否則取 email 的@前面部分
    const emailPrefix = u.email ? u.email.split("@")[0] : "";
    const username = metadata.username || metadata.name || emailPrefix || "user";
    const displayName = metadata.displayName || username.toUpperCase();
    
    // 判定角色
    const role = metadata.role || (username === "admin" || username === "wendy" ? "admin" : "student");

    return {
      id: u.id,
      email: username, // 讓前端顯示正確的帳號名稱
      fullEmail: u.email,
      displayName: displayName,
      role: role,
      points: prog.points ?? 0,
      unlockedCount: prog.unlocked_count ?? 0,
      feed: care.feed ?? (role === "admin" ? "-" : 3),
      broom: care.broom ?? (role === "admin" ? "-" : 3),
      diamonds: care.diamonds ?? (role === "admin" ? "-" : 0),
      mistakesCount: 0,
      testCount: Object.keys(care.weekScores || {}).length
    };
  });

  return (
    <main className="max-w-6xl mx-auto p-4 space-y-6">
      <AdminClient users={users} />
    </main>
  );
}