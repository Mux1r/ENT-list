// 檢查（影像／病理）的分類。檢驗有自己的 LAB_CATEGORIES，這支只管檢查分頁。
// 獨立成一支是為了讓 exams.check.ts 跑得起來（PatientDetails.tsx 會 import .md?raw）。
export const EXAM_CATEGORIES = ['X光', 'CT', 'MRI', 'PET', '超音波', '內視鏡', '心電圖', '病理', '其他'] as const;
export type ExamCategory = typeof EXAM_CATEGORIES[number];

// 舊資料和 AI 匯入的檢查都沒有 category，所以從名稱猜一個。
// 順序有意義：先比對窄的再比對寬的，例如 PET-CT 要算 PET，先比 PET 才不會被 CT 接走；
// CT-guided biopsy 算 CT（是影像動作），所以病理放最後。
const GUESS: [RegExp, ExamCategory][] = [
  [/\bpet\b|pet-?ct/i, 'PET'],
  [/\bmri\b|magnetic resonance|磁振/i, 'MRI'],
  [/\bct\b|computed tomograph|電腦斷層/i, 'CT'],
  [/x[-\s]?ray|\bcxr\b|\bkub\b|radiograph|平片|X\s*光/i, 'X光'],
  [/\becg\b|\bekg\b|electrocardiogra|心電圖/i, '心電圖'],
  // echo（心臟超音波）算超音波；\bus\b 是院內慣用的 US neck 這種寫法
  [/ultraso|sonograph|\becho|\bus\b|超音波|超音/i, '超音波'],
  [/scop(e|y|ic)|endoscop|鏡檢|內視鏡|喉鏡|鼻咽鏡/i, '內視鏡'],
  [/patholog|biops|frozen|cytolog|病理|切片/i, '病理'],
];

// 使用者在編輯視窗選過的分類最大，沒選才用猜的，猜不到歸「其他」
export const examCategory = (exam: { name: string; category?: string }): ExamCategory => {
  if (EXAM_CATEGORIES.includes(exam.category as ExamCategory)) return exam.category as ExamCategory;
  return GUESS.find(([re]) => re.test(exam.name))?.[1] ?? '其他';
};
