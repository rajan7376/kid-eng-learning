import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/authServer";
import AdminClient from "@/components/AdminClient";
import type { ClassRow, WeekRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  const supabase = createClient();
  const { data: classes } = await supabase.from("classes").select("*").order("code");
  const { data: weeks } = await supabase
    .from("weeks")
    .select("*")
    .order("sort_order", { ascending: false });

  return (
    <AdminClient
      classes={(classes ?? []) as ClassRow[]}
      weeks={(weeks ?? []) as WeekRow[]}
    />
  );
}
