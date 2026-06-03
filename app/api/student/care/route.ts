import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";
import { taipeiToday } from "@/lib/rules";
import {
  computeCareView,
  doClean,
  doFeed,
  normalizeCare,
  type CareRow,
} from "@/lib/careServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { action } = (await req.json().catch(() => ({}))) as {
    action?: "feed" | "clean";
  };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("student_progress")
    .select("care, unlocked_count")
    .eq("user_id", session.sub)
    .maybeSingle();

  const today = taipeiToday();
  const hasAnimals = (row?.unlocked_count ?? 0) > 0;
  const { care } = normalizeCare(row?.care ?? {}, today, hasAnimals);

  let ok = false;
  if (action === "feed") ok = doFeed(care as CareRow, today);
  else if (action === "clean") ok = doClean(care as CareRow, today);
  else return NextResponse.json({ error: "參數錯誤" }, { status: 400 });

  if (!ok) {
    return NextResponse.json(
      { error: action === "feed" ? "沒有飼料了" : "沒有掃把了", care: computeCareView(care, today) },
      { status: 409 },
    );
  }

  await admin
    .from("student_progress")
    .update({ care, updated_at: new Date().toISOString() })
    .eq("user_id", session.sub);

  return NextResponse.json({ ok: true, care: computeCareView(care, today) });
}
