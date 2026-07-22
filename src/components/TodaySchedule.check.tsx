// npx tsx src/components/TodaySchedule.check.tsx
import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';
import { format, startOfWeek, addDays } from 'date-fns';
import TodaySchedule from './TodaySchedule';
import { Patient } from '../types';

const today = format(new Date(), 'yyyy-MM-dd');
const nowIso = new Date().toISOString();
const yesterdayIso = new Date(Date.now() - 864e5).toISOString();

const p = (over: Partial<Patient>): Patient => ({
  id: over.name || 'x', name: 'X', bedNumber: '7A-01', age: 60, gender: 'Male',
  chartNumber: '1', admissionDate: today, diagnosis: '', status: 'Stable',
  medications: [], labTests: [], examinations: [], dailyChecks: [], ...over,
});

const html = (patients: Patient[]) =>
  renderToStaticMarkup(<TodaySchedule patients={patients} onSelect={() => {}} />);

// 本週手術：週一到週日都排得進去，跨週的不進來，出院病患不列入
const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
const d = (i: number) => format(addDays(monday, i), 'yyyy-MM-dd');
const ops = html([
  p({ name: '週一甲', opDate: d(0), opProcedure: 'Thyroidectomy' }),
  p({ name: '週日乙', opDate: d(6), opProcedure: 'Laryngectomy' }),
  p({ name: '上週丙', opDate: d(-1), opProcedure: 'FESS' }),
  p({ name: '下週丁', opDate: d(7), opProcedure: 'Myringotomy' }),
  p({ name: '出院戊', opDate: today, opProcedure: 'Tonsillectomy', status: 'Discharged' }),
]);
assert.match(ops, /週一甲.*Thyroidectomy/s);
assert.match(ops, /週日乙.*Laryngectomy/s);
assert.doesNotMatch(ops, /FESS|Myringotomy|Tonsillectomy/);
// 七天都要有格子
assert.equal((ops.match(/min-h-24/g) || []).length, 7);

// checklist：未完成項目列出、全完成不出現、當日無紀錄視為未記錄
const todo = html([
  p({ name: '未完丁', dailyChecks: [{ id: 'a', date: nowIso, notes: [{ text: '拔 drain', completed: false }, { text: '已做的', completed: true }] }] }),
  p({ name: '全完戊', dailyChecks: [{ id: 'b', date: nowIso, notes: [{ text: '已做的', completed: true }] }] }),
  p({ name: '沒紀錄己', dailyChecks: [{ id: 'c', date: yesterdayIso, notes: [{ text: '昨天的', completed: false }] }] }),
]);
assert.match(todo, /未完丁.*拔 drain/s);
assert.doesNotMatch(todo, /全完戊|已做的|昨天的/);
assert.match(todo, /沒紀錄己.*今日尚未記錄/s);

// 空資料不炸，且顯示 empty state
assert.match(html([]), /本週沒有排刀[\s\S]*全部完成/);

console.log('TodaySchedule ok');
