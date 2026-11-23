// Node 전용 (빌드 설정, remark 플러그인, 검증 스크립트가 같이 씀).
// 레슨 파일을 디스크에서 직접 읽어 frontmatter와 번호(NN)를 돌려줌.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import GithubSlugger from 'github-slugger';
import { TRACKS } from '../tracks.mjs';

export const DOCS_DIR = fileURLToPath(new URL('../content/docs/', import.meta.url));
export const LESSON_FILE = /^(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.mdx$/;

/** 파일 내용에서 frontmatter 객체와 본문을 분리. frontmatter가 없으면 data는 null */
export function splitFrontmatter(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return { data: null, body: src, bodyLine: 1 };
  return { data: YAML.parse(m[1]) ?? {}, body: src.slice(m[0].length), bodyLine: m[0].split('\n').length };
}

/** 제목 텍스트에서 마크다운 기호를 걷어냄 (Astro가 id를 만들 때 보는 글자와 맞추기 위함) */
function headingText(raw) {
  return raw
    .replace(/\s+#+\s*$/, '')                 // 닫는 #
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')   // 링크, 이미지
    .replace(/<[^>]+>/g, '')                    // HTML/JSX 태그
    .replace(/\\([\\`*_{}\[\]()#+\-.!<>])/g, '$1') // 이스케이프
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__|\*|_)(.+?)\1/g, '$2')
    .trim();
}

const headingCache = new Map();
/**
 * 레슨 파일의 ##~###### 제목과 id(앵커). Astro처럼 github-slugger로 만들고, 같은 제목은 -1, -2가 붙음.
 * 반환: [{ depth, text, slug }]
 */
export function lessonHeadings(file) {
  const mtime = fs.statSync(file).mtimeMs;
  const hit = headingCache.get(file);
  if (hit && hit.mtime === mtime) return hit.headings;
  const { body } = splitFrontmatter(fs.readFileSync(file, 'utf8'));
  const slugger = new GithubSlugger();
  const headings = [];
  let fence = null;
  for (const line of body.split('\n')) {
    const f = /^\s*(```+|~~~+)/.exec(line);
    if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = null; continue; }
    if (fence) continue;
    const m = /^(#{2,6})\s+(.+)$/.exec(line);
    if (!m) continue;
    const text = headingText(m[2]);
    headings.push({ depth: m[1].length, text, slug: slugger.slug(text) });
  }
  headingCache.set(file, { mtime, headings });
  return headings;
}

/** 트랙 폴더의 레슨들. sidebar.order → 파일명 순으로 정렬 */
export function listLessons(trackId, docsDir = DOCS_DIR) {
  const dir = path.join(docsDir, trackId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => {
      const file = path.join(dir, f);
      const m = LESSON_FILE.exec(f);
      let data = {};
      try { data = splitFrontmatter(fs.readFileSync(file, 'utf8')).data ?? {}; } catch {}
      const slug = f.replace(/\.mdx?$/, '');
      return { file, name: f, slug, id: `${trackId}/${slug}`, num: m ? m[1] : null, data, order: data?.sidebar?.order ?? 999 };
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/**
 * Starlight 사이드바 항목. 모듈이 있는 트랙은 모듈별 그룹으로 묶고,
 * 레슨이 하나뿐인 모듈이나 모듈이 없는 레슨은 링크 하나로 둠.
 */
export function trackSidebar(track, docsDir = DOCS_DIR) {
  const lessons = listLessons(track.id, docsDir);
  if (!lessons.length) return null;
  const items = [];
  const titleOf = (id) => track.modules?.find((m) => m.id === id)?.title;
  let group = null;
  for (const l of lessons) {
    const mod = titleOf(l.data.module) ? l.data.module : null;
    if (mod && group?.mod === mod) { group.items.push({ slug: l.id }); continue; }
    group = mod ? { mod, label: titleOf(mod), collapsed: true, items: [{ slug: l.id }] } : null;
    items.push(group ?? { slug: l.id });
  }
  return {
    label: track.title,
    items: items.map((it) => {
      if (!it.mod) return it;
      if (it.items.length === 1) return it.items[0];
      const { mod, ...rest } = it;
      return rest;
    }),
  };
}

export { TRACKS };
