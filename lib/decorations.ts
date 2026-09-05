export interface Decoration {
  id: string;
  name: string;
  emoji: string;
  price: number;
}

export const DECORATIONS: Decoration[] = [
  { id: "fence_wood", name: "木柵欄", emoji: "🪵", price: 1 },
  { id: "tree_pine", name: "松樹", emoji: "🌲", price: 2 },
  { id: "tree_palm", name: "椰子樹", emoji: "🌴", price: 2 },
  { id: "fountain", name: "小噴泉", emoji: "⛲", price: 3 },
  { id: "tent", name: "小帳篷", emoji: "⛺", price: 5 },
  { id: "ferris_wheel", name: "摩天輪", emoji: "🎡", price: 10 },
];
