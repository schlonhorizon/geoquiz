// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import type { QuizSet } from '../data/load';
import { renderWorldMap } from '../map/world-map';
import { renderMapQuiz } from './map-quiz';

vi.mock('../map/world-map');

it('advances only correct answers after 1100 ms and cancels a timer on manual advance', () => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.99);

  const map = { resetView: vi.fn(), zoomBy: vi.fn(), showQuestion: vi.fn(), revealAnswer: vi.fn() };
  let chooseCountry = (_id: string) => {};
  vi.mocked(renderWorldMap).mockImplementation((_svg, _topology, _config, _entities, select) => {
    chooseCountry = select;
    return map;
  });

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
      { id: 'DEU', name: 'Deutschland', name_aliases: [] },
      { id: 'FRA', name: 'Frankreich', name_aliases: [] },
      { id: 'BEL', name: 'Belgien', name_aliases: [] },
      { id: 'CHE', name: 'Schweiz', name_aliases: [] },
    ],
  };
  const container = document.createElement('div');
  document.body.append(container);

  try {
    renderMapQuiz(container, set, { type: 'Topology', objects: {}, arcs: [] });
    const counter = container.querySelector('#question-number')!;
    const title = container.querySelector('.verdict-title')!;
    const timer = container.querySelector<HTMLElement>('.timer-bar')!;
    const skip = container.querySelector<HTMLButtonElement>('.skip-question')!;
    const summary = container.querySelector<HTMLElement>('.round-summary')!;

    chooseCountry('DEU');
    expect(title.textContent).toBe('Richtig.');
    expect(timer.hidden).toBe(false);
    expect(map.revealAnswer).toHaveBeenLastCalledWith('DEU', 'DEU', { fly: false, animate: true });
    vi.advanceTimersByTime(1099);
    expect(counter.textContent).toBe('01 / 4');
    vi.advanceTimersByTime(1);
    expect(counter.textContent).toBe('02 / 4');

    chooseCountry('DEU');
    expect(title.textContent).toBe('Falsch.');
    expect(timer.hidden).toBe(true);
    expect(map.revealAnswer).toHaveBeenLastCalledWith('FRA', 'DEU', { fly: true, animate: true });
    vi.advanceTimersByTime(1500);
    expect(counter.textContent).toBe('02 / 4');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(counter.textContent).toBe('03 / 4');

    skip.click();
    expect(title.textContent).toBe('Übersprungen.');
    vi.advanceTimersByTime(1500);
    expect(counter.textContent).toBe('03 / 4');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(counter.textContent).toBe('04 / 4');

    chooseCountry('CHE');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    vi.advanceTimersByTime(1500);
    expect(summary.hidden).toBe(false);
    expect(summary.querySelector('.summary-score')?.textContent).toBe('2/4');
  } finally {
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  }
});
