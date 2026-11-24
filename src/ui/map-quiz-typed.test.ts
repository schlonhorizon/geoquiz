// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import type { QuizSet } from '../data/load';
import { renderWorldMap } from '../map/world-map';
import { renderMapQuiz } from './map-quiz';

vi.mock('../map/world-map');

it('uses typed answers for Benennen and preserves its existing round flow', () => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.99);
  const map = { resetView: vi.fn(), zoomBy: vi.fn(), showQuestion: vi.fn(), revealAnswer: vi.fn() };
  vi.mocked(renderWorldMap).mockReturnValue(map);
  const set: QuizSet = {
    definition: {
      id: 'world', label: 'Welt', entityLabel: 'Land', entityLabelPlural: 'Länder', parent: null,
      map: {
        file: 'map.topojson', object: 'countries', idProperty: 'id', projection: 'miller',
        prompts: { find: 'Wo liegt {entity}', name: 'Wie heißt das Land?' },
      },
      attributes: [],
    },
    entities: [
      { id: 'NGA', name: 'Nigeria', name_aliases: [] },
      { id: 'NER', name: 'Niger', name_aliases: ['République du Niger'] },
      { id: 'DEU', name: 'Deutschland', name_aliases: [] },
      { id: 'FRA', name: 'Frankreich', name_aliases: [] },
    ],
  };
  const container = document.createElement('div');
  document.body.append(container);

  try {
    renderMapQuiz(container, set, { type: 'Topology', objects: {}, arcs: [] });
    container.querySelector<HTMLButtonElement>('.menu-button')!.click();
    const format = container.querySelector<HTMLSelectElement>('#answer-format')!;
    format.value = 'typed';
    format.dispatchEvent(new Event('change', { bubbles: true }));
    container.querySelector<HTMLButtonElement>('#name-mode')!.click();

    const form = container.querySelector<HTMLFormElement>('.typed-answer')!;
    const input = container.querySelector<HTMLInputElement>('#country-answer')!;
    const options = container.querySelector<HTMLElement>('.answers')!;
    const title = container.querySelector<HTMLElement>('.verdict-title')!;
    const detail = container.querySelector<HTMLElement>('.verdict-detail')!;
    const counter = container.querySelector<HTMLElement>('#question-number')!;
    const score = container.querySelector<HTMLElement>('#correct-count')!;
    const submit = (value: string) => {
      input.value = value;
      form.requestSubmit();
    };

    expect(form.hidden).toBe(false);
    expect(options.hidden).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    expect(input.value).toBe('');
    expect(form.hidden).toBe(false);

    submit('Niger');
    expect(title.textContent).toBe('Falsch.');
    expect(detail.textContent).toBe('Nigeria ist blau markiert.');
    expect(score.textContent).toBe('00');
    vi.advanceTimersByTime(1100);
    expect(counter.textContent).toBe('01 / 4');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    submit('republique du niger');
    expect(title.textContent).toBe('Richtig.');
    expect(score.textContent).toBe('01');
    vi.advanceTimersByTime(1100);
    expect(counter.textContent).toBe('03 / 4');
    expect(input.value).toBe('');

    submit('Deutshcland');
    expect(title.textContent).toBe('Richtig.');
    expect(detail.textContent).toContain('Deutschland');
    expect(score.textContent).toBe('02');
    vi.advanceTimersByTime(1100);
  } finally {
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  }
});
