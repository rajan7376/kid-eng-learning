export interface Creature {
  emoji: string;
  name: string;
}

// 可愛的動物、昆蟲、海洋生物，依序解鎖收集
export const CREATURES: Creature[] = [
  { emoji: "🐶", name: "小狗" },
  { emoji: "🐱", name: "小貓" },
  { emoji: "🐰", name: "兔子" },
  { emoji: "🦊", name: "狐狸" },
  { emoji: "🐼", name: "貓熊" },
  { emoji: "🐨", name: "無尾熊" },
  { emoji: "🦁", name: "獅子" },
  { emoji: "🐯", name: "老虎" },
  { emoji: "🐵", name: "猴子" },
  { emoji: "🦒", name: "長頸鹿" },
  { emoji: "🦝", name: "浣熊" },
  { emoji: "🦦", name: "水獺" },
  { emoji: "🐝", name: "蜜蜂" },
  { emoji: "🐞", name: "瓢蟲" },
  { emoji: "🦋", name: "蝴蝶" },
  { emoji: "🐛", name: "毛毛蟲" },
  { emoji: "🐜", name: "螞蟻" },
  { emoji: "🦗", name: "蟋蟀" },
  { emoji: "🐠", name: "熱帶魚" },
  { emoji: "🐡", name: "河豚" },
  { emoji: "🐬", name: "海豚" },
  { emoji: "🐳", name: "鯨魚" },
  { emoji: "🐙", name: "章魚" },
  { emoji: "🦐", name: "小蝦" },
  { emoji: "🦀", name: "螃蟹" },
  { emoji: "🐢", name: "海龜" },
  { emoji: "🦭", name: "海豹" },
  { emoji: "🐚", name: "貝殼" },
];

export const POINTS_PER_CREATURE = 5;
export const CREATURE_COUNT = CREATURES.length;
