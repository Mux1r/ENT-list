// npx tsx src/exams.check.ts
import assert from 'node:assert';
import { examCategory } from './exams';

// 手動選過的分類最大，不會被名稱猜測蓋掉
assert.equal(examCategory({ name: 'Chest X-ray', category: '病理' }), '病理');
// 不認得的分類（例如舊資料或 AI 亂填）當作沒選，改用猜的
assert.equal(examCategory({ name: 'Neck CT', category: 'Imaging' }), 'CT');

// 名稱猜測
assert.equal(examCategory({ name: 'PET-CT whole body' }), 'PET', 'PET-CT 算 PET 不是 CT');
assert.equal(examCategory({ name: 'CT Neck with contrast' }), 'CT');
assert.equal(examCategory({ name: 'MRI brain' }), 'MRI');
assert.equal(examCategory({ name: 'CXR' }), 'X光');
assert.equal(examCategory({ name: 'Chest x ray' }), 'X光');
assert.equal(examCategory({ name: 'Frozen section' }), '病理');
assert.equal(examCategory({ name: '頸部淋巴結切片' }), '病理');
assert.equal(examCategory({ name: 'US neck' }), '超音波');
assert.equal(examCategory({ name: 'Thyroid ultrasound' }), '超音波');
assert.equal(examCategory({ name: 'Echocardiography' }), '超音波', 'echo 是心臟超音波，不是心電圖');
assert.equal(examCategory({ name: 'EKG' }), '心電圖');
assert.equal(examCategory({ name: 'Nasopharyngoscopy' }), '內視鏡');
assert.equal(examCategory({ name: 'Panendoscopy' }), '內視鏡');
assert.equal(examCategory({ name: '喉鏡檢查' }), '內視鏡');
// CT 導引下切片是影像動作，歸 CT 不歸病理（GUESS 的順序決定）
assert.equal(examCategory({ name: 'CT-guided biopsy' }), 'CT');
// 猜不到就歸「其他」，不會整筆從畫面上消失
assert.equal(examCategory({ name: 'Bone scan' }), '其他');
// 「connective tissue」裡的 ct 不是獨立的字，不該被當成電腦斷層
assert.equal(examCategory({ name: 'Connective tissue study' }), '其他');
// 「Sinus」裡的 us 也不是獨立的字，不該被當成超音波
assert.equal(examCategory({ name: 'Sinus survey' }), '其他');

console.log('exams ok');
