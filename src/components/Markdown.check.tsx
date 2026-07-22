// npx tsx src/components/Markdown.check.tsx
import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from './Markdown';

const html = (t: string) => renderToStaticMarkup(<Markdown text={t} />);

assert.match(html('## 病患摘要'), /<h3[^>]*>病患摘要<\/h3>/);
assert.match(html('- 年齡: 62M\n- POD 0'), /<ul.*<li[^>]*>年齡: 62M<\/li><li[^>]*>POD 0<\/li><\/ul>/s);
assert.match(html('− 全形 dash 也算 bullet'), /<li/);
assert.match(html('WBC **7.4** 與 `Cefazolin`'), /<strong[^>]*>7\.4<\/strong>.*<code[^>]*>Cefazolin<\/code>/s);

const table = html('| Lab | Value |\n| --- | --- |\n| WBC | 7.4 |\n| Hb | 17.8 |');
assert.match(table, /<th[^>]*>Lab<\/th>/);
assert.doesNotMatch(table, /---/);              // 分隔列不可變成資料列
assert.equal((table.match(/<tr>/g) || []).length, 3);

// 表格緊接清單時，兩者不可互相吞掉
const mixed = html('| A |\n| - |\n| 1 |\n- after');
assert.match(mixed, /<table/);
assert.match(mixed, /<li[^>]*>after<\/li>/);

assert.equal(html(''), '<div></div>');

console.log('Markdown ok');
