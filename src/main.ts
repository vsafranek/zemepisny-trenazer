import './style.css';
import { onStateClick } from './map';
import { answer, answerFind, isAnswered, next, renderChips, resume, retryMisses, showSetup, startRound } from './quiz';
import { openStats } from './stats';
import { flush, pull, saveSettings, settings } from './store';
import { $ } from './util';

$('tabs').onclick = e => {
  const v = (e.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.v;
  if (v === 'stats') void openStats();
  else if (v === 'play') resume();
};
$('start').onclick = () => startRound();
$('again').onclick = showSetup;
$('retry').onclick = retryMisses;
$('next').onclick = next;
$('weakGo').onclick = () => { settings.mode = 'weak'; saveSettings(); renderChips(); startRound(); };
$('opts').onclick = e => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.opt'); if (b) answer(b.dataset.c!); };
onStateClick(answerFind);
document.addEventListener('keydown', e => {
  if ($('quiz').hidden || (e.target as HTMLElement).tagName === 'INPUT') return;
  if (!isAnswered() && /^[1-4]$/.test(e.key)) $('o' + (+e.key - 1))?.click();
  else if (isAnswered() && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next(); }
});

let installEvt: (Event & { prompt(): Promise<void> }) | null = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e as typeof installEvt; $('install').hidden = false; });
$('install').onclick = () => { $('install').hidden = true; void installEvt?.prompt(); installEvt = null; };
addEventListener('online', () => void flush());
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});

renderChips();
showSetup();
void flush().then(pull);
