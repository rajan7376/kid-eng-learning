# 單字動物王國

管理員上傳講義（JPG/PNG/PDF/WORD），AI 自動分析成單字卡。學生登入後可聽真人發音、慢速跟讀、做聽力測驗、收集動物、互逛動物園與排行榜。

## 技術架構

- **Next.js 14 (App Router) + TypeScript + Tailwind** — 前後端一體，部署 Vercel
- **Supabase** — Postgres 資料庫 + Storage（講義/語音）；僅作資料庫，**驗證為自建**
- **自建帳密驗證** — `bcryptjs` 雜湊密碼 + `jose` 簽 JWT（httpOnly cookie），角色 `admin` / `student`
- **Google Gemini Flash** — 多模態 OCR + 結構化抽取（班級/週次/單字/詞性/例句/翻譯）
- **Azure Neural TTS** — 擬真人發音，生成後存 Storage 永久快取；未設定時前端降級 Web Speech API

## 功能

- **管理後台 `/admin`**：上傳講義、編輯/刪除班級·週次·單字、管理帳號（新增學生/管理員、改密碼、刪除）、檢視與調整學生進度（點數/解鎖/清錯字）。
- **學生 `/study`**：單字卡（中英發音、中文翻譯可隱藏）、聽力測驗（選中文＋拼單字）、錯字大魔王複習、我的動物園（拖曳擺放）、逛別人動物園（送 💎、留言）、排行榜（點數/解鎖/測驗/打敗大魔王）。
- **安全**：密碼錯 1 次出現驗證碼；錯 5 次鎖定帳號＋來源 IP 10 分鐘。

## 帳號模型

- 不開放自行註冊。第一個管理員由環境變數 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 在首次登入時自動建立。
- 其餘帳號（學生、其他管理員）一律由管理員在 `/admin` 建立。
- 學生的學習/測驗/獎勵進度都存在伺服器，跨裝置同步。

## 快速開始（本機）

### 1. 安裝套件

```bash
npm install
```

### 2. 建立 Supabase 專案並跑 Migration

1. 到 [supabase.com](https://supabase.com) 建立免費專案。
2. 開 **SQL Editor**，**依序**貼上並執行：
   - `supabase/migrations/0001_init.sql`（資料表、RLS、Storage buckets）
   - `supabase/migrations/0002_auth_and_progress.sql`（帳號、防爆破、學生進度）
   - `supabase/migrations/0003_social.sql`（動物園送鑽、留言）
3. 到 **Project Settings > API** 取得 `URL`、`anon key`、`service_role key`。

### 3. 取得金鑰

- **Gemini**：[Google AI Studio](https://aistudio.google.com/app/apikey) 建 API key（免費）。
- **Azure Speech**（可選）：Azure Portal 建 Speech 資源（免費 F0），取得 Key 與 Region。

### 4. 設定環境變數

複製 `.env.local.example` 為 `.env.local` 並填值：

```bash
cp .env.local.example .env.local
```

必填：`NEXT_PUBLIC_SUPABASE_URL`（結尾**不要**帶 `/rest/v1/`）、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`AUTH_SECRET`、`ADMIN_USERNAME`、`ADMIN_PASSWORD`、`GEMINI_API_KEY`。

> 公司網路若出現 `SELF_SIGNED_CERT_IN_CHAIN`，僅本機開發可在 `.env.local` 加 `NODE_TLS_REJECT_UNAUTHORIZED=0`。**正式環境絕對不要設這個。**

### 5. 啟動

```bash
npm run dev
```

開 http://localhost:3000 → `/login` 用管理員帳密登入 → `/admin` 上傳講義、建學生帳號 → 學生於 `/study` 學習。

## 部署到 Vercel

Supabase 已在雲端不需搬移，只需把 Next.js 部署到 Vercel（免費方案即可）。

### 1. 推到 GitHub

```bash
git init
git add .
git commit -m "kid english app"
# 用 GitHub CLI：
gh repo create kid-eng-learning --private --source=. --push
# 或手動建 repo 後：git remote add origin <url> && git push -u origin main
```

確認 `.gitignore` 有擋 `.env*.local`，別把金鑰推上去。

### 2. 於 Vercel 匯入

[vercel.com](https://vercel.com) → Add New → Project → 選 repo（自動偵測 Next.js）→ 先設環境變數再 Deploy。

### 3. 設定環境變數（Production）

於 **Settings > Environment Variables** 填入：

| 變數 | 說明 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL（結尾無 `/rest/v1/`） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key（僅伺服器用） |
| `AUTH_SECRET` | 長隨機字串，JWT 簽章用 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 首次登入自動建立的管理員 |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Gemini 金鑰與模型（如 `gemini-2.0-flash`） |
| `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` / `AZURE_TTS_VOICE` | 可選，未設定走瀏覽器語音 |

> **不要**在 Vercel 設 `NODE_TLS_REJECT_UNAUTHORIZED=0`（等於關閉憑證驗證）。
> `SERVICE_ROLE`、`GEMINI`、`AZURE` 等金鑰不要加 `NEXT_PUBLIC_` 前綴。

### 4. Deploy

綠燈後開 `https://你的專案.vercel.app/login`，用 `ADMIN_USERNAME/PASSWORD` 登入（首次自動建管理員）。

### 部署注意

- `bcryptjs` / `jose` 為純 JS，Vercel Node serverless 直接可跑。
- 帳號/IP 鎖定靠 `x-forwarded-for` 取來源 IP，Vercel 會帶此 header（本機多為 `unknown`）。
- cookie 在正式環境為 `secure`，Vercel 全程 HTTPS 沒問題。
- 改 `AUTH_SECRET` 會讓所有人 session 失效需重登，上線後勿動。
- 三個 migration（`0001`/`0002`/`0003`）務必都已在 Supabase 執行。

## 講義分析規則

針對「親師小語」週報格式：
- 班級：由「班別：」正規化為 `3A`/`4A` 等代碼
- 週次/日期：取「一、」那行（單字週，非第一行的上週）
- 單字：抽 Vocabulary words 區，遇「二、本週名句精選」停止
- 自動合併跨行單字/例句，支援一字多詞性多句
- 例句中文翻譯由 AI 生成（來源無翻譯）

## 免費額度與穩定性

- TTS 採「首次播放即生成 + Storage 快取」，每張卡只生成一次，避免逾時。
- 上傳分析有 `status` 狀態機（processing/done/error），失敗可重傳。
- Azure 滿載/未設定時前端自動降級瀏覽器語音，功能不中斷。
