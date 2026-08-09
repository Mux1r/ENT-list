// npx tsx src/wards.check.ts
import assert from 'node:assert';
import { wardOf, bedInRoom } from './wards';

// 一般樓層：房號 < 50 是 A，>= 50 是 B
assert.equal(wardOf('1760'), '17B');      // 60 >= 50
assert.equal(wardOf('1401-2'), '14A');    // 01 < 50
assert.equal(wardOf('1449'), '14A');      // 邊界前
assert.equal(wardOf('1450'), '14B');      // 剛好 50 算 B
assert.equal(wardOf('0801-1'), '8A');     // 樓層前導 0 去掉
assert.equal(wardOf(' 1760 '), '17B');    // 前後空白

// 9 樓：分區字母直接寫在床號裡，ICU 叫 9I1 / 9I2
assert.equal(wardOf('9A01-2'), '9A');
assert.equal(wardOf('9I104'), '9I1');     // 9I1 + 房號
assert.equal(wardOf('9i2-03'), '9I2');    // 小寫也吃

assert.equal(wardOf(''), '其他');
assert.equal(wardOf('X'), '其他');

assert.equal(bedInRoom('1401-2'), '2');
assert.equal(bedInRoom('9A01-2'), '2');
assert.equal(bedInRoom('1760'), null);

console.log('wards ok');
