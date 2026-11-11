// 복습 페이지: 오늘 due인 퀴즈를 레슨 페이지에서 가져와 한 문제씩 보여줌
import { load, update, dueKeys, nextDue, lessonOf, recordReview, fmtDate, INTERVALS } from './store';
import { mountQuiz, type QuizHandle } from './quiz';
import { isTyping } from './ui';

type L = { id: string; title: string; href: string };

export async function initReview() {
  const root = document.getElementById('review');
  if (!root) return;
  const { lessons, home } = JSON.parse(root.dataset.json!) as { lessons: L[]; home: string };
  const byId = new Map(lessons.map((l) => [l.id, l]));
  const valid = (id: string) => byId.has(id);
  const status = document.getElementById('rv-status')!;
  const card = document.getElementById('rv-card')!;
  const actions = document.getElementById('rv-actions')!;
  const nextBtn = document.getElementById('rv-next') as HTMLButtonElement;

  const link = (text: string, href: string, cls = 'lw-btn') => {
    const a = document.createElement('a');
    a.className = cls; a.href = href; a.textContent = text;
    return a;
  };
  const para = (text: string, cls = '') => {
    const p = document.createElement('p');
    if (cls) p.className = cls;
    p.textContent = text;
    return p;
  };

  function showEmpty() {
    const nd = nextDue(load(), valid);
    status.textContent = '오늘 복습할 문제 없음';
    card.replaceChildren(
      para(nd ? `다음 복습은 ${fmtDate(nd.date)}, ${nd.count}문제.` : '레슨의 퀴즈를 풀면 여기에 복습 일정이 잡힘.', 'rv-note'),
      link('대시보드로', home)
    );
  }

  const keys = dueKeys(load(), valid);
  if (!keys.length) return showEmpty();

  // 레슨 페이지 HTML에서 퀴즈 블록을 꺼냄
  const pages = new Map<string, HTMLElement[] | null>();
  await Promise.all(
    [...new Set(keys.map(lessonOf))].map(async (id) => {
      try {
        const res = await fetch(byId.get(id)!.href);
        if (!res.ok) throw new Error();
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        pages.set(id, [...doc.querySelectorAll<HTMLElement>('.sl-markdown-content .quiz')]);
      } catch { pages.set(id, null); }
    })
  );

  const queue: { key: string; lesson: L; node: HTMLElement }[] = [];
  const gone: string[] = [];
  let failed = 0;
  for (const key of keys) {
    const id = lessonOf(key);
    const list = pages.get(id);
    if (list === null || list === undefined) { failed++; continue; }
    const node = list[Number(key.slice(key.lastIndexOf('#') + 1))];
    if (node) queue.push({ key, lesson: byId.get(id)!, node });
    else gone.push(key);
  }
  // 레슨이 수정돼서 없어진 문제는 일정에서 뺌
  if (gone.length) update((s) => { for (const k of gone) s.review[k] = { stage: INTERVALS.length - 1, due: '9999-12-31', t: Date.now() }; });

  if (!queue.length) {
    if (failed) { status.textContent = '문제를 불러오지 못함'; card.replaceChildren(para('네트워크 연결을 확인하고 새로고침하면 됨.', 'rv-note')); }
    else showEmpty();
    return;
  }

  let i = 0;
  let right = 0;
  let current: QuizHandle | null = null;

  function show() {
    const item = queue[i];
    status.textContent = `${i + 1} / ${queue.length}`;
    const from = para('', 'rv-from');
    from.append('출처: ', link(item.lesson.title, item.lesson.href, ''));
    const node = document.importNode(item.node, true);
    card.replaceChildren(node, from);
    actions.hidden = true;
    current = mountQuiz(node, {
      mode: 'review',
      onDone: (ok) => {
        if (ok) right++;
        update((s) => recordReview(s, item.key, ok));
        nextBtn.textContent = i === queue.length - 1 ? '결과 보기' : '다음 문제';
        actions.hidden = false;
        nextBtn.focus({ preventScroll: true });
      },
    });
  }

  function advance() {
    if (!current?.solved()) return;
    i++;
    if (i < queue.length) return show();
    current = null;
    actions.hidden = true;
    status.textContent = '복습 끝';
    const wrong = queue.length - right;
    card.replaceChildren(
      para(`${queue.length}문제 중 ${right}개 맞음.`, 'rv-result'),
      para(wrong ? `틀린 ${wrong}문제는 내일 다시 나옴. 맞은 문제는 간격이 늘어남.` : '전부 맞아서 다음 복습 간격이 늘어남.', 'rv-note'),
      link('대시보드로', home, 'lw-btn primary')
    );
  }

  nextBtn.addEventListener('click', advance);
  document.addEventListener('keydown', (e) => {
    if (isTyping(e) || document.querySelector('dialog[open]')) return;
    if (/^[1-9]$/.test(e.key)) current?.press(Number(e.key));
    else if (e.key === 'Enter' && document.activeElement !== nextBtn) advance();
  });

  show();
}
