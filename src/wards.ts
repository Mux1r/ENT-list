/**
 * 床號 → 病房代碼。
 *
 * 一般樓層：樓層兩碼 + 房號兩碼，"-" 後面是房內第幾床。房號 < 50 是 A 區，>= 50 是 B 區。
 *   1760    → 17 樓 60 房（單人房）  → 17B
 *   1401-2  → 14 樓 01 房 第 2 床    → 14A
 *
 * 9 樓例外：病房代碼直接寫在床號裡，B 區是 ICU 且改名 9I1 / 9I2。
 *   9A01-2  → 9A
 *   9I1...  → 9I1
 */
export const wardOf = (bed: string): string => {
  const s = bed.trim().toUpperCase();

  // 床號自己就帶了分區字母（9 樓用法）
  const explicit = s.match(/^(\d{1,2})([A-Z])(\d)?/);
  if (explicit) {
    const [, floor, zone, next] = explicit;
    // ICU 的代碼是 9I1 / 9I2，字母後面那碼是病房名的一部分，不是房號
    return zone === 'I' ? `${Number(floor)}I${next ?? ''}` : `${Number(floor)}${zone}`;
  }

  const m = s.match(/^(\d{2})(\d{2})/);
  if (!m) return '其他';
  return `${Number(m[1])}${Number(m[2]) < 50 ? 'A' : 'B'}`;
};

/** 1401-2 → 第 2 床；沒有 "-" 就是單人房 */
export const bedInRoom = (bed: string): string | null =>
  bed.trim().match(/-\s*(\d+)/)?.[1] ?? null;
