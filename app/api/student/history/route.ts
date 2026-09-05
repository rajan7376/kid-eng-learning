import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });
  
  const admin = createAdminClient();
  const { data } = await admin
    .from("test_history")
    .select("*")
    .eq("user_id", session.sub)
    .order("created_at", { ascending: false });
    
  return NextResponse.json({ history: data ?? [] });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });
  
  const { weekId, score, total } = await req.json();
  const admin = createAdminClient();
  const { data } = await admin
    .from("test_history")
    .insert({ user_id: session.sub, week_id: weekId || null, score, total })
    .select()
    .single();
    
  return NextResponse.json({ record: data });
}