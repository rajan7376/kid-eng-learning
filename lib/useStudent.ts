"use client";

import { useCallback, useEffect, useState } from "react";
import { CREATURES, type Creature } from "./creatures";
import type { CareView } from "./careServer";

export type { CareView };

export interface MistakeCard {
  id: string;
  english_word: string;
  word_meaning_zh: string | null;
  sentence: string | null;
  sentence_zh: string | null;
  reviewedToday?: boolean;
  due?: boolean; // 已滿天數可畢業
  daysLeft?: number;
}

export interface QuizResult {
  awarded: number;
  capReached: boolean;
  newly: Creature[];
  diamondAwarded?: boolean;
}

export type ZooPositions = Record<string, { x: number; y: number }>;

export function useStudent() {
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState(0);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [zooPositions, setZooPositions] = useState<ZooPositions>({});
  const [mistakes, setMistakes] = useState<MistakeCard[]>([]);
  const [care, setCare] = useState<CareView | null>(null);

  const [diamonds, setDiamonds] = useState(0);
  const [inventory, setInventory] = useState<Record<string, number>>({});

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
        setCare(d.care ?? null);
        
        if (d.care) {
          setDiamonds(d.care.diamonds || 0);
          setInventory(d.care.inventory || {});
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const completeQuiz = useCallback(
    async (
      weekId: string | null,
      score: number,
      total: number,
    ): Promise<QuizResult> => {
      const res = await fetch("/api/student/quiz-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekId, score, total }),
      });
      const d = await res.json();
      if (d.error) return { awarded: 0, capReached: false, newly: [] };
      setPoints(d.points);
      setUnlockedCount(d.unlockedCount);
      if (d.care) setCare(d.care);
      if (d.currentDiamonds !== undefined) setDiamonds(d.currentDiamonds);
      
      return {
        awarded: d.awarded,
        capReached: d.capReached,
        newly: CREATURES.slice(d.prevUnlocked, d.unlockedCount),
        diamondAwarded: d.diamondAwarded
      };
    },
    [],
  );

  const buyDecoration = useCallback(async (itemId: string) => {
    const res = await fetch("/api/student/shop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    const d = await res.json();
    if (d.error) return { ok: false, error: d.error };
    
    setDiamonds(d.currentDiamonds);
    setInventory(d.inventory);
    return { ok: true };
  }, []);

  const reviewMistake = useCallback(
    async (
      cardId: string,
      correct: boolean,
    ): Promise<{ graduated: boolean; newly: Creature[] }> => {
      const res = await fetch("/api/student/mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review", cardId, correct }),
      });
      const d = await res.json();
      if (d.care) setCare(d.care);
      if (d.graduated) {
        setMistakes((prev) => prev.filter((m) => m.id !== cardId));
        setPoints(d.points);
        setUnlockedCount(d.unlockedCount);
        return { graduated: true, newly: CREATURES.slice(d.prevUnlocked, d.unlockedCount) };
      }
      setMistakes((prev) =>
        prev.map((m) => (m.id === cardId ? { ...m, reviewedToday: true } : m)),
      );
      return { graduated: false, newly: [] };
    },
    [],
  );

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
      prev.some((m) => m.id === card.id)
        ? prev
        : [...prev, { ...card, reviewedToday: false, due: false, daysLeft: 30 }],
    );
    void fetch("/api/student/mistakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        card: {
          id: card.id,
          english_word: card.english_word,
          word_meaning_zh: card.word_meaning_zh,
          sentence: card.sentence,
          sentence_zh: card.sentence_zh,
        },
      }),
    });
  }, []);

  const careAction = useCallback(
    async (action: "feed" | "clean"): Promise<{ ok: boolean; error?: string }> => {
      const res = await fetch("/api/student/care", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (d.care) setCare(d.care);
      return { ok: !!d.ok, error: d.error };
    },
    [],
  );
  const feedPets = useCallback(() => careAction("feed"), [careAction]);
  const cleanPets = useCallback(() => careAction("clean"), [careAction]);

  const removeMistake = useCallback((cardId: string) => {
    setMistakes((prev) => prev.filter((m) => m.id !== cardId));
    void fetch("/api/student/mistakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", cardId }),
    });
  }, []);

  return {
    loading,
    points,
    unlockedCount,
    zooPositions,
    mistakes,
    care,
    diamonds,
    inventory,
    collection: CREATURES.slice(0, unlockedCount),
    completeQuiz,
    buyDecoration,
    reviewMistake,
    feedPets,
    cleanPets,
    saveZoo,
    addMistake,
    removeMistake,
  };
}
