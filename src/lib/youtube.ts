// <YouTube>, <Ts> 동작: 지연 로딩 플레이어, 이어보기(위치 저장), 타임스탬프 점프, 현재 시간 메모
import { load, update } from './store';
import { toast } from './ui';

declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<any> | null = null;
function loadApi(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { apiPromise = null; reject(new Error('YouTube API 로드 실패')); };
      document.head.append(s);
    });
  }
  return apiPromise;
}

export const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return (h ? `${h}:` : '') + `${mm}:${String(r).padStart(2, '0')}`;
};

// 끝 30초 안이면 다 본 것으로 보고 이어보기를 지움
const RESUME_MIN = 30;
const END_MARGIN = 30;

let started = false;

export function initVideo() {
  if (started) return;
  started = true;
  const fig = document.querySelector<HTMLElement>('figure.yt[data-yt]');
  if (!fig) return;
  const vid = fig.dataset.yt!;
  const poster = fig.querySelector<HTMLButtonElement>('.yt-poster')!;
  const mount = fig.querySelector<HTMLElement>('.yt-mount')!;
  const resumeBtn = fig.querySelector<HTMLButtonElement>('.yt-resume')!;
  const stampBtn = fig.querySelector<HTMLButtonElement>('.yt-stamp')!;

  let player: any = null;
  let ready: Promise<any> | null = null;
  let timer: number | undefined;

  const saved = () => load().video[vid];

  function savePos() {
    if (!player?.getCurrentTime) return;
    const pos = player.getCurrentTime() || 0;
    const dur = player.getDuration?.() || 0;
    const done = dur > 0 && pos > dur - END_MARGIN;
    const prev = saved();
    if (prev && Math.abs(prev.pos - (done ? 0 : pos)) < 1 && prev.dur === dur) return;
    update((s) => { s.video[vid] = { pos: done ? 0 : Math.floor(pos), dur: Math.floor(dur), t: Date.now() }; });
  }

  function renderResume() {
    const r = saved();
    const show = !player && r && r.pos >= RESUME_MIN && (!r.dur || r.pos < r.dur - END_MARGIN);
    resumeBtn.hidden = !show;
    if (show) resumeBtn.textContent = `${fmtTime(r!.pos)}부터 이어보기`;
  }

  function play(at?: number): Promise<any> {
    if (ready) {
      return ready.then((p) => {
        if (at !== undefined) p.seekTo(at, true);
        p.playVideo();
        return p;
      });
    }
    const start = at ?? 0;
    fig.classList.add('is-active');
    ready = loadApi().then((YT) => new Promise((resolve) => {
      player = new YT.Player(mount, {
        host: 'https://www.youtube-nocookie.com',
        videoId: vid,
        playerVars: { autoplay: 1, start: Math.floor(start), rel: 0, playsinline: 1 },
        events: {
          onReady: (e: any) => { e.target.playVideo(); resolve(e.target); },
          onStateChange: (e: any) => {
            clearInterval(timer);
            if (e.data === YT.PlayerState.PLAYING) timer = window.setInterval(savePos, 10_000);
            else savePos(); // 일시정지, 끝, 버퍼링 때 저장
          },
        },
      });
      renderResume();
    })).catch((err) => {
      ready = null;
      fig.classList.remove('is-active');
      toast('영상을 불러오지 못함. YouTube에서 열기를 눌러 주세요');
      throw err;
    });
    return ready;
  }

  poster.addEventListener('click', () => {
    const r = saved();
    play(r && r.pos >= RESUME_MIN && (!r.dur || r.pos < r.dur - END_MARGIN) ? r.pos : 0);
  });
  resumeBtn.addEventListener('click', () => play(saved()?.pos ?? 0));

  document.querySelectorAll<HTMLButtonElement>('.yt-ts[data-t]').forEach((b) => {
    b.addEventListener('click', () => {
      fig.scrollIntoView({ behavior: 'smooth', block: 'start' });
      play(Number(b.dataset.t)).catch(() => {});
    });
  });

  // 현재 시간을 레슨 메모(#lw-note)에 [mm:ss] 형식으로 추가
  stampBtn.addEventListener('click', () => {
    const note = document.getElementById('lw-note') as HTMLTextAreaElement | null;
    if (!note) return;
    if (!player?.getCurrentTime) { toast('영상을 재생한 뒤에 쓸 수 있음'); return; }
    const tag = `[${fmtTime(player.getCurrentTime())}] `;
    const v = note.value;
    note.value = v + (v && !v.endsWith('\n') ? '\n' : '') + tag;
    note.closest('details')?.setAttribute('open', '');
    note.dispatchEvent(new Event('input')); // 기존 자동 저장 사용
    note.focus();
    note.setSelectionRange(note.value.length, note.value.length);
    note.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  addEventListener('pagehide', savePos);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') savePos(); });
  window.addEventListener('lw:change', renderResume);
  renderResume();
}
