import React from "react";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 在例句中把目標單字/片語標成紅字 */
export function highlightWord(
  sentence: string | null,
  word: string,
): React.ReactNode {
  if (!sentence) return null;
  if (!word) return sentence;
  const re = new RegExp(`(${escapeRegExp(word.trim())})`, "ig");
  const parts = sentence.split(re);
  return parts.map((p, i) =>
    p.toLowerCase() === word.trim().toLowerCase() ? (
      <span key={i} className="highlight-word">
        {p}
      </span>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    ),
  );
}
