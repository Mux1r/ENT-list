// npx tsx src/components/PatientDetails.check.tsx
import assert from 'node:assert';
import { ENTChecklist } from '../types';
import { dayTodos, isBlankCheck } from './PatientDetails';

const check = (id: string, day: string, notes: [string, boolean][], extra: Partial<ENTChecklist> = {}): ENTChecklist => ({
  id, date: `${day}T09:00:00`,
  notes: notes.map(([text, completed]) => ({ text, completed })),
  ...extra,
});

// ── isBlankCheck ──
assert.ok(isBlankCheck(check('a', '2026-08-10', [])));
assert.ok(isBlankCheck(check('a', '2026-08-10', [['', false]])), '只有空白待辦仍算空白');
assert.ok(!isBlankCheck(check('a', '2026-08-10', [['拔 drain', false]])));
assert.ok(!isBlankCheck(check('a', '2026-08-10', [], { painLevel: 0 })), 'painLevel 0 也是評估過');

// ── dayTodos ──
const checks = [
  check('d8', '2026-08-08', [['約 CT', false], ['已完成的事', true]]),
  check('d9', '2026-08-09', [['拔 drain', false]]),
  check('d10', '2026-08-10', [['換藥', false]]),
];

const t10 = dayTodos(checks, '2026-08-10');
// 未完成的依日期排前面，已完成的不會消失，反灰沉到最後
assert.deepStrictEqual(t10.map(t => t.note.text), ['約 CT', '拔 drain', '換藥', '已完成的事']);
assert.deepStrictEqual(t10.map(t => t.checkId), ['d8', 'd9', 'd10', 'd8']);
// 跨日項目仍指向原紀錄的 index，勾選才寫得回去
assert.strictEqual(t10[0].idx, 0);

// 當天自己的紀錄：已完成的也要顯示（沉到最後）
const t8 = dayTodos(checks, '2026-08-08');
assert.deepStrictEqual(t8.map(t => t.note.text), ['約 CT', '已完成的事']);

// 未來的待辦不會提早出現
assert.deepStrictEqual(dayTodos(checks, '2026-08-09').map(t => t.note.text), ['約 CT', '拔 drain', '已完成的事']);
assert.deepStrictEqual(dayTodos(checks, '2026-08-07').map(t => t.note.text), []);

console.log('PatientDetails dayTodos/isBlankCheck ok');
