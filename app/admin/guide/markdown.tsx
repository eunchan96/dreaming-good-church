import type { ReactNode } from 'react';

/**
 * 사용 안내(docs/user-guide.md)에 쓰는 만큼만 읽는 작은 마크다운 변환기.
 * 제목(##, ###), 문단, 목록(-, 1.), 인용(>), 표, 그림, 굵게, `코드`, 링크.
 * 저장소 문서용 링크(.md)는 글자만 남기고, 그림 경로 ../public/… 는 사이트 주소로 바꾼다.
 */
export type Heading = { id: string; text: string };

const imageSrc = (src: string) => src.replace(/^(\.\.\/)*public\//, '/');

function inline(text: string, key = ''): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0, match: RegExpExecArray | null, n = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const k = `${key}-${n++}`;
    if (match[1] !== undefined) out.push(<strong key={k}>{inline(match[1], k)}</strong>);
    else if (match[2] !== undefined) out.push(<code key={k}>{match[2]}</code>);
    else if (/\.md(#.*)?$/.test(match[4]) || !/^(https?:|\/)/.test(match[4])) out.push(<span key={k}>{inline(match[3], k)}</span>);
    else out.push(<a key={k} href={match[4]} target="_blank" rel="noreferrer">{inline(match[3], k)}</a>);
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const isTable = (line: string) => /^\|.*\|$/.test(line.trim());
const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());

type Size = (src: string) => { width: number; height: number } | undefined;

function blocks(lines: string[], key: string, headings: Heading[], size: Size): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i], k = `${key}-${i}`;
    if (!line.trim()) { i++; continue; }
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading) {
      const text = heading[2].trim();
      if (heading[1] === '##') { const id = `guide-${headings.length + 1}`; headings.push({ id, text }); out.push(<h2 key={k} id={id} tabIndex={-1}>{inline(text, k)}</h2>); }
      else out.push(<h3 key={k}>{inline(text, k)}</h3>);
      i++; continue;
    }
    const image = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(line.trim());
    if (image) {
      // 캡처는 원래 크기로 열어 볼 수 있게 링크로 감싼다. 크기를 미리 주어 늦게 불러와도 페이지가 밀리지 않게(목차 이동이 중간에 멈추지 않게).
      // eslint-disable-next-line @next/next/no-img-element -- 크기가 제각각인 정적 캡처라 그대로 보여 준다.
      out.push(<figure key={k}><a href={imageSrc(image[2])} target="_blank" rel="noreferrer"><img src={imageSrc(image[2])} alt={image[1]} loading="lazy" {...size(imageSrc(image[2]))} /></a></figure>);
      i++; continue;
    }
    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''));
      out.push(<blockquote key={k}>{blocks(quote, k, headings, size)}</blockquote>);
      continue;
    }
    if (isTable(line)) {
      const rows: string[][] = [];
      while (i < lines.length && isTable(lines[i])) { if (!/^\|[\s:|-]+\|$/.test(lines[i].trim())) rows.push(cells(lines[i])); i++; }
      const [head, ...body] = rows;
      out.push(<div key={k} className="guide-table"><table><thead><tr>{head.map((cell, c) => <th key={c}>{inline(cell, `${k}h${c}`)}</th>)}</tr></thead>
        <tbody>{body.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{inline(cell, `${k}r${r}c${c}`)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    const list = /^(\s*)(-|\d+\.)\s+/.exec(line);
    if (list) {
      const ordered = list[2] !== '-', items: string[] = [];
      while (i < lines.length && /^(\s*)(-|\d+\.)\s+/.test(lines[i])) {
        let item = lines[i++].replace(/^\s*(-|\d+\.)\s+/, '');
        // 들여 쓴 다음 줄은 같은 항목으로 잇는다.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*(-|\d+\.)\s+/.test(lines[i])) item += ' ' + lines[i++].trim();
        items.push(item);
      }
      const children = items.map((item, n) => <li key={n}>{inline(item, `${k}-${n}`)}</li>);
      out.push(ordered ? <ol key={k}>{children}</ol> : <ul key={k}>{children}</ul>);
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|>|!\[|\s*(-|\d+\.)\s)/.test(lines[i]) && !isTable(lines[i])) paragraph.push(lines[i++].trim());
    out.push(<p key={k}>{paragraph.flatMap((text, n) => n ? [<br key={`b${n}`} />, ...inline(text, `${k}-${n}`)] : inline(text, `${k}-${n}`))}</p>);
  }
  return out;
}

/** 첫 줄의 `# 제목`은 따로 돌려주고 나머지를 그린다. */
export function renderGuide(source: string, size: Size = () => undefined) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const titleAt = lines.findIndex(line => /^#\s+/.test(line));
  const title = titleAt >= 0 ? lines[titleAt].replace(/^#\s+/, '').trim() : '사용 안내';
  const headings: Heading[] = [];
  const body = blocks(lines.filter((_, index) => index !== titleAt), 'g', headings, size);
  return { title, body, headings };
}
