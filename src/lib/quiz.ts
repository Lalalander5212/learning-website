export type QuizHandle = {
  el: HTMLElement;
  solved: () => boolean;
  press: (n: number) => void;
  showSolved: () => void;
  reset: (silent?: boolean) => void;
};

type Opts = {
  /** learn: 맞을 때까지 다시 고를 수 있음. review: 첫 선택으로 채점하고 정답 공개 */
  mode: 'learn' | 'review';
  onDone: (firstTry: boolean) => void;
  onReset?: () => void;
};

export function mountQuiz(el: HTMLElement, o: Opts): QuizHandle {
  const ans = Number(el.dataset.answer);
  const list = el.querySelector<HTMLElement>('.quiz-opts');
  // opts는 화면에 보이는 순서. 원래(작성) 순서는 data-i에 남겨서 정답 판정에 씀
  let opts = [...el.querySelectorAll<HTMLButtonElement>('button.quiz-opt')];
  opts.forEach((b, i) => { b.dataset.i ??= String(i); });
  const isAns = (b: HTMLButtonElement) => Number(b.dataset.i) === ans;
  const explain = el.querySelector<HTMLElement>('.quiz-explain');
  const resetBtn = el.querySelector<HTMLButtonElement>('.quiz-reset');
  let missed = false;
  let solved = false;

  // 정답 위치를 외우지 않도록 보기 순서를 섞음 (Fisher–Yates). 단축키 번호는 보이는 순서 기준
  function shuffle() {
    if (!list || el.dataset.shuffle === 'off' || opts.length < 3) return;
    const items = [...list.children];
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    list.append(...items);
    opts = [...el.querySelectorAll<HTMLButtonElement>('button.quiz-opt')];
    opts.forEach((b, i) => { const k = b.querySelector('kbd'); if (k) k.textContent = String(i + 1); });
  }

  function finish() {
    solved = true;
    opts.forEach((b) => { b.disabled = true; if (isAns(b)) b.classList.add('is-right'); });
    if (explain) explain.hidden = false;
    if (resetBtn) resetBtn.hidden = o.mode !== 'learn';
    el.classList.add('is-solved');
  }
  function choose(b?: HTMLButtonElement) {
    if (solved || !b || b.disabled) return;
    if (isAns(b)) { finish(); o.onDone(!missed); return; }
    missed = true;
    b.classList.add('is-wrong');
    b.disabled = true;
    if (o.mode === 'review') { finish(); o.onDone(false); }
  }
  function reset(silent = false) {
    solved = false; missed = false;
    opts.forEach((b) => { b.disabled = false; b.classList.remove('is-right', 'is-wrong'); });
    if (explain) explain.hidden = true;
    if (resetBtn) resetBtn.hidden = true;
    el.classList.remove('is-solved');
    shuffle();
    if (!silent) o.onReset?.();
  }

  opts.forEach((b) => b.addEventListener('click', () => choose(b)));
  resetBtn?.addEventListener('click', () => reset());
  shuffle();

  return { el, solved: () => solved, press: (n) => choose(opts[n - 1]), showSolved: finish, reset };
}
