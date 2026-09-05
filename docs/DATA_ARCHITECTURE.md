# 單字動物王國 — 資料架構總整理

> 專案路徑：`C:\Users\chunchic\Projects\KidEngLearing`  
> 用途：給 Gemini / 其他 AI 接續開發時的完整 context。  
> 最後整理：2026-09-05

---

## 1. 專案概述

**兒童美語互動單字本**（品牌名：單字動物王國）。家長/管理員上傳「親師小語」週報講義 → Gemini 結構化抽取單字卡 → 學生登入後學習、聽力測驗、收集動物、動物園社群。

| 層 | 技術 |
|---|---|
| 前端 | Next.js 14 App Router + TypeScript + Tailwind |
| 資料庫 | Supabase Postgres |
| 檔案 | Supabase Storage（講義私有、語音公開） |
| 驗證 | **自建** bcrypt + JWT cookie（非 Supabase Auth） |
| AI 抽取 | Google Gemini Flash（多模態 JSON mode） |
| AI 教學 | Gemini 生成 `teach_tip` 快取於卡片 |
| TTS | Azure Neural → Edge TTS 降級 → 瀏覽器 Web Speech |

---

## 2. 實體關係（ER）

```
app_users (自建帳號)
  ├── student_progress (1:1) — 點數/動物/動物園位置/照顧狀態
  ├── student_mistakes (1:N) — 錯字本
  ├── week_points (1:N) — 每週測驗點數上限
  ├── test_results (1:N) — 測驗/大魔王紀錄
  ├── zoo_diamonds (N:N via liker) — 送鑽
  └── zoo_comments (1:N) — 動物園留言

classes (班級，全站共用)
  └── weeks (週次)
        ├── word_cards (單字卡)
        └── uploads (上傳紀錄，可選關聯 week)

login_guards — 登入防爆破（帳號+IP）
```

**Storage buckets**

| bucket | 公開 | 用途 | 路徑規則 |
|---|---|---|---|
| `handouts` | 否 | 原始講義 | `{userId}/{timestamp}-{filename}` |
| `audio` | 是 | TTS 快取 mp3 | `{cardId}/{word\|sentence}-{normal\|slow}.mp3` |

---

## 3. 資料表（Postgres）

Migration 依序：`0001` → `0002` → `0003` → `0004` → `0005` → `0006`  
檔案位置：`supabase/migrations/`

### 3.1 `classes` — 班級

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| code | text UNIQUE | 班級代碼，如 `3A`、`4A` |
| name | text | 顯示名稱（可空） |
| owner_id | uuid | 最初建立者（0002 後可 null，全站共用） |
| created_at | timestamptz | |

**RLS**：公開 SELECT；寫入需 owner（實務上後端用 service_role）

### 3.2 `weeks` — 週次

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| class_id | uuid FK → classes | |
| week_label | text | 如 `W17` |
| date_range | text | 如 `06/01-06/05` |
| sort_order | int | 週數數字，供排序 |
| created_at | timestamptz | |

**UNIQUE** `(class_id, week_label)`

### 3.3 `word_cards` — 單字卡（核心）

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| week_id | uuid FK → weeks | |
| sort_order | int | 卡片順序 |
| english_word | text | 英文單字/片語 |
| part_of_speech | text | n./v./adj./ph./phr. 等 |
| word_meaning_zh | text | 中文詞義 |
| sentence | text | 英文例句 |
| sentence_zh | text | 中文翻譯（AI 生成） |
| audio_word_normal | text | 單字正常速 mp3 URL |
| audio_word_slow | text | 單字慢速 mp3 URL |
| audio_sentence_normal | text | 句子正常速 mp3 URL |
| audio_sentence_slow | text | 句子慢速 mp3 URL |
| teach_tip | jsonb | AI 記憶教學（見 §5.2） |
| created_at | timestamptz | |

**RLS**：公開 SELECT

### 3.4 `uploads` — 上傳紀錄

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| week_id | uuid FK → weeks | 分析成功後填入 |
| owner_id | uuid | 上傳者（可 null） |
| file_path | text | Storage 路徑 |
| mime_type | text | |
| status | text | `pending` \| `processing` \| `done` \| `error` |
| error | text | 失敗訊息 |
| created_at | timestamptz | |

### 3.5 `app_users` — 自建帳號

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| username | text UNIQUE | |
| password_hash | text | bcrypt |
| role | text | `admin` \| `parent` \| `student` |
| display_name | text | 顯示名稱 |
| created_at | timestamptz | |

**RLS**：無 policy → 僅 service_role 存取

### 3.6 `login_guards` — 防爆破

| 欄位 | 型別 | 說明 |
|---|---|---|
| scope | text PK | `user` \| `ip` |
| key | text PK | username 或 IP |
| fail_count | int | 失敗次數 |
| locked_until | timestamptz | 鎖定截止 |
| updated_at | timestamptz | |

規則：錯 1 次要驗證碼；錯 5 次鎖帳號+IP 10 分鐘

### 3.7 `student_progress` — 學生進度

| 欄位 | 型別 | 說明 |
|---|---|---|
| user_id | uuid PK FK → app_users | |
| points | int | 總點數（預設 0） |
| unlocked_count | int | 已解鎖動物數 |
| zoo_positions | jsonb | 動物園拖曳位置 |
| care | jsonb | 寵物照顧狀態（見 §5.3） |
| updated_at | timestamptz | |

**zoo_positions 格式**

```json
{
  "0": { "x": 120, "y": 80 },
  "3": { "x": 200, "y": 150 }
}
```

key = 動物 index（對應 `lib/creatures.ts` CREATURES 陣列）

### 3.8 `student_mistakes` — 錯字本

| 欄位 | 型別 | 說明 |
|---|---|---|
| user_id | uuid PK | |
| card_id | uuid PK FK → word_cards | |
| english_word | text | 冗餘快照 |
| word_meaning_zh | text | |
| sentence | text | |
| sentence_zh | text | |
| last_reviewed | date | 最後複習日（台北 YYYY-MM-DD） |
| created_at | timestamptz | |

**PK** `(user_id, card_id)`

### 3.9 `test_results` — 測驗紀錄

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| week_id | uuid FK | 可 null（大魔王無週次） |
| kind | text | `quiz` \| `boss` |
| score | int | |
| total | int | |
| created_at | timestamptz | |

### 3.10 `week_points` — 週測驗點數上限

| 欄位 | 型別 | 說明 |
|---|---|---|
| user_id | uuid PK | |
| week_id | uuid PK | |
| points | int | 此週已拿點數（上限 2） |

### 3.11 `zoo_diamonds` — 送鑽

| 欄位 | 型別 | 說明 |
|---|---|---|
| owner_id | uuid PK | 動物園主人 |
| liker_id | uuid PK | 送鑽者 |
| created_at | timestamptz | |

### 3.12 `zoo_comments` — 動物園留言

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid | 動物園主人 |
| author_id | uuid | 留言者 |
| author_name | text | |
| body | text | 最多 200 字 |
| created_at | timestamptz | |

---

## 4. TypeScript 型別（`lib/types.ts`）

```ts
type Speed = "normal" | "slow";
type AudioTarget = "word" | "sentence";
type UploadStatus = "pending" | "processing" | "done" | "error";
type Role = "admin" | "parent" | "student"; // lib/auth.ts

interface ClassRow { id, code, name, owner_id, created_at }
interface WeekRow { id, class_id, week_label, date_range, sort_order, created_at }
interface WordCardRow { /* 對應 word_cards 全欄位 */ }
interface UploadRow { id, week_id, file_path, mime_type, status, error, created_at }

interface ExtractedCard {
  english_word: string;
  part_of_speech?: string;
  word_meaning_zh?: string;
  sentence?: string;
  sentence_zh?: string;
}

interface ExtractedHandout {
  class_code: string;   // "3A"
  week_label: string;   // "W17"
  date_range?: string;  // "06/01-06/05"
  cards: ExtractedCard[];
}

interface TeachTip {
  emoji: string;
  syllables: string;      // "cu-cum-ber"
  sound_alike: string;    // 中文諧音
  memory_trick: string;
  spelling_tip: string;
  mini_story: string;
  image_prompt?: string;  // 英文，給文生圖
}
```

---

## 5. JSON 結構詳解

### 5.1 Gemini 講義抽取輸出（`ExtractedHandout`）

**Prompt 規則**（`lib/gemini.ts`）：

1. `class_code`：從「班別：」正規化 → `4A_`→`4A`，`Shiny (3A)`→`3A`
2. `week_label` / `date_range`：取「**一、**」那行（**不是**第一行「週別」）
3. `cards`：Vocabulary words 區，遇「**二、本週名句精選**」停止
4. 跨行單字/例句要合併；一字多詞性拆多筆
5. `sentence_zh` 來源無翻譯，由 AI 自行翻

**範例**

```json
{
  "class_code": "4A",
  "week_label": "W17",
  "date_range": "06/01-06/05",
  "cards": [
    {
      "english_word": "volcano",
      "part_of_speech": "n.",
      "word_meaning_zh": "火山",
      "sentence": "The volcano erupted last night.",
      "sentence_zh": "那座火山昨晚爆發了。"
    }
  ]
}
```

**上傳流程**（`POST /api/analyze`）：

```
File → handouts bucket
     → Gemini extractHandout()
     → normalize class_code / week_label
     → upsert classes (by code)
     → upsert weeks (by class_id + week_label)
     → DELETE 舊 word_cards → INSERT 新 cards
     → pregenerateWeekAudio (word normal/slow)
     → uploads.status = done
```

DOCX 先用 `mammoth` 抽文字再送 Gemini；PDF/圖片直接 inline base64。

### 5.2 `teach_tip`（word_cards.teach_tip）

由 `POST /api/teach` 按需生成，寫回 DB 快取。

```json
{
  "emoji": "🥒",
  "syllables": "cu-cum-ber",
  "sound_alike": "可以康跛 🥒",
  "memory_trick": "黃瓜長得像小黃瓜棒，可以拿來當拐杖。",
  "spelling_tip": "cucumber 開頭 cu- 像 cucumber 的 cu，記住雙 c 中間 u。",
  "mini_story": "小黃瓜戴墨鏡去海邊度假，結果被太陽曬成 pickle！",
  "image_prompt": "a cute smiling green cucumber cartoon character in a sunny vegetable garden, flat illustration, no text"
}
```

### 5.3 `care`（student_progress.care）

```json
{
  "last_fed": "2026-09-05",
  "last_cleaned": "2026-09-05T04:30:00.000Z",
  "feed": 3,
  "broom": 2,
  "lastFeedEarned": "2026-09-05",
  "lastBroomEarned": "2026-09-04"
}
```

| 欄位 | 說明 |
|---|---|
| last_fed | 最後餵食日（台北 date） |
| last_cleaned | 最後清掃時間（ISO，每 12h 長 1 坨💩） |
| feed / broom | 道具庫存（上限 5） |
| lastFeedEarned / lastBroomEarned | 今日是否已發道具 |

**CareView**（API 回傳，非 DB 欄位）：

```json
{
  "feed": 3,
  "broom": 2,
  "daysSinceFed": 0,
  "poopCount": 2,
  "lastCleaned": "2026-09-05T04:30:00.000Z",
  "hungerStage": "ok",
  "messStage": "warn",
  "away": false,
  "fedToday": true,
  "cleanedToday": false
}
```

`hungerStage` / `messStage`：`ok` | `warn` | `sick` | `away`

---

## 6. 遊戲規則常數（`lib/rules.ts` + `lib/creatures.ts`）

| 常數 | 值 | 說明 |
|---|---|---|
| MAX_WEEK_POINTS | 2 | 同一週測驗滿分最多拿 2 點 |
| GRADUATE_DAYS | 30 | 錯字滿 30 天可畢業 |
| EXPIRE_DAYS | 37 | 未畢業自動過期移除 |
| POINTS_PER_CREATURE | 5 | 每 5 點解鎖 1 隻動物 |
| CREATURE_COUNT | 84 | 動物總數 |
| FEED_WARN/SICK/AWAY | 3/5/7 天 | 飢餓階段 |
| POOP_HOURS | 12 | 每 12h 長 1 坨 |
| POOP_WARN/SICK/AWAY | 3/6/14 坨 | 髒亂階段 |
| CARE_ITEM_CAP | 5 | 飼料/掃把庫存上限 |
| CARE_START_ITEMS | 3 | 首次有動物贈送 |

**點數來源**

- 週測驗滿分 +1（每週上限 2）
- 錯字大魔王 30 天畢業 +1

**道具來源**

- 完成測驗：每日 +1 飼料
- 複習錯字：每日 +1 掃把
- 測驗滿分且無錯字：也 +1 掃把

---

## 7. API 一覽

### 認證

| Method | Path | 說明 |
|---|---|---|
| POST | `/api/auth/login` | 登入，設 `kel_session` cookie |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/captcha` | 取得驗證碼 |
| POST | `/api/auth/change-password` | 改密碼 |

**Session payload（JWT）**

```json
{ "sub": "user-uuid", "username": "kid1", "role": "student", "name": "小明" }
```

### 內容管理

| Method | Path | 權限 | 說明 |
|---|---|---|---|
| POST | `/api/analyze` | admin/parent | 上傳講義分析 |
| POST | `/api/admin/data` | admin | CRUD class/week/card |
| GET/POST/PATCH/DELETE | `/api/admin/users` | admin | 帳號管理 |
| POST | `/api/admin/student` | admin | 調整學生進度 |

**`/api/admin/data` ops**：`updateCard` | `deleteCard` | `updateWeek` | `deleteWeek` | `updateClass` | `deleteClass`

**`/api/admin/student` ops**：`setProgress` | `setItems` | `clearMistakes` | `setTestCount`

### 學習

| Method | Path | 說明 |
|---|---|---|
| GET | `/api/student/state` | 點數/錯字/照顧/zoo 位置 |
| POST | `/api/student/quiz-complete` | `{ weekId, score, total }` |
| POST | `/api/student/mistakes` | `{ action: add\|remove\|review, ... }` |
| POST | `/api/student/care` | `{ action: feed\|clean }` |
| POST | `/api/student/zoo` | `{ positions: {...} }` |
| POST | `/api/tts` | `{ cardId, target, speed, cacheOnly? }` |
| POST | `/api/teach` | `{ cardId }` → `{ tip }` |
| GET | `/api/leaderboard` | 排行榜 top 10 |
| GET/POST | `/api/zoo` | 動物園瀏覽/送鑽/留言 |

### 前端直接讀 Supabase（anon key）

- `/study`、`/admin` SSR：`classes`、`weeks`
- `StudyClient` client：`word_cards` where `week_id`

---

## 8. 頁面路由

| 路徑 | 角色 | 功能 |
|---|---|---|
| `/` | 公開 | 首頁 |
| `/login` | 公開 | 登入 |
| `/study` | 需登入 | 學生主介面 |
| `/admin` | admin | 後台 |
| `/parent` | parent/admin | 家長上傳 |

**Middleware**（`middleware.ts`）：`/study`、`/admin`、`/parent` 需 session；admin 頁限 admin。

---

## 9. 目錄結構

```
app/
  api/          # 全部 REST API
  admin/        # 管理後台
  study/        # 學生學習
  parent/       # 家長上傳
  login/
components/     # UI 元件
lib/
  types.ts      # 核心型別
  gemini.ts     # AI 抽取 + teach
  ttsCache.ts   # 語音快取
  azureTts.ts / edgeTts.ts / speak.ts
  auth.ts / authServer.ts
  rules.ts / creatures.ts / careServer.ts
  useStudent.ts # 前端狀態 hook
  supabase/     # client / server / admin
supabase/migrations/  # 0001~0006
docs/           # 本文件
```

---

## 10. 環境變數

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

AUTH_SECRET=
ADMIN_USERNAME=
ADMIN_PASSWORD=

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash

AZURE_SPEECH_KEY=          # 可選
AZURE_SPEECH_REGION=eastasia
AZURE_TTS_VOICE=en-US-AvaNeural
```

---

## 11. Gemini 接續開發提示

若要在 Gemini 上改功能，建議附上：

1. 本文件
2. 要改的檔案（常見：`lib/gemini.ts`、`lib/types.ts`、migration、`app/api/*`）
3. 講義範例 PDF（親師小語格式）
4. 說明要改的是：**抽取規則** / **UI** / **遊戲機制** / **新 API**

**常見擴充點**

- 新增 `word_cards` 欄位 → 加 migration + 更新 `ExtractedCard` + Gemini schema + analyze route
- 改抽取 prompt → 只改 `lib/gemini.ts` PROMPT + responseSchema
- 新測驗模式 → 加 API + `StudyClient` mode
- 新 AI 功能 → 參考 `/api/teach` 的快取模式（DB jsonb 欄位）

**注意**

- 後端敏感表一律 `service_role`，前端 anon 只能讀 classes/weeks/word_cards
- 同一週重新上傳會 **刪除舊 cards 再插入**（TTS/teach_tip 也會重來）
- TTS 預生成只做 word normal/slow；sentence 點擊時才生成
