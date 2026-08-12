// 查房待辦的純邏輯。獨立成一支是為了讓 todos.check.ts 跑得起來 ——
// PatientDetails.tsx 會 import 一份 .md?raw（Vite 專用），tsx 直接執行時會炸。
import { format } from 'date-fns';
import { ENTChecklist } from './types';

// 查房評估欄位。畫面上已不顯示（查房只留待辦），但匯入的資料照樣存著，
// 這裡只用來判斷一筆紀錄是不是空的 —— 要重新做評估 UI 的話翻 git 記錄。
const ASSESS_KEYS: (keyof ENTChecklist)[] = [
  'bleeding', 'airway', 'fever', 'drainAmount', 'swallowing', 'facialNerve',
  'painLevel', 'hoarseness', 'woundStatus', 'flap', 'tracheostomy', 'calcium',
];

// 日期一律取「日曆日」比對，避免 dailyChecks.date 帶時間造成差一天
export const dayOf = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : format(d, 'yyyy-MM-dd');
};

export const normalizeNotes = (notes: ENTChecklist['notes'] | string | undefined): { text: string; completed: boolean }[] => {
  // 舊資料的 notes 可能是字串，或字串陣列
  if (Array.isArray(notes)) return notes.map(n => (typeof n === 'string' ? { text: n, completed: false } : n));
  if (typeof notes === 'string') return [{ text: notes, completed: false }];
  return [];
};

// 沒有任何評估項目、也沒有任何有字的待辦 = 空白，不算一筆紀錄
export const isBlankCheck = (c: ENTChecklist) =>
  ASSESS_KEYS.every(k => c[k] === undefined) && !normalizeNotes(c.notes).some(n => n.text.trim());

// 一位病患的待辦清單，不分天：逾期的、今天的、先排在之後的全部列在一起，
// 未完成在上，已完成反灰沉到最下面（勾掉不會消失），同一組內由舊排到新。
// 項目是「借看」原紀錄，不複製 —— 勾選時寫回它原本那天，才不會每天複製一份。
// ponytail: 住院久了下面那疊已完成會越積越長，真的礙眼再加「只留最近 N 筆／收合」
export const allTodos = (checks: ENTChecklist[]) =>
  checks
    .flatMap(c => normalizeNotes(c.notes).map((note, idx) => ({ checkId: c.id, day: dayOf(c.date), idx, note })))
    .sort((a, b) => Number(a.note.completed) - Number(b.note.completed) || a.day.localeCompare(b.day));
