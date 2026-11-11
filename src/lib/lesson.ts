// 레슨 페이지 동작: 퀴즈 저장, 완료하고 다음으로, 메모, 읽기 진행 바, 위치 복원, 단축키
import { load, update, isDone, setDone, recordQuiz, qkey, fmtDate } from './store';
import { mountQuiz, type QuizHandle } from './quiz';
import { toast, isTyping } from './ui';

const SCROLL_KEY = 'lw-scroll';

export function initLesson() {
  const root = document.querySelector<HTMLElement>('.lw-lesson[data-lesson-id]');
  if (!root) return;
  const id = root.dataset.lessonId!;
  const next = root.dataset.next || '';
  const prev = root.dataset.prev || '';
  const home = root.dataset.home!;
  document.documentElement.classList.add('lw-is-lesson');

  // ── 퀴즈 ──────────────────────────────────────────────
  const quizEls = [...document.querySelectorAll<HTMLElement>('.sl-markdown-content .quiz')];
  const quizzes: QuizHandle[] = quizEls.map((el, i) =>
    mountQuiz(el, {
      mode: 'learn',
      onDone: (first) => update((s) => recordQuiz(s, qkey(id, i), first)),
      onReset: () => update((s) => { s.quiz[qkey(id, i)] = { a: false, first: s.quiz[qkey(id, i)]?.first ?? null, t: Date.now() }; }),
    })
  );
  const unanswered = () => quizzes.filter((q) => !q.solved());

  // ── 화면 갱신 ─────────────────────────────────────────
  const mains = [...root.querySelectorAll<HTMLButtonElement>('.lw-main')];
  const status = document.getElementById('lw-status')!;
  const chip = document.getElementById('lw-quizchip') as HTMLAnchorElement | null;
  const note = document.getElementById('lw-note') as HTMLTextAreaElement;
  const notes = root.querySelector<HTMLDetailsElement>('.lw-notes')!;
  let first = true;

  function render() {
    const s = load();
    quizzes.forEach((q, i) => {
      const solved = !!s.quiz[qkey(id, i)]?.a;
      if (solved && !q.solved()) q.showSolved();
      if (!solved && q.solved()) q.reset(true);
    });
    const left = unanswered().length;
    if (chip && quizzes.length) {
      chip.hidden = false;
      chip.textContent = `퀴즈 ${quizzes.length - left}/${quizzes.length}`;
      chip.classList.toggle('is-full', left === 0);
    }
    document.querySelectorAll<HTMLElement>('.lw-pre a[data-pre]').forEach((a) => {
      a.classList.toggle('is-done', isDone(s, a.dataset.pre!));
    });

    const done = isDone(s, id);
    const gated = !done && s.settings.gate && left > 0;
    const label = done
      ? next ? '다음 레슨' : '대시보드로'
      : gated ? `퀴즈 ${left}문제 남음`
      : next ? '완료하고 다음 레슨' : '완료하고 대시보드로';
    mains.forEach((b) => { b.textContent = label; b.classList.toggle('is-gated', gated); });
    root.classList.toggle('is-done', done);

    status.replaceChildren();
    if (done) {
      status.append(`${fmtDate(s.done[id].d!)}에 완료함 `);
      const undo = document.createElement('button');
      undo.type = 'button';
      undo.className = 'lw-link';
      undo.textContent = '완료 취소';
      undo.onclick = () => update((st) => setDone(st, id, false));
      status.append(undo);
    }

    if (document.activeElement !== note) note.value = s.notes[id]?.text ?? '';
    if (first && note.value) notes.open = true;
    first = false;
  }

  function mainAction() {
    const s = load();
    if (isDone(s, id)) { location.href = next || home; return; }
    const left = unanswered();
    if (s.settings.gate && left.length) {
      left[0].el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast(`퀴즈 ${left.length}문제를 풀면 완료할 수 있음`);
      return;
    }
    update((st) => setDone(st, id, true));
    clearScroll();
    location.href = next || home;
  }
  mains.forEach((b) => b.addEventListener('click', mainAction));
  chip?.addEventListener('click', (e) => {
    e.preventDefault();
    (unanswered()[0] ?? quizzes[0])?.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // ── 메모 (자동 저장) ──────────────────────────────────
  let noteTimer: number | undefined;
  const saveNote = () => update((s) => { s.notes[id] = { text: note.value, t: Date.now() }; });
  note.addEventListener('input', () => {
    clearTimeout(noteTimer);
    noteTimer = window.setTimeout(saveNote, 500);
  });
  note.addEventListener('blur', () => {
    clearTimeout(noteTimer);
    if ((load().notes[id]?.text ?? '') !== note.value) saveNote();
  });

  // ── 읽기 진행 바 + 위치 저장 ──────────────────────────
  const fill = document.getElementById('lw-readfill')!;
  const pct = document.getElementById('lw-pct')!;
  const scrollMap = (): Record<string, number> => {
    try { return JSON.parse(localStorage.getItem(SCROLL_KEY) || '{}'); } catch { return {}; }
  };
  function clearScroll() {
    const m = scrollMap();
    delete m[id];
    try { localStorage.setItem(SCROLL_KEY, JSON.stringify(m)); } catch {}
  }
  let ticking = false;
  let lastSave = 0;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, scrollY / max) : 1;
      fill.style.transform = `scaleX(${p})`;
      pct.textContent = `${Math.round(p * 100)}%`;
      if (Date.now() - lastSave > 500) {
        lastSave = Date.now();
        const m = scrollMap();
        if (scrollY > 400 && p < 0.97) m[id] = Math.round(scrollY); else delete m[id];
        try { localStorage.setItem(SCROLL_KEY, JSON.stringify(m)); } catch {}
      }
    });
  }

  // 읽다 만 위치로 복원 (완료한 레슨이나 #링크로 들어온 경우는 제외)
  const savedY = scrollMap()[id];
  if (savedY && !location.hash && !isDone(load(), id) && scrollY < 50) {
    requestAnimationFrame(() => {
      scrollTo(0, savedY);
      toast('읽던 위치로 이동함', { label: '처음부터 보기', run: () => scrollTo({ top: 0, behavior: 'smooth' }) });
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── 단축키 ────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (isTyping(e) || document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if (k === 'j' && next) location.href = next;
    else if (k === 'k' && prev) location.href = prev;
    else if (k === 'd') mainAction();
    else if (/^[1-9]$/.test(e.key)) {
      const open = unanswered();
      if (!open.length) return;
      const visible = open.find((q) => {
        const r = q.el.getBoundingClientRect();
        return r.top < innerHeight * 0.85 && r.bottom > 90;
      });
      if (visible) visible.press(Number(e.key));
      else open[0].el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  window.addEventListener('lw:change', render);
  render();
}
