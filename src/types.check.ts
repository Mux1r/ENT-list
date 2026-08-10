// npx tsx src/types.check.ts
import assert from 'node:assert';
import { asText } from './types';

assert.strictEqual(asText('Left parotid tumor'), 'Left parotid tumor');
assert.strictEqual(asText(undefined), '');
assert.strictEqual(asText(null), '');
// AI 把 problem list 輸出成陣列
assert.strictEqual(asText(['OSA', 'Chronic tonsillitis']), 'OSA；Chronic tonsillitis');
// 甚至是物件陣列 —— 就是這個變成 [object Object]
assert.strictEqual(
  asText([{ problem: 'Left parotid tumor', note: 's/p parotidectomy' }, { problem: 'HTN' }]),
  'Left parotid tumor s/p parotidectomy；HTN'
);
assert.strictEqual(asText([]), '');
assert.strictEqual(asText(['', null, 'OSA']), 'OSA');
assert.strictEqual(asText(42), '42');

console.log('types asText ok');
