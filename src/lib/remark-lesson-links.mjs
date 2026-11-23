// 본문의 "16번 레슨", "10~12번 레슨", "08, 09번 레슨"을 같은 트랙의 레슨 링크로 바꿈.
// "05번 레슨(#data-hazard)"처럼 뒤에 (#앵커)를 붙이면 그 섹션으로 바로 가는 링크가 되고, (#...)는 화면에 안 보임.
// 번호는 파일명 앞의 두 자리(NN). 없는 번호와 없는 앵커는 그대로 두고 scripts/check-lessons.mjs가 오류로 잡음.
import path from 'node:path';
import { DOCS_DIR, listLessons, lessonHeadings } from './lesson-files.mjs';

/**
 * 텍스트에서 레슨 참조를 찾음.
 * 반환: [{ index, length, textLength, anchor, nums: [{ num, start, end }] }]
 * start/end는 매치 안의 위치. textLength는 (#앵커)를 뺀, 화면에 남길 길이.
 */
export const LESSON_REF = /(?<!\d)(\d{2}(?:\s*[~–,-]\s*\d{2})*)번 레슨(?:\(#([^)\s]+)\))?/g;

export function findLessonRefs(text) {
  const out = [];
  for (const m of text.matchAll(LESSON_REF)) {
    const nums = [...m[1].matchAll(/\d{2}/g)].map((n) => ({ num: n[0], start: n.index, end: n.index + 2 }));
    const anchor = m[2] ?? null;
    out.push({ index: m.index, length: m[0].length, textLength: m[0].length - (anchor ? anchor.length + 3 : 0), anchor, nums });
  }
  return out;
}

const SKIP = new Set(['link', 'linkReference', 'heading', 'code', 'inlineCode', 'math', 'inlineMath', 'definition']);

export function remarkLessonLinks({ base = '', docsDir = DOCS_DIR } = {}) {
  const root = base.replace(/\/$/, '');
  return (tree, file) => {
    const p = file?.path ?? file?.history?.[0];
    if (!p) return;
    const rel = path.relative(docsDir, p).split(path.sep);
    if (rel.length !== 2 || rel[0] === '..') return;
    const [track, name] = rel;
    const byNum = new Map(listLessons(track, docsDir).filter((l) => l.num).map((l) => [l.num, l]));
    if (!byNum.size) return;

    const linkTo = (l, value, anchor) => {
      const h = anchor ? lessonHeadings(l.file).find((x) => x.slug === anchor) : null;
      return {
        type: 'link',
        url: `${root}/${l.id}/${h ? `#${h.slug}` : ''}`,
        title: h ? `${l.data.title ?? ''} › ${h.text}` : l.data.title ?? null,
        data: { hProperties: { className: ['lw-ref'] } },
        children: [{ type: 'text', value }],
      };
    };

    const split = (value) => {
      const refs = findLessonRefs(value);
      if (!refs.length) return null;
      const out = [];
      let pos = 0;
      const text = (to) => { if (to > pos) out.push({ type: 'text', value: value.slice(pos, to) }); pos = to; };
      for (const ref of refs) {
        const anchor = ref.nums.length === 1 ? ref.anchor : null; // 앵커는 번호 하나일 때만
        ref.nums.forEach((n, k) => {
          const last = k === ref.nums.length - 1;
          const from = ref.index + n.start;
          const to = last ? ref.index + ref.textLength : ref.index + n.end; // 마지막 번호는 "번 레슨"까지 링크
          const target = byNum.get(n.num);
          if (!target || target.name === name) return; // 없는 번호, 자기 자신은 그대로
          text(from);
          out.push(linkTo(target, value.slice(from, to), last ? anchor : null));
          pos = last ? ref.index + ref.length : to; // (#앵커) 글자는 버림
        });
      }
      text(value.length);
      return out.some((n) => n.type === 'link') ? out : null;
    };

    const walk = (node) => {
      if (!node.children || SKIP.has(node.type)) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.type === 'text') {
          const parts = split(child.value);
          if (parts) { node.children.splice(i, 1, ...parts); i += parts.length - 1; }
        } else walk(child);
      }
    };
    walk(tree);
  };
}
