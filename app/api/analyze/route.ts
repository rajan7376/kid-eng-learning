import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";
import { extractHandout, inlinePart, textPart } from "@/lib/gemini";
import type { Part } from "@google/generative-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function normalizeClassCode(raw: string): string {
  // 從 "Shiny (3A)" / "4A_" / "4A" 取出像 3A / 4B 的代碼
  const m = raw.match(/(\d+\s*[A-Za-z])/);
  return (m ? m[1] : raw).replace(/\s+/g, "").toUpperCase();
}

function normalizeWeekLabel(raw: string): string {
  const m = raw.match(/(\d+)/);
  return m ? `W${m[1]}` : raw.trim();
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "parent")) {
    return NextResponse.json({ error: "需要管理員或家長權限" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少檔案" }, { status: 400 });
  }

  const admin = createAdminClient();
  const bytes = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  const mime = file.type || "application/octet-stream";
  const isDocx = name.endsWith(".docx") || name.endsWith(".doc");

  // 1) 存原始檔到 handouts (私有)
  const filePath = `${session.sub}/${Date.now()}-${file.name}`;
  await admin.storage
    .from("handouts")
    .upload(filePath, bytes, { contentType: mime, upsert: false });

  const { data: uploadRow } = await admin
    .from("uploads")
    .insert({
      owner_id: session.sub,
      file_path: filePath,
      mime_type: mime,
      status: "processing",
    })
    .select()
    .single();

  try {
    // 2) 組 Gemini parts：docx 先抽文字，其餘(圖片/PDF)直接送
    let parts: Part[];
    if (isDocx) {
      const mammoth = (await import("mammoth")).default;
      const { value } = await mammoth.extractRawText({ buffer: bytes });
      parts = [textPart(value)];
    } else {
      const m = name.endsWith(".pdf")
        ? "application/pdf"
        : name.endsWith(".png")
          ? "image/png"
          : "image/jpeg";
      parts = [inlinePart(bytes.toString("base64"), m)];
    }

    // 3) Gemini 結構化抽取
    const handout = await extractHandout(parts);
    const classCode = normalizeClassCode(handout.class_code || "");
    const weekLabel = normalizeWeekLabel(handout.week_label || "");
    if (!classCode || !weekLabel) {
      throw new Error("無法辨識班級或週次，請確認講義內容");
    }

    // 4) upsert class (依代碼，全站共用)
    let { data: cls } = await admin
      .from("classes")
      .select("id")
      .eq("code", classCode)
      .maybeSingle();
    if (!cls) {
      const ins = await admin
        .from("classes")
        .insert({ owner_id: session.sub, code: classCode })
        .select("id")
        .single();
      cls = ins.data;
    }

    // 5) upsert week
    const weekSort = parseInt(weekLabel.replace(/\D/g, "") || "0", 10);
    let { data: wk } = await admin
      .from("weeks")
      .select("id")
      .eq("class_id", cls!.id)
      .eq("week_label", weekLabel)
      .maybeSingle();
    if (!wk) {
      const ins = await admin
        .from("weeks")
        .insert({
          class_id: cls!.id,
          week_label: weekLabel,
          date_range: handout.date_range ?? null,
          sort_order: weekSort,
        })
        .select("id")
        .single();
      wk = ins.data;
    } else {
      await admin
        .from("weeks")
        .update({ date_range: handout.date_range ?? null, sort_order: weekSort })
        .eq("id", wk.id);
    }

    // 6) 重新上傳同一週 -> 先清掉舊卡片再寫入
    await admin.from("word_cards").delete().eq("week_id", wk!.id);
    const rows = handout.cards.map((c, i) => ({
      week_id: wk!.id,
      sort_order: i + 1,
      english_word: c.english_word,
      part_of_speech: c.part_of_speech ?? null,
      word_meaning_zh: c.word_meaning_zh ?? null,
      sentence: c.sentence ?? null,
      sentence_zh: c.sentence_zh ?? null,
    }));
    if (rows.length) await admin.from("word_cards").insert(rows);

    if (uploadRow) {
      await admin
        .from("uploads")
        .update({ status: "done", week_id: wk!.id })
        .eq("id", uploadRow.id);
    }

    return NextResponse.json({
      ok: true,
      handout: { ...handout, class_code: classCode, week_label: weekLabel },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "分析失敗";
    if (uploadRow) {
      await admin
        .from("uploads")
        .update({ status: "error", error: message })
        .eq("id", uploadRow.id);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
