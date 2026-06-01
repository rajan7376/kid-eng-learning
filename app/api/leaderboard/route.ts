import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Entry {
  userId: string;
  name: string;
  value: number;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const admin = createAdminClient();

  const { data: students } = await admin
    .from("app_users")
    .select("id, username, display_name")
    .eq("role", "student");
  const nameOf = new Map(
    (students ?? []).map((u) => [u.id, u.display_name || u.username]),
  );
  const ids = new Set((students ?? []).map((u) => u.id));

  const { data: progress } = await admin
    .from("student_progress")
    .select("user_id, points, unlocked_count");
  const { data: tests } = await admin
    .from("test_results")
    .select("user_id, kind");

  const quizCount = new Map<string, number>();
  const bossCount = new Map<string, number>();
  (tests ?? []).forEach((t) => {
    if (!ids.has(t.user_id)) return;
    const m = t.kind === "boss" ? bossCount : quizCount;
    m.set(t.user_id, (m.get(t.user_id) ?? 0) + 1);
  });

  const top = (m: Map<string, number>): Entry[] =>
    [...m.entries()]
      .filter(([id]) => ids.has(id))
      .map(([userId, value]) => ({ userId, name: nameOf.get(userId) ?? "?", value }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

  const points = new Map<string, number>();
  const unlocked = new Map<string, number>();
  (progress ?? []).forEach((p) => {
    if (!ids.has(p.user_id)) return;
    points.set(p.user_id, p.points ?? 0);
    unlocked.set(p.user_id, p.unlocked_count ?? 0);
  });

  return NextResponse.json({
    points: top(points),
    unlocked: top(unlocked),
    quiz: top(quizCount),
    boss: top(bossCount),
    me: session.sub,
  });
}
