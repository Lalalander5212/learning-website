const KEY = 'lw-progress-v1';
export type Progress = { done: Record<string, string>; quiz: Record<string, boolean> };

export function load(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { done: p.done || {}, quiz: p.quiz || {} };
  } catch { return { done: {}, quiz: {} }; }
}
export function save(p: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}
// "/learning-website/edge-llm/01-quantization/" -> "edge-llm/01-quantization"
export function idFromPath(path: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return decodeURI(path).replace(base, '').replace(/^\/|\/$/g, '').replace(/\/index$/, '');
}
export const today = () => new Date().toLocaleDateString('en-CA');
