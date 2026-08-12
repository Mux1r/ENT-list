# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

耳鼻喉科（ENT）住院病人管理 PWA，單一使用者（住院醫師本人）用。React 19 + TypeScript + Vite + Tailwind v4 + Firebase (Google Auth + Firestore)。UI、註解、commit 訊息一律繁體中文。

## 指令

```bash
npm run dev      # vite, port 3000
npm run lint     # tsc --noEmit（唯一的靜態檢查，沒有 ESLint）
npm run build    # 產出 dist/
```

沒有測試框架。驗證邏輯用 `*.check.ts(x)` 自測檔，各自獨立跑：

```bash
npx tsx src/wards.check.ts
npx tsx src/todos.check.ts
npx tsx src/components/TodaySchedule.check.tsx
npx tsx src/components/Markdown.check.tsx
```

寫法：`node:assert` + 檔尾 `console.log('xxx ok')`，第一行註解寫執行指令。新增非平凡邏輯時比照辦理，不要引入 vitest/jest。

部署：push 到 `main` → GitHub Actions → GitHub Pages。`vite.config.ts` 的 `base` 是 `/ENT-list/`，PWA manifest 的路徑也全部硬寫這個前綴，改 repo 名要一起改。

## 資料模型

**一位病患 = 一份 Firestore document**：`patients/{id}`。`medications` / `labTests` / `examinations` / `dailyChecks` 都是**內嵌在該 doc 裡的陣列**，不是 subcollection。任何欄位改動都是整份 `updateDoc`。

`firestore.rules` 裡另有 `patients/{id}/checklists/{id}` subcollection 規則 — **程式碼沒有在用**，是早期設計的殘留。

### 改 `Patient` 型別時必須同步 rules

`firestore.rules` 的 update 規則用 `affectedKeys().hasOnly([...])` 白名單。在 [types.ts](src/types.ts) 加一個新欄位而沒有加進那份清單，寫入會被 Firestore 拒絕（PERMISSION_DENIED），而且畫面上只會看到「存不進去」，錯誤訊息不會指向 rules。

其他 rules 約束：`createdAt`/`updatedAt` 必須 `== request.time` → 寫入一律帶 `serverTimestamp()`；`ownerId` 必須等於當前 uid 且不可修改；登入需 `email_verified`。

改完 rules 要另外 `firebase deploy --only firestore:rules`（CI 不含這步）。

### ENTChecklist 的評估欄位已停用

[types.ts](src/types.ts) 的 `bleeding` / `airway` / `painLevel` 等評估欄位**畫面上已不再顯示**，查房頁只剩待辦（`notes[]`）。三份 prompt 也都改成只產 `date` + `notes`。舊資料仍留在 Firestore、匯入時也照收，`ASSESS_KEYS` 只用來判斷一筆紀錄是不是空的；不做 migration。要恢復評估 UI 就翻 git（`CHECK_FIELDS` 那張表）。

## 主要流程

- [App.tsx](src/App.tsx) — 唯一的資料層。`onSnapshot` 訂閱 `patients` 即時同步，所有 Firestore 寫入都在這裡；子元件透過 callback 往上報。也負責病患列表、排序、批次選取、出院流程。
- [PatientDetails.tsx](src/components/PatientDetails.tsx) — 分頁式病患詳情（交班 / 用藥 / 檢驗 / 檢查 / 查房）。查房頁只有待辦清單，評估項目的 UI 已移除；`ENTChecklist` 的評估欄位仍會被匯入與保存。
- [todos.ts](src/todos.ts) — 查房待辦的純邏輯（`allTodos` 不分天累積、`isBlankCheck`、`ASSESS_KEYS`）。獨立成一支是因為 `PatientDetails.tsx` import 了 `.md?raw`，check 檔用 tsx 直接跑會炸。
- [TodaySchedule.tsx](src/components/TodaySchedule.tsx) — 本週手術行事曆 + 跨日累積的未完成 checklist。`weekOps` / `pendingTodos` 是純函式並 export，給 check 檔用。
- [wards.ts](src/wards.ts) — 床號 → 病房代碼。院內編碼規則（房號 ≥ 50 算 B 區、9 樓分區字母直接寫在床號裡、ICU 是 9I1/9I2）都在註解和 check 檔裡。

### 兩條資料匯入路徑

1. **截圖匯入病患**（[ImportModal.tsx](src/components/ImportModal.tsx) → [geminiService.ts](src/services/geminiService.ts)）：貼上院內系統的病患清單截圖，Gemini 抽出床號/病歷號/姓名/年齡，`writeBatch` 一次寫入。這是 app 內唯一呼叫 AI 的地方。
2. **貼上交班報告**（PatientDetails）：把病歷貼給**院內** AI（prompt 在 [ENT_ward_round_briefing_prompt.md](ENT_ward_round_briefing_prompt.md)，其 `===IMPORT-JSON===` 之後的欄位定義與 `PatientDetails.tsx` 的 `JSON_IMPORT_PROMPT`（畫面上「複製 Prompt」給的那份）是同一份規格，改一邊要改兩邊），它回傳 markdown 報告 + `===IMPORT-JSON===` 分隔線 + 結構化 JSON，整段貼回 app 拆解。改動 prompt 檔的輸出格式就要同步改 `BRIEFING_SENTINEL` 附近的解析邏輯。

`GEMINI_API_KEY` 由 `vite.config.ts` 的 `define` 在 build 時直接內嵌進 bundle——它是公開的，別放任何需要保密的 key。沒設 key 時截圖匯入靜默回傳空陣列。

## 樣式

Tailwind v4，`@theme` 色票定義在 [index.css](src/index.css)：莫蘭迪色系 `natural-*`（灰褐，主色）、`sage-*`、`terracotta-*`。用這些 token，不要用 Tailwind 預設的 `gray-*` / `red-*`。等寬字型 JetBrains Mono。

## 慣例

- 刻意的簡化用 `ponytail:` 註解標記，並寫明升級路徑（例：`types.ts` 的單場刀 `opDate` → 之後要多場再改 `operations[]`）。看到這種註解代表是有意識的取捨，不是漏寫。
- 偏好修 bug 與刪 dead code，不主動加新功能、不改動整體架構。
