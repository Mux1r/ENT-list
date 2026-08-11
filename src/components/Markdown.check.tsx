// npx tsx src/components/Markdown.check.tsx
import assert from 'node:assert';
import { tokenize, SRC_TAG, DATE } from './Markdown';

// 抓出一行裡被上色的片段（來源標記／日期）。反引號包住的日期一樣算日期
const strip = (p: string) => (p.startsWith('`') && p.endsWith('`') ? p.slice(1, -1) : p);
const marked = (s: string) => tokenize(s).map(strip).filter(p => SRC_TAG.test(p) || DATE.test(p));

// 來源標記與日期各自抓到；AI 加不加反引號都算日期
assert.deepEqual(marked('`2026/08/11` [progress]:傷口乾淨'), ['2026/08/11', '[progress]']);
assert.deepEqual(marked('2026/08/11 [progress]:傷口乾淨'), ['2026/08/11', '[progress]']);
assert.deepEqual(marked('2026-08-11 06:00 [lab]:WBC 11.8'), ['2026-08-11 06:00', '[lab]']);
assert.deepEqual(marked('[OP] 2026/07/21 wide excision'), ['[OP]', '2026/07/21']);

// BP 不可被當成日期 —— Vital signs 每天都會出現
assert.deepEqual(marked('BT 37.2 / BP 128/74 / HR 88 / RR 18 / VAS 2'), []);
// 不在清單內的中括號不上色（避免整篇亂花）
assert.deepEqual(marked('[未記載] [note]'), []);

// 上色片段不會吃掉旁邊的字
assert.equal(tokenize('POD 3 [progress] stable').join(''), 'POD 3 [progress] stable');

console.log('Markdown ok');
