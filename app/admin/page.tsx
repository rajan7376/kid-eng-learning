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

  // 2. 從 Supabase Auth 取得所有使用者與角色清單
  const { data: authUsers } = await admin.auth.admin.listUsers();
  
  const users = (authUsers?.users ?? []).map((u) => {
    const prog = progressMap.get(u.id) || {};
    const care = prog.care || {};
    return {
      id: u.id,
      email: u.email || "未命名",
      role: (u.user_metadata as any)?.role || "student",
      displayName: (u.user_metadata as any)?.displayName || "",
      points: prog.points ?? 0,
      unlockedCount: prog.unlocked_count ?? 0,
      feed: care.feed ?? 3,
      broom: care.broom ?? 3,
      diamonds: care.diamonds ?? 0,
      mistakesCount: 0, // 可依需求對應
      testCount: Object.keys(care.weekScores || {}).length
    };
  });

  return (
    <main className="max-w-6xl mx-auto p-4 space-y-6">
      <AdminClient users={users} />
    </main>
  );
}