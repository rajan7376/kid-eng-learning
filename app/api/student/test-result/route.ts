import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { weekId, score, total, kind } = (await req.json().catch(() => ({}))) as {
    weekId?: string | null;
    score?: number;
    total?: number;
    kind?: "quiz" | "boss";
  };

  const admin = createAdminClient();
  await admin.from("test_results").insert({
    user_id: session.sub,
    week_id: weekId ?? null,
    score: Number(score) || 0,
    total: Number(total) || 0,
    kind: kind === "boss" ? "boss" : "quiz",
  });

  return NextResponse.json({ ok: true });
}
