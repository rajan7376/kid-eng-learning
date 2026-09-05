import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";
import { DECORATIONS } from "@/lib/decorations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "student") {
    return NextResponse.json({ error: "需要學生權限" }, { status: 403 });
  }

  const { itemId } = await req.json();
  if (!itemId) {
    return NextResponse.json({ error: "缺少商品 ID" }, { status: 400 });
  }

  const item = DECORATIONS.find(d => d.id === itemId);
  if (!item) {
    return NextResponse.json({ error: "找不到該商品" }, { status: 404 });
  }

  const userId = session.sub;
  const admin = createAdminClient();

  const { data: progress } = await admin
    .from("student_progress")
    .select("*")
    .eq("user_id", userId)
    .single();

  let care = progress?.care ? { ...progress.care } : {};
  let diamonds = care.diamonds || 0;

  if (diamonds < item.price) {
    return NextResponse.json({ error: "鑽石不足" }, { status: 400 });
  }

  // 扣除鑽石並加入庫存
  care.diamonds = diamonds - item.price;
  if (!care.inventory) care.inventory = {};
  care.inventory[itemId] = (care.inventory[itemId] || 0) + 1;

  const { error } = await admin
    .from("student_progress")
    .update({ care })
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    currentDiamonds: care.diamonds,
    inventory: care.inventory
  });
}
