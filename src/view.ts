import { setFind, setMapSize } from './map';
import { $ } from './util';

export type View = 'setup' | 'quiz' | 'done' | 'statsView';

export function show(view: View) {
  for (const id of ['setup', 'quiz', 'done', 'statsView'] as const) $(id).hidden = id !== view;
  const tab = view === 'statsView' ? 'stats' : 'play';
  document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.v === tab)));
  setFind(false);
  setMapSize('normal');
}
