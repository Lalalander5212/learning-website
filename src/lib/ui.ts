let timer: number | undefined;

/** 화면 아래에 잠깐 뜨는 알림. action을 주면 버튼이 하나 붙음. */
export function toast(msg: string, action?: { label: string; run: () => void }) {
  let el = document.getElementById('lw-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'lw-toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.replaceChildren(document.createTextNode(msg));
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = action.label;
    b.onclick = () => { action.run(); el!.classList.remove('show'); };
    el.append(b);
  }
  el.classList.add('show');
  clearTimeout(timer);
  timer = window.setTimeout(() => el!.classList.remove('show'), action ? 6000 : 3500);
}

/** 입력 중이거나 조합키가 눌렸으면 단축키를 무시 */
export function isTyping(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return true;
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

export function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('starlight-theme', next); } catch {}
  paintTheme();
}

export function paintTheme() {
  const dark = document.documentElement.dataset.theme !== 'light';
  document.querySelectorAll('.lw-theme').forEach((b) => b.setAttribute('aria-checked', String(dark)));
}
