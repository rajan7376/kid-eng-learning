import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { petId, name, addIntimacy } = await req.json();

  const admin = createAdminClient();
  const { data: progress } = await admin
    .from("student_progress")
    .select("care")
    .eq("user_id", session.sub)
    .single();

  if (!progress) return NextResponse.json({ error: "找不到資料" }, { status: 404 });

  const care = progress.care || {};
  const petsInfo = care.petsInfo || {};
  
  const currentPet = petsInfo[petId] || { name: "", intimacy: 0 };
  
  if (name !== undefined) currentPet.name = name;
  if (addIntimacy) currentPet.intimacy += addIntimacy;

  petsInfo[petId] = currentPet;
  care.petsInfo = petsInfo;

  await admin
    .from("student_progress")
    .update({ care, updated_at: new Date().toISOString() })
    .eq("user_id", session.sub);

  return NextResponse.json({ ok: true, care });
}