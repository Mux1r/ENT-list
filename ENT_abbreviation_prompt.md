# ENT 縮寫對照表 — 產生用 Prompt

貼給院內 AI，讓它照 [ent-abbreviations.json](ent-abbreviations.json) 的格式吐資料。
兩種用法：**A. 從零產生整份**、**B. 補上你手邊病歷裡出現、但表裡沒有的縮寫**（日常用這個）。

---

## A. 從零產生整份

```
你是耳鼻喉科住院醫療資料的術語專家。請產出一份 ENT 常用縮寫對照表，只輸出 JSON，不要任何說明文字或 ``` 標記。

格式：
{
  "categories": {
    "surgery":       [ { "abbr": "", "en": "", "zh": "", "note": "" } ],
    "disease":       [ ... ],
    "anatomy":       [ ... ],
    "investigation": [ ... ],
    "ward":          [ ... ]
  }
}

欄位定義：
- abbr：縮寫，維持臨床書寫的大小寫（T&A、CRSwNP、F/U 這類照原樣）
- en：英文全稱，首字母大寫
- zh：台灣臨床慣用的中文名稱（不是逐字直譯）
- note：選填。只有在「同一縮寫有多個意思」或「不同醫院寫法不同」時才填，其餘省略此欄

分類定義：
- surgery：手術與處置（含皮瓣、氣切、內視鏡手術）
- disease：疾病與診斷（含腫瘤病理型態）
- anatomy：解剖構造與神經血管
- investigation：檢查、影像、聽力與吞嚥評估、分期系統
- ward：病房日常與行政（POD、NPO、D/C、管路、病毒名等）

規則：
1. 只收耳鼻喉科／頭頸外科實際會寫在病歷上的縮寫，不要為了湊數自創。
2. 一個縮寫有多個常見意思時，在最相關的分類各收一筆，並用 note 標明另一個意思。
3. 同一分類內按臨床使用頻率由高到低排列。
4. 每類至少 15 筆，surgery 與 disease 至少 40 筆。
5. 只輸出 JSON。
```

---

## B. 增補（日常用這個）

把現有表格和你手上的病歷/清單一起丟進去，讓 AI 只吐「缺的」，再併回 JSON。

```
你是耳鼻喉科住院醫療資料的術語專家。

以下是我現有的縮寫對照表：
<貼上 ent-abbreviations.json 的內容>

以下是實際病歷文字：
<貼上病歷、手術清單或匯入失敗的欄位>

任務：找出在病歷中出現、但對照表裡「沒有」的 ENT 縮寫，只輸出新增的部分，格式與上表相同的 JSON（同樣的 categories 結構，只放新條目），不要重複已有的，不要輸出說明文字。
無法確定全稱的縮寫，放進 "unknown" 陣列，格式 { "abbr": "", "context": "出現的原句" }，不要猜。
```

---

## 併回檔案

院內 AI 給的 JSON 存成 `new.json`，然後：

```bash
node -e "
const fs=require('fs'), base=require('./ent-abbreviations.json'), add=require('./new.json');
for (const k in add.categories) {
  const have = new Set(base.categories[k].map(e => e.abbr.toUpperCase()));
  base.categories[k].push(...add.categories[k].filter(e => !have.has(e.abbr.toUpperCase())));
}
fs.writeFileSync('ent-abbreviations.json', JSON.stringify(base, null, 2) + '\n');
console.log('merged');
"
```

依 `abbr` 去重（不分大小寫），舊條目不會被覆寫。

## 病歷資料要注意

病歷內容屬個資，只能貼進院內 AI，不要送到外部服務。上面 B 的 prompt 已經把病歷限縮在「找縮寫」這件事上，但貼之前還是先把姓名、病歷號拿掉比較保險。
