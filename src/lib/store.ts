// 진행상황 저장소 (localStorage). 모든 레코드에 타임스탬프 t가 있어서
// 기기 간 sync 때 레코드 단위로 최신 것을 고름.
const KEY = 'lw-progress-v2';
const OLD_KEY = 'lw-progress-v1';

export type DoneRec = { d: string | null; t: number };
export type QuizRec = { a: boolean; first: boolean | null; t: number };
export type ReviewRec = { stage: number; due: string; t: number };
export type NoteRec = { text: string; t: number };
export type State = {
  v: 2;
  done: Record<string, DoneRec>;
  quiz: Record<string, QuizRec>; // key: `${lessonId}#${index}`
  review: Record<string, ReviewRec>; // key: `${lessonId}#${index}`
  notes: Record<string, NoteRec>;
  activity: Record<string, number>; // 날짜별 활동 수
  settings: { gate: boolean; t: number };
};

export const INTERVALS = [1, 3, 7, 14, 30, 60]; // 복습 간격(일)

export const dstr = (d: Date) => d.toLocaleDateString('en-CA');
export const today = () => dstr(new Date());
export function addDays(date: string, n: number) {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return dstr(d);
}
export const qkey = (lesson: string, i: number) => `${lesson}#${i}`;
export const lessonOf = (key: string) => key.slice(0, key.lastIndexOf('#'));

export function empty(): State {
  return { v: 2, done: {}, quiz: {}, review: {}, notes: {}, activity: {}, settings: { gate: true, t: 0 } };
}

export function normalize(p: any): State {
  const s = empty();
  if (!p || typeof p !== 'object') return s;
  for (const [k, v] of Object.entries(p.done || {})) {
    // v1: done[id] = 'YYYY-MM-DD'
    if (typeof v === 'string') s.done[k] = { d: v, t: Date.parse(v + 'T12:00:00') || 1 };
    else if (v && typeof v === 'object') s.done[k] = v as DoneRec;
  }
  for (const f of ['quiz', 'review', 'notes'] as const) {
    for (const [k, v] of Object.entries(p[f] || {})) if (v && typeof v === 'object') (s[f] as any)[k] = v;
  }
  for (const [k, v] of Object.entries(p.activity || {})) if (typeof v === 'number') s.activity[k] = v;
  if (p.settings && typeof p.settings === 'object') s.settings = { gate: p.settings.gate !== false, t: p.settings.t || 0 };
  // v1에는 activity가 없었으니 완료 날짜로 채움
  if (!p.v) for (const r of Object.values(s.done)) if (r.d) s.activity[r.d] = (s.activity[r.d] || 0) + 1;
  return s;
}

export function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
    const old = localStorage.getItem(OLD_KEY);
    if (old) return normalize(JSON.parse(old));
  } catch {}
  return empty();
}

/** 저장하고 화면 갱신 이벤트를 보냄. fromSync면 sync 쪽에서 다시 push하지 않음. */
export function save(s: State, fromSync = false) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    if (!fromSync) localStorage.setItem('lw-sync-dirty', '1');
  } catch {}
  window.dispatchEvent(new CustomEvent('lw:change', { detail: { fromSync } }));
}

export function update(fn: (s: State) => void) {
  const s = load();
  fn(s);
  save(s);
}

const newer = <T extends { t: number }>(x?: T, y?: T) => (!x ? y! : !y ? x : y.t > x.t ? y : x);

export function merge(a: State, b: State): State {
  const out = empty();
  for (const f of ['done', 'quiz', 'review', 'notes'] as const) {
    const keys = new Set([...Object.keys(a[f]), ...Object.keys(b[f])]);
    for (const k of keys) (out[f] as any)[k] = newer((a[f] as any)[k], (b[f] as any)[k]);
  }
  for (const k of new Set([...Object.keys(a.activity), ...Object.keys(b.activity)])) {
    out.activity[k] = Math.max(a.activity[k] || 0, b.activity[k] || 0);
  }
  out.settings = newer(a.settings, b.settings);
  return out;
}

/** 키 순서와 무관하게 비교할 수 있는 직렬화 */
export function stable(v: any): string {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

export const isDone = (s: State, id: string) => !!s.done[id]?.d;
export function setDone(s: State, id: string, done: boolean) {
  s.done[id] = { d: done ? today() : null, t: Date.now() };
  bump(s, done ? 1 : -1);
}
export function bump(s: State, n = 1) {
  const d = today();
  s.activity[d] = Math.max(0, (s.activity[d] || 0) + n);
}

export function streak(s: State) {
  const has = (d: string) => (s.activity[d] || 0) > 0;
  let d = today();
  if (!has(d)) d = addDays(d, -1);
  let n = 0;
  while (has(d)) { n++; d = addDays(d, -1); }
  return n;
}

/** 레슨에서 퀴즈를 처음 풀었을 때 복습 일정에 넣음 */
export function recordQuiz(s: State, key: string, first: boolean) {
  const prev = s.quiz[key];
  s.quiz[key] = { a: true, first: prev?.first ?? first, t: Date.now() };
  if (!s.review[key]) {
    const stage = first ? 1 : 0;
    s.review[key] = { stage, due: addDays(today(), INTERVALS[stage]), t: Date.now() };
  }
  bump(s);
}

/** 복습 결과 반영: 맞으면 간격을 늘리고, 틀리면 내일 다시 */
export function recordReview(s: State, key: string, ok: boolean) {
  const cur = s.review[key]?.stage ?? 0;
  const stage = ok ? Math.min(cur + 1, INTERVALS.length - 1) : 0;
  s.review[key] = { stage, due: addDays(today(), INTERVALS[stage]), t: Date.now() };
  bump(s);
}

export function dueKeys(s: State, valid?: (lessonId: string) => boolean) {
  const t = today();
  return Object.keys(s.review)
    .filter((k) => s.review[k].due <= t && (!valid || valid(lessonOf(k))))
    .sort((x, y) => s.review[x].due.localeCompare(s.review[y].due) || x.localeCompare(y));
}

export function nextDue(s: State, valid?: (lessonId: string) => boolean) {
  const t = today();
  const later = Object.keys(s.review).filter((k) => s.review[k].due > t && (!valid || valid(lessonOf(k))));
  if (!later.length) return null;
  const date = later.map((k) => s.review[k].due).sort()[0];
  return { date, count: later.filter((k) => s.review[k].due === date).length };
}

export function quizCount(s: State, lessonId: string) {
  return Object.keys(s.quiz).filter((k) => lessonOf(k) === lessonId && s.quiz[k].a).length;
}

export function firstTryRate(s: State) {
  const recs = Object.values(s.quiz).filter((r) => r.first !== null);
  if (!recs.length) return null;
  return Math.round((recs.filter((r) => r.first).length / recs.length) * 100);
}

export const fmtDate = (d: string) => {
  const [, m, day] = d.split('-').map(Number);
  return `${m}월 ${day}일`;
};
