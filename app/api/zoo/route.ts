import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const admin = createAdminClient();
  const userId = new URL(req.url).searchParams.get("userId");

  if (userId) {
    const { data: owner } = await admin.from("app_users").select("id, username, display_name, role").eq("id", userId).maybeSingle();
    if (!owner || owner.role !== "student") return NextResponse.json({ error: "找不到動物園" }, { status: 404 });

    const { data: prog } = await admin.from("student_progress").select("unlocked_count, zoo_positions, care").eq("user_id", userId).maybeSingle();
    const { data: comments } = await admin.from("zoo_comments").select("id, author_name, body, created_at").eq("owner_id", userId).order("created_at", { ascending: true });

    const careData = prog?.care as { diamonds?: number } | null;
    return NextResponse.json({
      ownerId: userId,
      name: owner.display_name || owner.username,
      unlockedCount: prog?.unlocked_count ?? 0,
      zooPositions: prog?.zoo_positions ?? {},
      diamondCount: careData?.diamonds ?? 0,
      comments: comments ?? [],
    });
  }

  const { data: students } = await admin.from("app_users").select("id, username, display_name").eq("role", "student");
  const { data: prog } = await admin.from("student_progress").select("user_id, unlocked_count, care");

  const unlockedOf = new Map();
  const dCount = new Map<string, number>();

  (prog ?? []).forEach((p) => {
    unlockedOf.set(p.user_id, p.unlocked_count ?? 0);
    const careData = p.care as { diamonds?: number } | null;
    dCount.set(p.user_id, careData?.diamonds ?? 0);
  });

  return NextResponse.json({
    zoos: (students ?? []).map((u) => ({
      userId: u.id,
      name: u.display_name || u.username,
      unlockedCount: unlockedOf.get(u.id) ?? 0,
      diamondCount: dCount.get(u.id) ?? 0,
      isMe: u.id === session.sub,
    })).sort((a, b) => b.diamondCount - a.diamondCount),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { action, ownerId, body } = (await req.json().catch(() => ({}))) as { action?: "comment"; ownerId?: string; body?: string; };
  if (!ownerId) return NextResponse.json({ error: "缺少 ownerId" }, { status: 400 });

  const admin = createAdminClient();

  if (action === "comment") {
    const text = (body ?? "").trim().slice(0, 200);
    if (!text) return NextResponse.json({ error: "請輸入留言" }, { status: 400 });
    const { data } = await admin.from("zoo_comments").insert({
      owner_id: ownerId, author_id: session.sub, author_name: session.name, body: text,
    }).select("id, author_name, body, created_at").single();
    return NextResponse.json({ comment: data });
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}