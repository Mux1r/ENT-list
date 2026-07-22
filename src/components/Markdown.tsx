// ponytail: 手寫 renderer 而不是裝 marked + dompurify。
// 交班報告只用到標題／粗體／inline code／清單／表格／分隔線這幾種語法，
// 而且直接產出 React element、不碰 dangerouslySetInnerHTML，所以天生沒有 XSS。
// 哪天報告開始出現連結、圖片、巢狀清單，再換成正式 parser。

const BULLET = /^\s*[-−–*•]\s+/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const HR = /^\s*([-=_═─]{3,})\s*$/;
const TABLE_SEP = /^[\s|:-]+$/;

// **粗體** 與 `code`，其餘原樣輸出
const inline = (s: string) =>
  s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-bold text-natural-900">{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="px-1 py-0.5 bg-natural-100 rounded text-[11px] font-mono text-clinical-700">{part.slice(1, -1)}</code>;
    return part;
  });

const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

export default function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const out: any[] = [];   // 專案沒裝 @types/react，ReactNode 這個型別名在這裡拿不到
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    if (HR.test(line)) {
      out.push(<hr key={i} className="border-natural-100 my-3" />);
      i++;
      continue;
    }

    const h = line.match(HEADING);
    if (h) {
      const size = h[1].length <= 2 ? 'text-sm' : 'text-xs';
      out.push(
        <h3 key={i} className={`${size} font-bold text-natural-900 mt-4 mb-1.5 first:mt-0`}>{inline(h[2])}</h3>
      );
      i++;
      continue;
    }

    if (line.trim().startsWith('|')) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++]);
      const head = cells(rows[0]);
      const body = rows.slice(rows[1] && TABLE_SEP.test(rows[1]) ? 2 : 1).map(cells);
      out.push(
        <div key={`t${i}`} className="overflow-x-auto my-2">
          <table className="text-xs border-collapse">
            <thead>
              <tr>{head.map((c, n) => (
                <th key={n} className="border border-natural-100 bg-natural-50 px-2 py-1 text-left font-bold text-natural-500 whitespace-nowrap">{inline(c)}</th>
              ))}</tr>
            </thead>
            <tbody>{body.map((r, n) => (
              <tr key={n}>{r.map((c, m) => (
                <td key={m} className="border border-natural-100 px-2 py-1 text-natural-700 whitespace-nowrap">{inline(c)}</td>
              ))}</tr>
            ))}</tbody>
          </table>
        </div>
      );
      continue;
    }

    if (BULLET.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET.test(lines[i])) items.push(lines[i++].replace(BULLET, ''));
      out.push(
        <ul key={`u${i}`} className="list-disc pl-5 space-y-1 my-1.5">
          {items.map((it, n) => <li key={n} className="text-xs text-natural-700 leading-relaxed">{inline(it)}</li>)}
        </ul>
      );
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !BULLET.test(lines[i]) && !HEADING.test(lines[i]) && !HR.test(lines[i]) && !lines[i].trim().startsWith('|')) {
      para.push(lines[i++]);
    }
    out.push(<p key={`p${i}`} className="text-xs text-natural-700 leading-relaxed my-1.5">{inline(para.join(' '))}</p>);
  }

  return <div>{out}</div>;
}
