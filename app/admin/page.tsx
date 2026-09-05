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

  // 3. 組合清單，維持原本的「帳號 (顯示名稱)」格式
  const users = allAuthUsers.map((u) => {
    const prog = progressMap.get(u.id) || {};
    const care = prog.care || {};
    
    // 解析帳號名稱 (如 admin, wendy, fifi)
    const rawEmail = u.email || "";
    const username = rawEmail.includes("@") ? rawEmail.split("@")[0] : rawEmail;
    const displayName = (u.user_metadata as any)?.displayName || username.toUpperCase();
    
    // 判定角色 (admin 或 wendy 為管理員，其餘為學生)
    const metadataRole = (u.user_metadata as any)?.role;
    const role = metadataRole || (username === "admin" || username === "wendy" ? "admin" : "student");

    return {
      id: u.id,
      email: rawEmail,
      username: username,
      displayName: displayName,
      role: role,
      points: prog.points ?? 0,
      unlockedCount: prog.unlocked_count ?? 0,
      feed: care.feed ?? 3,
      broom: care.broom ?? 3,
      diamonds: care.diamonds ?? 0,
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