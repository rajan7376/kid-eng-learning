import { createClient } from "@/lib/supabase/server";
import StudyClient from "@/components/StudyClient";
import type { ClassRow, WeekRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StudyPage() {
  const supabase = createClient();
  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .order("code");
  const { data: weeks } = await supabase
    .from("weeks")
    .select("*")
    .order("sort_order", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand mb-4">單字學習</h1>
      <StudyClient
        classes={(classes ?? []) as ClassRow[]}
        weeks={(weeks ?? []) as WeekRow[]}
      />
    </div>
  );
}
