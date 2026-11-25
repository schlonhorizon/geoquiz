import type { PracticeQuestion } from '../quiz/practice';
import { flagImage } from './flag-image';

export type QuestionOutcome = 'correct' | 'incorrect' | 'skipped';

export function renderCountryResult(
  section: HTMLElement,
  entries: { question: PracticeQuestion; outcome: QuestionOutcome; label: string }[],
  onAtlas: () => void,
  onNext: () => void,
  hasNext: boolean,
) {
  const points = entries.filter(({ outcome }) => outcome === 'correct').length;
  const heading = document.createElement('h2');
  heading.id = 'country-result-title';
  heading.className = 'meta-label';
  heading.tabIndex = -1;
  heading.textContent = 'Steckbrief';
  const score = document.createElement('p');
  score.className = 'country-result-score';
  score.setAttribute('aria-label', `${points} von ${entries.length} richtig`);
  const visualScore = document.createElement('span');
  visualScore.setAttribute('aria-hidden', 'true');
  score.append(visualScore);
  const list = document.createElement('dl');
  list.className = 'country-result-fields';
  for (const [index, { question, outcome, label }] of entries.entries()) {
    const row = document.createElement('div');
    row.dataset.outcome = outcome;
    row.style.setProperty('--row-delay', `${index * 60}ms`);
    const name = document.createElement('dt');
    const result = document.createElement('span');
    result.className = 'sr-only';
    result.textContent = outcome === 'correct' ? 'Richtig. ' : outcome === 'incorrect' ? 'Falsch. ' : 'Übersprungen. ';
    name.append(result, label);
    const value = document.createElement('dd');
    if (question.answer.flag) value.append(flagImage(question.answer.flag, `Flagge von ${question.entity.name}`));
    else value.textContent = question.source ? `${question.answer.name} (${question.source})` : question.answer.name;
    row.append(name, value);
    list.append(row);
  }
  const atlas = document.createElement('button');
  atlas.type = 'button';
  atlas.className = 'country-atlas-link';
  atlas.textContent = 'Im Atlas öffnen';
  atlas.addEventListener('click', onAtlas);
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'primary-button';
  next.textContent = hasNext ? 'Nächstes Land →' : 'Neue Runde →';
  next.addEventListener('click', onNext);
  const actions = document.createElement('div');
  actions.className = 'country-result-actions';
  actions.append(atlas, next);
  section.replaceChildren(heading, score, list, actions);
  section.hidden = false;

  let displayed = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? points : 0;
  visualScore.textContent = `${displayed} / ${entries.length}`;
  const record = displayed === points ? undefined : window.setInterval(() => {
    displayed++;
    visualScore.textContent = `${displayed} / ${entries.length}`;
    if (displayed >= points) window.clearInterval(record);
  }, 140);
  return { heading, stop: () => window.clearInterval(record) };
}
