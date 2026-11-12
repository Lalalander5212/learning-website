#!/usr/bin/env node
// 레슨 검증. push 전에 `npm run check`로 돌림 (CI도 빌드 전에 돌림).
// 오류가 있으면 exit 1. 경고는 통과하지만 새 레슨에서는 0개여야 함. 규칙 설명은 CLAUDE.md.
//   node scripts/check-lessons.mjs            전체
//   node scripts/check-lessons.mjs --strict   경고도 오류로 취급
import fs from 'node:fs';
import path from 'node:path';
import { createProcessor } from '@mdx-js/mdx';
import remarkMath from 'remark-math';
import katex from 'katex';
import { TRACKS, DOCS_DIR, LESSON_FILE, listLessons, splitFrontmatter } from '../src/lib/lesson-files.mjs';
import { findLessonRefs } from '../src/lib/remark-lesson-links.mjs';

const strict = process.argv.includes('--strict');
const CODE_LANGS = new Set(['python', 'c', 'cpp', 'cuda', 'text', 'bash', 'sh', 'mdx', 'yaml', 'json', 'js', 'ts', 'asm', 'diff']);
// 보기는 사이트에서 섞이므로 위치·번호로 보기를 가리키면 안 됨
const POSITIONAL = [
  /정답은\s*\d\s*번/,
  /\d\s*번\s*(보기|선지)/,
  /\d\s*번(이|가)\s*(정답|맞)/,
  /(첫|두|세|네|다섯)\s*번째\s*(보기|선지)/,
  /(위|아래)(의)?\s*(보기|선지)/,
  /(보기|선지)\s*\d/,
  /(위|아래)\s*(모두|전부|둘 다)/,
];

const errors = [];
const warnings = [];
const rel = (f) => path.relative(DOCS_DIR, f);
const err = (file, line, rule, msg) => errors.push({ file: rel(file), line, rule, msg });
const warn = (file, line, rule, msg) => warnings.push({ file: rel(file), line, rule, msg });

const mdx = createProcessor({ remarkPlugins: [remarkMath] });
const SKIP_TEXT = new Set(['link', 'linkReference', 'heading', 'code', 'inlineCode', 'math', 'inlineMath', 'definition']);

function walk(node, fn, inSkipped = false) {
  fn(node, inSkipped);
  const skip = inSkipped || SKIP_TEXT.has(node.type);
  for (const c of node.children ?? []) walk(c, fn, skip);
}

function quizProps(node) {
  const out = {};
  for (const a of node.attributes ?? []) {
    if (a.type !== 'mdxJsxAttribute') continue;
    if (a.value && typeof a.value === 'object') {
      try { out[a.name] = new Function(`return (${a.value.value});`)(); } catch { out[a.name] = undefined; out[`${a.name}:bad`] = true; }
    } else out[a.name] = a.value === null ? true : a.value;
  }
  return out;
}

let nLessons = 0;
let nQuiz = 0;

// docs 아래 폴더는 전부 트랙이어야 함
for (const d of fs.readdirSync(DOCS_DIR, { withFileTypes: true })) {
  if (d.isDirectory() && !TRACKS.some((t) => t.id === d.name)) {
    err(path.join(DOCS_DIR, d.name), 0, 'track', `src/tracks.mjs에 없는 트랙 폴더. 트랙 id: ${TRACKS.map((t) => t.id).join(', ')}`);
  }
}

const allIds = new Set(TRACKS.flatMap((t) => listLessons(t.id).map((l) => l.id)));

for (const track of TRACKS) {
  const lessons = listLessons(track.id);
  const nums = new Map();
  const answers = [];

  for (const l of lessons) {
    nLessons++;
    const f = l.file;
    const src = fs.readFileSync(f, 'utf8');

    // ── 파일명 ──
    if (!LESSON_FILE.test(l.name)) err(f, 0, 'filename', '파일명은 NN-slug.mdx (두 자리 번호, 소문자·숫자·하이픈)');
    else if (nums.has(l.num)) err(f, 0, 'filename', `번호 ${l.num}가 ${nums.get(l.num)}와 겹침`);
    else nums.set(l.num, l.name);

    // ── frontmatter ──
    let fm;
    try { fm = splitFrontmatter(src); } catch (e) { err(f, 1, 'frontmatter', `YAML 오류: ${e.message.split('\n')[0]}`); continue; }
    const d = fm.data;
    if (!d) { err(f, 1, 'frontmatter', 'frontmatter 없음'); continue; }
    for (const k of ['title', 'description']) if (typeof d[k] !== 'string' || !d[k].trim()) err(f, 1, 'frontmatter', `${k} 없음`);
    if (d.track !== track.id) err(f, 1, 'track', `track: ${d.track} → 폴더명과 같은 ${track.id}여야 함`);
    if (typeof d.est !== 'string' || !/^\d+min$/.test(d.est)) err(f, 1, 'frontmatter', 'est는 "30min" 형식');
    else if (+d.est.slice(0, -3) < 15 || +d.est.slice(0, -3) > 45) warn(f, 1, 'length', `est ${d.est}: 레슨 하나는 20~40분. 길면 쪼갤 것`);
    const order = d.sidebar?.order;
    if (!Number.isInteger(order)) err(f, 1, 'frontmatter', 'sidebar.order 없음 (파일 번호와 같은 정수)');
    else if (l.num && order !== +l.num) err(f, 1, 'frontmatter', `sidebar.order ${order} ≠ 파일 번호 ${l.num}`);
    const isReview = d.module === 'review';
    if (track.modules) {
      if (!d.module) err(f, 1, 'module', `module 없음. ${track.id}의 모듈: ${track.modules.map((m) => m.id).join(', ')}`);
      else if (!track.modules.some((m) => m.id === d.module)) err(f, 1, 'module', `module: ${d.module} → src/tracks.mjs에 없음. 가능한 값: ${track.modules.map((m) => m.id).join(', ')}`);
    } else if (d.module) err(f, 1, 'module', `트랙 ${track.id}에는 modules가 정의돼 있지 않음 (src/tracks.mjs에 먼저 추가)`);
    for (const p of d.prereq ?? []) if (!allIds.has(p)) err(f, 1, 'prereq', `prereq ${p}: 없는 레슨 id`);

    // 탭·제어 문자 (스크립트로 생성할 때 \t, \a 같은 escape가 섞여 들어가는 경우)
    src.split('\n').forEach((ln, i) => {
      const c = /[\x00-\x08\x0b-\x1f\x7f]/.exec(ln) ?? (/\t/.test(ln) ? ["\t"] : null);
      if (c) err(f, i + 1, 'control-char', `제어 문자 U+${c[0].charCodeAt(0).toString(16).padStart(4, '0')}. 수식의 \\times, \\approx 같은 백슬래시가 escape로 바뀌었는지 확인`);
    });

    // ── MDX 파싱 (frontmatter 자리는 빈 줄로 채워 줄 번호 유지) ──
    const body = '\n'.repeat(fm.bodyLine - 1) + fm.body;
    let tree;
    try { tree = mdx.parse({ value: body, path: f }); }
    catch (e) { err(f, e.line ?? e.place?.line ?? 0, 'mdx', `MDX 문법 오류: ${e.reason ?? e.message} (코드블록·수식 밖의 { } < 는 \\로 이스케이프)`); continue; }

    let quizzes = 0;
    let hasEssay = false;
    let importsQuiz = false;

    walk(tree, (n, inSkipped) => {
      const line = n.position?.start.line ?? 0;

      if (n.type === 'mdxjsEsm' && /components\/Quiz\.astro/.test(n.value)) importsQuiz = true;

      if (n.type === 'math' || n.type === 'inlineMath') {
        try { katex.renderToString(n.value, { displayMode: n.type === 'math', throwOnError: true, strict: 'ignore' }); }
        catch (e) { err(f, line, 'math', `KaTeX 오류: ${String(e.message).replace(/^KaTeX parse error: /, '')}`); }
      }

      if (n.type === 'heading' && /inlineMath|math/.test(JSON.stringify(n.children.map((c) => c.type)))) {
        err(f, line, 'heading-math', '제목에 수식이 있으면 목차(TOC)에 KaTeX 텍스트가 깨져서 나옴. 수식은 제목 아래 본문으로');
      }

      if (n.type === 'code' && n.lang && !CODE_LANGS.has(n.lang)) warn(f, line, 'code-lang', `코드블록 언어 "${n.lang}"는 목록에 없음 (${[...CODE_LANGS].join(', ')})`);

      if (n.type === 'text' && !inSkipped) {
        for (const ref of findLessonRefs(n.value)) {
          for (const r of ref.nums) {
            if (!lessons.some((x) => x.num === r.num)) err(f, line, 'lesson-ref', `"${r.num}번 레슨": ${track.id}에 ${r.num}번 레슨이 없음`);
          }
          if (ref.nums.length === 1 && ref.nums[0].num === l.num) warn(f, line, 'lesson-ref', `"${l.num}번 레슨"이 자기 자신을 가리킴. "위 Worked example"처럼 섹션으로 가리킬 것`);
        }
        if (/(?<!\d)\d번 레슨/.test(n.value)) warn(f, line, 'lesson-ref', '레슨 참조는 두 자리로 ("7번 레슨" → "07번 레슨"). 한 자리는 링크가 안 걸림');
      }

      if ((n.type === 'mdxFlowExpression' || n.type === 'mdxTextExpression') && n.value.trim() && !/^\/\*[\s\S]*\*\/$/.test(n.value.trim())) {
        err(f, line, 'mdx', `본문의 {${n.value.slice(0, 30)}} 는 JS 표현식으로 실행됨. 글자 그대로 쓰려면 \\{ \\} 로 이스케이프하거나 코드/수식 안에 넣을 것`);
      }

      if (n.type === 'mdxJsxFlowElement' && n.name === 'details') hasEssay = true;

      if ((n.type === 'mdxJsxFlowElement' || n.type === 'mdxJsxTextElement') && n.name === 'Quiz') {
        quizzes++; nQuiz++;
        const p = quizProps(n);
        const tag = `퀴즈 ${quizzes}`;
        if (typeof p.q !== 'string' || !p.q.trim()) err(f, line, 'quiz', `${tag}: q 없음`);
        if (typeof p.explain !== 'string' || !p.explain.trim()) err(f, line, 'quiz', `${tag}: explain 없음`);
        if (!Array.isArray(p.options) || p.options.some((o) => typeof o !== 'string' || !o.trim())) { err(f, line, 'quiz', `${tag}: options는 문자열 배열`); return; }
        if (p.options.length < 2) err(f, line, 'quiz', `${tag}: 보기가 2개 미만`);
        else if (p.options.length !== 4) warn(f, line, 'quiz', `${tag}: 보기 ${p.options.length}개 (기본은 4개)`);
        if (new Set(p.options.map((o) => o.trim())).size !== p.options.length) err(f, line, 'quiz', `${tag}: 같은 보기가 두 번 나옴`);
        if (!Number.isInteger(p.answer) || p.answer < 0 || p.answer >= p.options.length) err(f, line, 'quiz', `${tag}: answer ${p.answer}가 보기 범위(0~${p.options.length - 1}) 밖`);
        else answers.push(p.answer);
        if (p.shuffle !== false) {
          const texts = [p.q, p.explain, ...p.options].filter((s) => typeof s === 'string');
          for (const re of POSITIONAL) {
            const hit = texts.map((s) => re.exec(s)).find(Boolean);
            if (hit) { err(f, line, 'quiz-position', `${tag}: "${hit[0]}" → 보기는 섞여서 나오므로 번호·위치로 가리키면 안 됨. 내용으로 가리킬 것`); break; }
          }
        }
      }
    });

    if (quizzes && !importsQuiz) err(f, 0, 'mdx', "Quiz를 쓰는데 import가 없음: import Quiz from '../../../components/Quiz.astro';");
    if (isReview) { if (quizzes < 5) warn(f, 0, 'quiz-count', `종합 레슨인데 퀴즈 ${quizzes}개 (5개 이상)`); }
    else if (quizzes < 3 || quizzes > 5) warn(f, 0, 'quiz-count', `퀴즈 ${quizzes}개 (레슨당 3~5개)`);
    if (!hasEssay) warn(f, 0, 'essay', '서술형 문제 없음 (레슨당 1문제 이상, <details> 풀이)');
  }

  // 정답 위치 쏠림 (보기는 섞이지만, 작성 습관을 잡기 위한 경고)
  if (answers.length >= 12) {
    const count = {};
    for (const a of answers) count[a] = (count[a] || 0) + 1;
    const [idx, n] = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    if (n / answers.length > 0.45) warn(path.join(DOCS_DIR, track.id), 0, 'answer-bias', `정답의 ${Math.round((n / answers.length) * 100)}%(${n}/${answers.length})가 answer={${idx}}. 새 퀴즈는 정답 위치를 고르게`);
  }
}

// ── 출력 ──
const fmt = (x) => `  ${x.file}${x.line ? ':' + x.line : ''}  ${x.msg}`;
function printGrouped(list) {
  const byRule = new Map();
  for (const x of list) byRule.set(x.rule, [...(byRule.get(x.rule) ?? []), x]);
  for (const [rule, items] of byRule) {
    const sameMsg = items.every((x) => x.msg === items[0].msg);
    if (sameMsg && items.length > 3) {
      console.log(`  [${rule}] ${items[0].msg}`);
      console.log(`    ${items.length}곳: ${items.map((x) => path.basename(x.file).slice(0, 2) + (x.line ? ':' + x.line : '')).join(', ')}`);
    } else {
      console.log(`  [${rule}]`);
      for (const x of items) console.log('  ' + fmt(x));
    }
  }
}

if (errors.length) { console.log(`\n✗ 오류 ${errors.length}개`); printGrouped(errors); }
if (warnings.length) { console.log(`\n⚠ 경고 ${warnings.length}개`); printGrouped(warnings); }
const failed = errors.length > 0 || (strict && warnings.length > 0);
console.log(`\n${failed ? '✗' : '✓'} 레슨 ${nLessons}개, 퀴즈 ${nQuiz}개 검사. 오류 ${errors.length}, 경고 ${warnings.length}`);
process.exit(failed ? 1 : 0);
