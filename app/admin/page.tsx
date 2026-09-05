import { createAdminClient } from "@/lib/supabase/admin";
import AdminClient from "@/components/AdminClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = createAdminClient();
  
  // 1. 取得所有學生的進度資料
  const { data: students } = await admin
    .from("student_progress")
    .select("*")
    .order("updated_at", { ascending: false });

  // 2. 從 Supabase Auth 取得所有使用者清單以對應帳號 (Email)
  const { data: authUsers } = await admin.auth.admin.listUsers();
  const emailMap = new Map<string, string>();
  authUsers?.users?.forEach((u) => {
    if (u.id && u.email) {
      emailMap.set(u.id, u.email);
    }
  });

  // 3. 將 email 結合進學生資料
  const studentsWithEmail = (students ?? []).map((s) => ({
    ...s,
    email: emailMap.get(s.user_id) || s.user_id.substring(0, 12) + "..."
  }));

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-800">管理後台</h1>
      <AdminClient students={studentsWithEmail} />
    </main>
  );
}