import { createAdminClient } from "@/lib/supabase/admin";
import AdminClient from "@/components/AdminClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = createAdminClient();
  
  // 1. 從 public.app_users 取得所有帳號資料
  const { data: appUsers, error: userError } = await admin
    .from("app_users")
    .select("id, username, role, display_name");

  if (userError) {
    console.error("讀取 app_users 失敗:", userError.message);
  }

  // 2. 取得所有學生的進度資料
  const { data: progressList } = await admin
    .from("student_progress")
    .select("*");

  const progressMap = new Map<string, any>();
  progressList?.forEach((p) => {
    progressMap.set(p.user_id, p);
  });

  // 3. 組合清單
  const users = (appUsers ?? []).map((u) => {
    const prog = progressMap.get(u.id) || {};
    const care = prog.care || {};
    const isAdmin = u.role === "admin";

    return {
      id: u.id,
      email: u.username, // 讓前端表格的「帳號」欄位顯示 username (如 wendy, fifi)
      displayName: u.display_name || "",
      role: u.role || "student",
      points: isAdmin ? "-" : (prog.points ?? 0),
      unlockedCount: isAdmin ? "-" : (prog.unlocked_count ?? 0),
      feed: isAdmin ? "-" : (care.feed ?? 3),
      broom: isAdmin ? "-" : (care.broom ?? 3),
      diamonds: isAdmin ? "-" : (care.diamonds ?? 0),
      mistakesCount: 0,
      testCount: isAdmin ? "-" : Object.keys(care.weekScores || {}).length
    };
  });

  return (
    <main className="max-w-6xl mx-auto p-4 space-y-6">
      <AdminClient users={users} />
    </main>
  );
}