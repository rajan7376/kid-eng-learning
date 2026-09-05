import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "無權限" }, { status: 403 });
  const admin = createAdminClient();
  const { data } = await admin.from("shop_items").select("*").order("price", { ascending: true });
  return NextResponse.json({ items: data ?? [] });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "無權限" }, { status: 403 });
  const { id, price } = await req.json();
  const admin = createAdminClient();
  await admin.from("shop_items").update({ price }).eq("id", id);
  return NextResponse.json({ ok: true });
}