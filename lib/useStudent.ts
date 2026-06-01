"use client";

import { useCallback, useEffect, useState } from "react";
import { CREATURES, type Creature } from "./creatures";

export interface MistakeCard {
  id: string;
  english_word: string;
  word_meaning_zh: string | null;
  sentence: string | null;
  sentence_zh: string | null;
}

export type ZooPositions = Record<string, { x: number; y: number }>;

export function useStudent() {
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState(0);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [zooPositions, setZooPositions] = useState<ZooPositions>({});
  const [mistakes, setMistakes] = useState<MistakeCard[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/student/state")
      .then((r) => r.json())
      .then((d) => {
        if (!active || d.error) return;
        setPoints(d.points ?? 0);
        setUnlockedCount(d.unlockedCount ?? 0);
        setZooPositions(d.zooPositions ?? {});
        setMistakes(d.mistakes ?? []);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // 加分；回傳這次新解鎖的生物
  const addPoints = useCallback(async (delta = 1): Promise<Creature[]> => {
    const res = await fetch("/api/student/points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta }),
    });
    const d = await res.json();
    if (d.error) return [];
    setPoints(d.points);
    setUnlockedCount(d.unlockedCount);
    return CREATURES.slice(d.prevUnlocked, d.unlockedCount);
  }, []);

  const saveZoo = useCallback((positions: ZooPositions) => {
    setZooPositions(positions);
    void fetch("/api/student/zoo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positions }),
    });
  }, []);

  const addMistake = useCallback((card: MistakeCard) => {
    setMistakes((prev) =>
      prev.some((m) => m.id === card.id) ? prev : [...prev, card],
    );
    void fetch("/api/student/mistakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", card }),
    });
  }, []);

  const removeMistake = useCallback((cardId: string) => {
    setMistakes((prev) => prev.filter((m) => m.id !== cardId));
    void fetch("/api/student/mistakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", cardId }),
    });
  }, []);

  const recordTest = useCallback(
    (weekId: string | null, score: number, total: number, kind: "quiz" | "boss") => {
      void fetch("/api/student/test-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekId, score, total, kind }),
      });
    },
    [],
  );

  return {
    loading,
    points,
    unlockedCount,
    zooPositions,
    mistakes,
    collection: CREATURES.slice(0, unlockedCount),
    addPoints,
    saveZoo,
    addMistake,
    removeMistake,
    recordTest,
  };
}
