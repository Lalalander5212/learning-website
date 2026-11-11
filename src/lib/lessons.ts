// 빌드 타임: 레슨 목록을 트랙 순서 → sidebar.order → id 순으로 정렬해서 돌려줌
import { getCollection } from 'astro:content';
import { TRACKS } from '../tracks.mjs';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (p = '') => `${BASE}/${p.replace(/^\//, '')}`;

export type Lesson = {
  id: string;
  title: string;
  track: string;
  trackTitle: string;
  est?: string;
  prereq: string[];
  href: string;
  pos: number; // 트랙 안에서 몇 번째 (1부터)
  total: number; // 트랙의 레슨 수
};

let cache: Promise<Lesson[]> | undefined;

export function getLessons(): Promise<Lesson[]> {
  cache ??= (async () => {
    const ti = (t: string) => {
      const i = TRACKS.findIndex((x) => x.id === t);
      return i < 0 ? 999 : i;
    };
    const docs = (await getCollection('docs')).filter((e) => e.data.track);
    docs.sort(
      (a, b) =>
        ti(a.data.track!) - ti(b.data.track!) ||
        (a.data.sidebar?.order ?? 999) - (b.data.sidebar?.order ?? 999) ||
        a.id.localeCompare(b.id)
    );
    const counts: Record<string, number> = {};
    for (const e of docs) counts[e.data.track!] = (counts[e.data.track!] || 0) + 1;
    const seen: Record<string, number> = {};
    return docs.map((e) => {
      const track = e.data.track!;
      seen[track] = (seen[track] || 0) + 1;
      return {
        id: e.id,
        title: e.data.title,
        track,
        trackTitle: TRACKS.find((t) => t.id === track)?.title ?? track,
        est: e.data.est,
        prereq: e.data.prereq ?? [],
        href: url(e.id + '/'),
        pos: seen[track],
        total: counts[track],
      };
    });
  })();
  return cache;
}

export { TRACKS };
