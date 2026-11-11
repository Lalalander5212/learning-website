// 기기 간 sync: 비공개 GitHub Gist 파일 하나에 진행상황 JSON을 저장.
// 토큰은 이 브라우저의 localStorage에만 있고 api.github.com으로만 전송됨.
import { load, save, merge, normalize, stable, type State } from './store';

const CKEY = 'lw-sync';
const DIRTY = 'lw-sync-dirty';
const FILE = 'vasco-learn-progress.json';
const API = 'https://api.github.com';

export type SyncCfg = { token: string; gistId: string; last?: number; err?: string };

export function getCfg(): SyncCfg | null {
  try {
    const c = JSON.parse(localStorage.getItem(CKEY) || 'null');
    return c && c.token && c.gistId ? c : null;
  } catch { return null; }
}
function setCfg(c: SyncCfg | null) {
  try {
    if (c) localStorage.setItem(CKEY, JSON.stringify(c));
    else localStorage.removeItem(CKEY);
  } catch {}
  window.dispatchEvent(new CustomEvent('lw:sync'));
}

function explain(status: number) {
  if (status === 401) return '토큰이 잘못됐거나 만료됨. 새 토큰으로 다시 연결해야 함';
  if (status === 403 || status === 404) return '토큰에 Gists 권한(Read and write)이 있는지 확인 필요';
  return `GitHub 응답 오류 (${status})`;
}

async function gh(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) throw new Error(explain(res.status));
  return res.json();
}

const body = (s: State) => JSON.stringify({ files: { [FILE]: { content: JSON.stringify(s, null, 1) } } });

/** 토큰으로 연결. 기존 sync용 gist가 있으면 그걸 쓰고 없으면 비공개로 새로 만듦. */
export async function connect(token: string) {
  token = token.trim();
  const list: any[] = await gh(token, '/gists?per_page=100');
  let gist = list.find((g) => g.files && g.files[FILE]);
  if (!gist) {
    gist = await gh(token, '/gists', {
      method: 'POST',
      body: JSON.stringify({
        description: 'Vasco Learn 진행상황 (자동 sync)',
        public: false,
        files: { [FILE]: { content: JSON.stringify(load(), null, 1) } },
      }),
    });
  }
  setCfg({ token, gistId: gist.id });
  await syncNow();
}

export function disconnect() {
  setCfg(null);
}

let running: Promise<void> | null = null;
let again = false;

/** 원격을 받아서 로컬과 합치고, 원격이 뒤처져 있으면 올림 */
export function syncNow(): Promise<void> {
  if (running) { again = true; return running; }
  running = (async () => {
    const c = getCfg();
    if (!c) return;
    try {
      const gist = await gh(c.token, `/gists/${c.gistId}`);
      const f = gist.files?.[FILE];
      let text: string = f?.content ?? '{}';
      if (f?.truncated && f.raw_url) text = await (await fetch(f.raw_url)).text();
      let remote: State;
      try { remote = normalize(JSON.parse(text)); } catch { remote = normalize(null); }

      const local = load();
      const merged = merge(local, remote);
      if (stable(merged) !== stable(local)) save(merged, true);
      if (stable(merged) !== stable(remote)) {
        await gh(c.token, `/gists/${c.gistId}`, { method: 'PATCH', body: body(merged) });
      }
      // sync 도중에 로컬이 또 바뀌었으면 dirty를 유지
      if (stable(load()) === stable(merged)) localStorage.removeItem(DIRTY);
      setCfg({ ...c, last: Date.now(), err: undefined });
    } catch (e: any) {
      setCfg({ ...c, err: e?.message || '네트워크 오류' });
      throw e;
    }
  })().finally(() => {
    running = null;
    if (again) { again = false; syncNow().catch(() => {}); }
  });
  return running;
}

/** 페이지 로드 때 한 번 받고, 이후 변경이 생기면 잠시 뒤에 올림 */
export function initAutoSync() {
  if (!getCfg()) return;
  let timer: number | undefined;
  const dirty = () => localStorage.getItem(DIRTY) === '1';
  const c = getCfg()!;
  if (dirty() || !c.last || Date.now() - c.last > 5_000) syncNow().catch(() => {});

  window.addEventListener('lw:change', (e) => {
    if ((e as CustomEvent).detail?.fromSync || !getCfg()) return;
    clearTimeout(timer);
    timer = window.setTimeout(() => syncNow().catch(() => {}), 1500);
  });
  // 탭을 떠날 때 아직 안 올라간 변경이 있으면 바로 sync
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !getCfg() || !dirty()) return;
    clearTimeout(timer);
    syncNow().catch(() => {});
  });
}
