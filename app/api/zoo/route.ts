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

  // ---- 單一動物園 ----
  if (userId) {
    const { data: owner } = await admin
      .from("app_users")
      .select("id, username, display_name, role")
      .eq("id", userId)
      .maybeSingle();
    if (!owner || owner.role !== "student")
      return NextResponse.json({ error: "找不到動物園" }, { status: 404 });

    const { data: prog } = await admin
      .from("student_progress")
      .select("unlocked_count, zoo_positions")
      .eq("user_id", userId)
      .maybeSingle();

    const { count: diamondCount } = await admin
      .from("zoo_diamonds")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", userId);

    const { data: mine } = await admin
      .from("zoo_diamonds")
      .select("liker_id")
      .eq("owner_id", userId)
      .eq("liker_id", session.sub)
      .maybeSingle();

    const { data: comments } = await admin
      .from("zoo_comments")
      .select("id, author_name, body, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      ownerId: userId,
      name: owner.display_name || owner.username,
      unlockedCount: prog?.unlocked_count ?? 0,
      zooPositions: prog?.zoo_positions ?? {},
      diamondCount: diamondCount ?? 0,
      likedByMe: !!mine,
      comments: comments ?? [],
    });
  }

  // ---- 動物園清單 ----
  const { data: students } = await admin
    .from("app_users")
    .select("id, username, display_name")
    .eq("role", "student");
  const { data: prog } = await admin
    .from("student_progress")
    .select("user_id, unlocked_count");
  const { data: diamonds } = await admin.from("zoo_diamonds").select("owner_id");

  const unlockedOf = new Map((prog ?? []).map((p) => [p.user_id, p.unlocked_count ?? 0]));
  const dCount = new Map<string, number>();
  (diamonds ?? []).forEach((d) =>
    dCount.set(d.owner_id, (dCount.get(d.owner_id) ?? 0) + 1),
  );

  return NextResponse.json({
    zoos: (students ?? [])
      .map((u) => ({
        userId: u.id,
        name: u.display_name || u.username,
        unlockedCount: unlockedOf.get(u.id) ?? 0,
        diamondCount: dCount.get(u.id) ?? 0,
        isMe: u.id === session.sub,
      }))
      .sort((a, b) => b.diamondCount - a.diamondCount),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { action, ownerId, body } = (await req.json().catch(() => ({}))) as {
    action?: "diamond" | "comment";
    ownerId?: string;
    body?: string;
  };
  if (!ownerId) return NextResponse.json({ error: "缺少 ownerId" }, { status: 400 });

  const admin = createAdminClient();

  if (action === "diamond") {
    const { data: exists } = await admin
      .from("zoo_diamonds")
      .select("liker_id")
      .eq("owner_id", ownerId)
      .eq("liker_id", session.sub)
      .maybeSingle();
    if (exists) {
      await admin
        .from("zoo_diamonds")
        .delete()
        .eq("owner_id", ownerId)
        .eq("liker_id", session.sub);
    } else {
      await admin
        .from("zoo_diamonds")
        .insert({ owner_id: ownerId, liker_id: session.sub });
    }
    const { count } = await admin
      .from("zoo_diamonds")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", ownerId);
    return NextResponse.json({ liked: !exists, count: count ?? 0 });
  }

  if (action === "comment") {
    const text = (body ?? "").trim().slice(0, 200);
    if (!text) return NextResponse.json({ error: "請輸入留言" }, { status: 400 });
    const { data } = await admin
      .from("zoo_comments")
      .insert({
        owner_id: ownerId,
        author_id: session.sub,
        author_name: session.name,
        body: text,
      })
      .select("id, author_name, body, created_at")
      .single();
    return NextResponse.json({ comment: data });
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
