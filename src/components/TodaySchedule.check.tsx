// npx tsx src/components/TodaySchedule.check.tsx
import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';
import { format, startOfWeek, addDays } from 'date-fns';
import TodaySchedule, { weekOps, pendingTodos } from './TodaySchedule';
import { Patient } from '../types';

const today = format(new Date(), 'yyyy-MM-dd');
const nowIso = new Date().toISOString();
const yesterdayIso = new Date(Date.now() - 864e5).toISOString();

const p = (over: Partial<Patient>): Patient => ({
  id: over.name || 'x', name: 'X', bedNumber: '7A-01', age: 60, gender: 'Male',
  chartNumber: '1', admissionDate: today, diagnosis: '', status: 'Stable',
  medications: [], labTests: [], examinations: [], dailyChecks: [], ...over,
});

// ── 本週手術：週一到週日各自歸位，跨週的不進來，出院病患不列入
const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
const d = (i: number) => format(addDays(monday, i), 'yyyy-MM-dd');
const week = weekOps([
  p({ name: '週一甲', opDate: d(0), opProcedure: 'Thyroidectomy' }),
  p({ name: '週一乙', opDate: d(0), opProcedure: 'FESS' }),
  p({ name: '週日丙', opDate: d(6), opProcedure: 'Laryngectomy' }),
  p({ name: '上週丁', opDate: d(-1), opProcedure: 'Myringotomy' }),
  p({ name: '下週戊', opDate: d(7), opProcedure: 'Septoplasty' }),
  p({ name: '出院己', opDate: d(1), opProcedure: 'Tonsillectomy', status: 'Discharged' }),
]);
assert.equal(week.length, 7);
assert.deepEqual(week.map(x => x.ops.length), [2, 0, 0, 0, 0, 0, 1]);
assert.deepEqual(week[0].ops.map(x => x.name), ['週一甲', '週一乙']);

// 換週：+7 天算出的是下一週，上面那台下週刀會落在該週
const nextWeek = weekOps([p({ name: '下週戊', opDate: d(7), opProcedure: 'Septoplasty' })], addDays(new Date(), 7));
assert.equal(nextWeek[0].day, d(7));
assert.deepEqual(nextWeek.map(x => x.ops.length), [1, 0, 0, 0, 0, 0, 0]);

// ── 待辦：不分天累積，同文字只留一筆，全完成的病患沉到最後，出院的不列入
const todo = pendingTodos([
  p({ name: '全完乙', dailyChecks: [{ id: 'b', date: nowIso, notes: [{ text: '已做的', completed: true }] }] }),
  p({ name: '未完甲', dailyChecks: [
    { id: 'a1', date: yesterdayIso, notes: [{ text: '拔 drain', completed: false }, { text: '已做的', completed: true }] },
    { id: 'a2', date: nowIso, notes: [{ text: '拔 drain', completed: false }, { text: '換藥', completed: true }] },
  ] }),
  p({ name: '沒紀錄丙', dailyChecks: [] }),
  p({ name: '出院丁', status: 'Discharged', dailyChecks: [{ id: 'd', date: nowIso, notes: [{ text: '不該出現', completed: false }] }] }),
]);
assert.deepEqual(todo.map(x => x.p.name), ['未完甲', '全完乙']);   // 沒完成的排前面
assert.deepEqual(todo[0].undone.map(n => n.text), ['拔 drain']);   // 跨天同一項只算一筆
assert.deepEqual(todo[0].done.map(n => n.text), ['已做的', '換藥']);
assert.deepEqual(todo[1].undone, []);

// ── 畫面：預設 手術 tab + 今日，七個日期點都在
const html = renderToStaticMarkup(
  <TodaySchedule
    patients={[p({ name: '今天甲', opDate: today, opProcedure: 'Thyroidectomy' }), p({ name: '未完乙', dailyChecks: [] })]}
    onSelect={() => {}}
    tab="op"
    onTabChange={() => {}}
  />
);
assert.equal((html.match(/sm:w-10 sm:h-10 rounded-full/g) || []).length, 7);
assert.match(html, /今天甲[\s\S]*Thyroidectomy/);
assert.doesNotMatch(html, /未完乙/);              // 待辦在另一個 tab
assert.match(renderToStaticMarkup(<TodaySchedule patients={[]} onSelect={() => {}} tab="op" onTabChange={() => {}} />), /這天沒有排刀/);

// ── 待辦 tab：不分天、沒有日期列，完成的畫刪除線
const todoHtml = renderToStaticMarkup(
  <TodaySchedule
    patients={[
      p({ name: '未完甲', dailyChecks: [{ id: 'c', date: yesterdayIso, notes: [{ text: '拔 drain', completed: false }, { text: '已做的', completed: true }] }] }),
      p({ name: '沒紀錄丙', dailyChecks: [] }),
    ]}
    onSelect={() => {}}
    tab="todo"
    onTabChange={() => {}}
  />
);
assert.match(todoHtml, /未完甲[\s\S]*拔 drain/);      // 昨天的待辦今天還在
assert.match(todoHtml, /line-through[\s\S]*已做的/);
assert.doesNotMatch(todoHtml, /沒紀錄丙/);            // 沒記錄＝沒事要做
assert.doesNotMatch(todoHtml, /sm:w-10 sm:h-10 rounded-full/);   // 待辦不分天，沒有日期列

console.log('TodaySchedule ok');
