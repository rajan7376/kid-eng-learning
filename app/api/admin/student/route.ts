import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";
import { CREATURE_COUNT, POINTS_PER_CREATURE } from "@/lib/creatures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "admin")
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });

  const { op, userId, points, unlockedCount, count } = (await req
    .json()
    .catch(() => ({}))) as {
    op?: string;
    userId?: string;
    points?: number;
    unlockedCount?: number;
    count?: number;
  };
  if (!userId) return NextResponse.json({ error: "缺少 userId" }, { status: 400 });

  const admin = createAdminClient();

  if (op === "setProgress") {
    const p = Math.max(0, Math.floor(Number(points) || 0));
    const u =
      unlockedCount === undefined
        ? Math.min(Math.floor(p / POINTS_PER_CREATURE), CREATURE_COUNT)
        : Math.max(0, Math.min(Math.floor(Number(unlockedCount)), CREATURE_COUNT));
    await admin.from("student_progress").upsert(
      {
        user_id: userId,
        points: p,
        unlocked_count: u,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    return NextResponse.json({ ok: true, points: p, unlockedCount: u });
  }

  if (op === "clearMistakes") {
    await admin.from("student_mistakes").delete().eq("user_id", userId);
    return NextResponse.json({ ok: true });
  }

  if (op === "setTestCount") {
    const target = Math.max(0, Math.floor(Number(count) || 0));
    const { data: rows } = await admin
      .from("test_results")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", "quiz")
      .order("created_at", { ascending: true });
    const cur = rows?.length ?? 0;
    if (target > cur) {
      const toAdd = Array.from({ length: target - cur }, () => ({
        user_id: userId,
        kind: "quiz",
        score: 0,
        total: 0,
      }));
      await admin.from("test_results").insert(toAdd);
    } else if (target < cur && rows) {
      const toDelete = rows.slice(0, cur - target).map((r) => r.id);
      await admin.from("test_results").delete().in("id", toDelete);
    }
    return NextResponse.json({ ok: true, count: target });
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
