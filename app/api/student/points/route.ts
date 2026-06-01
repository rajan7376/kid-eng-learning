import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";
import { CREATURE_COUNT, POINTS_PER_CREATURE } from "@/lib/creatures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { delta } = (await req.json().catch(() => ({}))) as { delta?: number };
  const add = Math.max(0, Math.min(Number(delta) || 0, 100));

  const admin = createAdminClient();
  await admin
    .from("student_progress")
    .upsert({ user_id: session.sub }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data: cur } = await admin
    .from("student_progress")
    .select("points, unlocked_count")
    .eq("user_id", session.sub)
    .maybeSingle();

  const prevUnlocked = cur?.unlocked_count ?? 0;
  const points = (cur?.points ?? 0) + add;
  const unlockedCount = Math.min(
    Math.floor(points / POINTS_PER_CREATURE),
    CREATURE_COUNT,
  );

  await admin
    .from("student_progress")
    .update({ points, unlocked_count: unlockedCount, updated_at: new Date().toISOString() })
    .eq("user_id", session.sub);

  return NextResponse.json({ points, unlockedCount, prevUnlocked });
}
