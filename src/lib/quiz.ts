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
  const opts = [...el.querySelectorAll<HTMLButtonElement>('button.quiz-opt')];
  const explain = el.querySelector<HTMLElement>('.quiz-explain');
  const resetBtn = el.querySelector<HTMLButtonElement>('.quiz-reset');
  let missed = false;
  let solved = false;

  function finish() {
    solved = true;
    opts.forEach((b, i) => { b.disabled = true; if (i === ans) b.classList.add('is-right'); });
    if (explain) explain.hidden = false;
    if (resetBtn) resetBtn.hidden = o.mode !== 'learn';
    el.classList.add('is-solved');
  }
  function choose(i: number) {
    if (solved || !opts[i] || opts[i].disabled) return;
    if (i === ans) { finish(); o.onDone(!missed); return; }
    missed = true;
    opts[i].classList.add('is-wrong');
    opts[i].disabled = true;
    if (o.mode === 'review') { finish(); o.onDone(false); }
  }
  function reset(silent = false) {
    solved = false; missed = false;
    opts.forEach((b) => { b.disabled = false; b.classList.remove('is-right', 'is-wrong'); });
    if (explain) explain.hidden = true;
    if (resetBtn) resetBtn.hidden = true;
    el.classList.remove('is-solved');
    if (!silent) o.onReset?.();
  }

  opts.forEach((b, i) => b.addEventListener('click', () => choose(i)));
  resetBtn?.addEventListener('click', () => reset());

  return { el, solved: () => solved, press: (n) => choose(n - 1), showSolved: finish, reset };
}
