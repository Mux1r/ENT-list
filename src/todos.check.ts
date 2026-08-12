// npx tsx src/todos.check.ts
import assert from 'node:assert';
import { ENTChecklist } from './types';
import { allTodos, isBlankCheck } from './todos';

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

// ── allTodos ──
const checks = [
  check('d8', '2026-08-08', [['約 CT', false], ['已完成的事', true]]),
  check('d9', '2026-08-09', [['拔 drain', false]]),
  check('d10', '2026-08-10', [['換藥', false]]),
];

const todos = allTodos(checks);
// 未完成的依日期排前面，已完成的不會消失，反灰沉到最後
assert.deepStrictEqual(todos.map(t => t.note.text), ['約 CT', '拔 drain', '換藥', '已完成的事']);
assert.deepStrictEqual(todos.map(t => t.checkId), ['d8', 'd9', 'd10', 'd8']);
// 跨日項目仍指向原紀錄的 index，勾選才寫得回去
assert.strictEqual(todos[0].idx, 0);
// 每筆都帶日期，畫面靠它分「逾期／今天／之後」上色
assert.deepStrictEqual(todos.map(t => t.day), ['2026-08-08', '2026-08-09', '2026-08-10', '2026-08-08']);

// 排在未來的也在清單裡（只是紅點／紅字不數它，那段條件在呼叫端）
assert.deepStrictEqual(
  allTodos(checks).filter(t => !t.note.completed && t.day <= '2026-08-09').map(t => t.note.text),
  ['約 CT', '拔 drain'],
);

console.log('todos allTodos/isBlankCheck ok');
