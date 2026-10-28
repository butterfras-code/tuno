import type { PracticeStore } from '../../practice/state.ts';
export const toolPaths = { tuner: '/tune/', tone: '/tone/', metronome: '/tempo/' } as const;
export function focusForPath(path: string) {
  return (Object.entries(toolPaths).find(([, url]) => path === url || path === `${url}index.html` || path === url.slice(0, -1))?.[0] ?? null) as keyof typeof toolPaths | null;
}
/** One mounted store across local views. */
export function connectToolRoutes(store: PracticeStore) {
  const read = () => {
    const focus = focusForPath(location.pathname);
    if (focus) store.dispatch({ type: 'focus', value: focus });
  };
  read();
  window.addEventListener('popstate', read);
  let previous = store.get().focus;
  store.subscribe(state => {
    if (state.focus === previous) return;
    previous = state.focus;
    if (focusForPath(location.pathname) !== state.focus) {
      // The original assignment belongs to its entry route. Keep temporary state
      // in memory when switching tools, and avoid a mismatched payload on reload.
      const search = new URLSearchParams(location.search); search.delete('activity');
      history.pushState(null, '', toolPaths[state.focus] + (search.size ? `?${search}` : ''));
    }
  });
}
