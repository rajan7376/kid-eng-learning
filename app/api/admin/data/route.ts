import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "admin")
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    op?: string;
    id?: string;
    values?: Record<string, unknown>;
  };
  const admin = createAdminClient();
  const { op, id, values } = body;

  switch (op) {
    case "updateCard": {
      if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
      const allowed = [
        "english_word",
        "part_of_speech",
        "word_meaning_zh",
        "sentence",
        "sentence_zh",
      ];
      const patch: Record<string, unknown> = {};
      for (const k of allowed)
        if (values && k in values) patch[k] = values[k];
      await admin.from("word_cards").update(patch).eq("id", id);
      return NextResponse.json({ ok: true });
    }
    case "deleteCard":
      await admin.from("word_cards").delete().eq("id", id!);
      return NextResponse.json({ ok: true });
    case "updateWeek":
      await admin
        .from("weeks")
        .update({
          week_label: values?.week_label,
          date_range: values?.date_range,
        })
        .eq("id", id!);
      return NextResponse.json({ ok: true });
    case "deleteWeek":
      await admin.from("weeks").delete().eq("id", id!);
      return NextResponse.json({ ok: true });
    case "updateClass":
      await admin
        .from("classes")
        .update({ code: values?.code, name: values?.name })
        .eq("id", id!);
      return NextResponse.json({ ok: true });
    case "deleteClass":
      await admin.from("classes").delete().eq("id", id!);
      return NextResponse.json({ ok: true });
    default:
      return NextResponse.json({ error: "未知操作" }, { status: 400 });
  }
}
