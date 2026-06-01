import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { positions } = (await req.json().catch(() => ({}))) as {
    positions?: Record<string, { x: number; y: number }>;
  };

  const admin = createAdminClient();
  await admin
    .from("student_progress")
    .upsert(
      { user_id: session.sub, zoo_positions: positions ?? {}, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  return NextResponse.json({ ok: true });
}
