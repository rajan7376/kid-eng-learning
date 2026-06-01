import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: "add" | "remove";
    card?: {
      id: string;
      english_word: string;
      word_meaning_zh: string | null;
      sentence: string | null;
      sentence_zh: string | null;
    };
    cardId?: string;
  };

  const admin = createAdminClient();

  if (body.action === "add" && body.card) {
    await admin.from("student_mistakes").upsert(
      {
        user_id: session.sub,
        card_id: body.card.id,
        english_word: body.card.english_word,
        word_meaning_zh: body.card.word_meaning_zh,
        sentence: body.card.sentence,
        sentence_zh: body.card.sentence_zh,
      },
      { onConflict: "user_id,card_id" },
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "remove" && body.cardId) {
    await admin
      .from("student_mistakes")
      .delete()
      .eq("user_id", session.sub)
      .eq("card_id", body.cardId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "參數錯誤" }, { status: 400 });
}
