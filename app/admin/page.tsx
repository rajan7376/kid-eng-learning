import { createAdminClient } from "@/lib/supabase/admin";
import AdminClient from "@/components/AdminClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = createAdminClient();
  
  // 取得所有學生的進度資料
  const { data: students } = await admin
    .from("student_progress")
    .select("*")
    .order("updated_at", { ascending: false });

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-800">管理後台</h1>
      <AdminClient students={students ?? []} />
    </main>
  );
}