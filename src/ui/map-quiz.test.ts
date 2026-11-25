// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { QuizSet } from '../data/load';
import type { PresetLibrary } from '../quiz/round-settings';
import { renderWorldMap } from '../map/world-map';
import { renderMapQuiz } from './map-quiz';
import { AUTO_ADVANCE_MS } from './advance-timer';
import type { MapInteraction } from '../map/world-map';

vi.mock('../map/world-map');

const definition: QuizSet['definition'] = {
  id: 'world', label: 'Welt', entityLabel: 'Land', entityLabelPlural: 'Länder', parent: null,
  map: { file: 'map.topojson', object: 'countries', idProperty: 'id', projection: 'miller',
    prompts: { find: 'Wo liegt {entity}?', name: 'Wie heißt das Land?' } },
  attributes: [
    { key: 'capital', label: 'Hauptstadt', type: 'text', noteColumn: 'capital_note' },
    { key: 'continent', label: 'Kontinent', type: 'enum', values: ['Europa', 'Afrika'], alternativeValuesColumn: 'continent_alt' },
    { key: 'color', label: 'Hauptfarbe', type: 'color', quiz: false },
    { key: 'neighbors', label: 'Nachbarländer', type: 'entityRefList' },
  ],
};
const countries: QuizSet['entities'] = [
  { id: 'NGA', name: 'Nigeria', name_aliases: [], capital: 'Abuja', capital_note: 'Abuja löste Lagos als Hauptstadt ab.', neighbors: ['NER'] },
  { id: 'NER', name: 'Niger', name_aliases: ['République du Niger'], capital: 'Niamey' },
  { id: 'DEU', name: 'Deutschland', name_aliases: [] },
  { id: 'FRA', name: 'Frankreich', name_aliases: [], continent: 'Europa', continent_alt: ['Afrika'], capital_note: 'Ergänzung im Atlas.', color: '#123456' },
];
const library: PresetLibrary = {
  defaults: { categories: 'all', direction: 'mixed', format: 'choice', order: 'mixed', region: '', difficulty: 'all', length: 20 },
  presets: [
    { id: 'find', label: 'Länder finden', settings: { categories: ['location'], direction: 'forward', format: 'map' } },
    { id: 'typed', label: 'Tipprunde', settings: { categories: ['location'], direction: 'reverse', format: 'typed' } },
    { id: 'capital', label: 'Hauptstädte', settings: { categories: ['capital'], direction: 'forward', format: 'typed' } },
  ],
};
const map = { resetView: vi.fn(), setAtlas: vi.fn(), clear: vi.fn(), setPicking: vi.fn(), mark: vi.fn(), focusCountries: vi.fn() };
let chooseCountry: (id: string) => void;
let moveMap: (source: MapInteraction, active: boolean) => void;
let container: HTMLElement;
const find = <T extends HTMLElement = HTMLElement>(selector: string) => container.querySelector<T>(selector)!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  vi.spyOn(Math, 'random').mockReturnValue(.99);
  vi.mocked(renderWorldMap).mockImplementation((_svg, _topology, _config, _entities, select, interact) => {
    chooseCountry = select;
    moveMap = interact;
    return map;
  });
  container = document.createElement('div');
  document.body.append(container);
  renderMapQuiz(container, { definition, entities: countries }, { type: 'Topology', objects: {}, arcs: [] }, library);
});

afterEach(() => {
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  window.localStorage.clear();
});

async function start(presetId: string) {
  find('.menu-button').click();
  find('[data-action="practice"]').click();
  await vi.advanceTimersByTimeAsync(0);
  find(`[data-action="start:${presetId}"]`).click();
  await vi.advanceTimersByTimeAsync(0);
}

it('starts in Atlas, shows populated fields and opens a neighbor profile', () => {
  expect(find('.question').textContent).toBe('Land antippen');
  expect(map.setPicking).toHaveBeenLastCalledWith(true);
  chooseCountry('NGA');
  expect(find('#profile-title').textContent).toBe('Nigeria');
  expect(find('.atlas-fields').textContent).toContain('HauptstadtAbuja');
  find('.atlas-fields button').click();
  expect(find('#profile-title').textContent).toBe('Niger');
  expect(find('.atlas-fields').textContent).toContain('Niamey');
  expect(find('.atlas-fields').textContent).not.toContain('Nachbarländer');
  expect(map.focusCountries).toHaveBeenLastCalledWith(['NER'], expect.anything(), true, undefined);
});

it('shows atlas notes even without a quiz capital and displays alternative continents', () => {
  chooseCountry('FRA');
  expect(find('.atlas-note').textContent).toBe('Ergänzung im Atlas.');
  expect(find('.atlas-fields').textContent).toContain('Europa (Afrika ebenfalls möglich)');
  expect(find('.atlas-fields').textContent).not.toContain('#123456');
});

it('shows a capital note in feedback after a correct typed answer', async () => {
  await start('capital');
  find<HTMLInputElement>('#country-answer').value = 'Abuja';
  find<HTMLFormElement>('.typed-answer').requestSubmit();
  expect(find('.verdict-title').textContent).toBe('Richtig.');
  expect(find('.verdict-detail').textContent).toBe('„Abuja“. Abuja löste Lagos als Hauptstadt ab.');
});

it('links a uniquely attributable wrong answer to its country', async () => {
  await start('capital');
  find<HTMLInputElement>('#country-answer').value = 'Niamey';
  find<HTMLFormElement>('.typed-answer').requestSubmit();
  const links = [...container.querySelectorAll('.verdict-profiles button')];
  expect(links.map(({ textContent }) => textContent)).toEqual(['Nigeria · Steckbrief', 'Niger · Steckbrief']);
});

it('holds the quiz and the remaining countdown while a profile overlay is open', async () => {
  await start('find');
  chooseCountry('NGA');
  vi.advanceTimersByTime(1700);
  find('.verdict-profiles button').click();
  const profile = find<HTMLDialogElement>('.quiz-profile');
  expect(profile.open).toBe(true);
  expect(find('#quiz-profile-title').textContent).toBe('Nigeria');
  expect(find('.continue-label').textContent).toBe('Pausiert');
  find('.quiz-profile .atlas-fields button').click();
  expect(find('#quiz-profile-title').textContent).toBe('Niger');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  vi.advanceTimersByTime(AUTO_ADVANCE_MS + 500);
  expect(find('#question-number').textContent).toBe('01 / 4');
  profile.dispatchEvent(new Event('cancel', { cancelable: true }));
  await vi.advanceTimersByTimeAsync(0);
  expect(profile.open).toBe(false);
  expect(find('.continue-label').textContent).toBe('Weiter');
  vi.advanceTimersByTime(AUTO_ADVANCE_MS - 1701);
  expect(find('#question-number').textContent).toBe('01 / 4');
  vi.advanceTimersByTime(1);
  expect(find('#question-number').textContent).toBe('02 / 4');
});

it('can deselect and reselect all categories in the builder', async () => {
  find('.menu-button').click();
  find('[data-action="practice"]').click();
  await vi.advanceTimersByTimeAsync(0);
  find('[data-action="custom"]').click();
  await vi.advanceTimersByTimeAsync(0);
  find('.category-toggle').click();
  expect(find('.builder-status').textContent).toBe('Mindestens eine Kategorie wählen');
  expect(find<HTMLButtonElement>('.round-builder button[type="submit"]').disabled).toBe(true);
  find('[data-action="segment:categories:capital"]').click();
  expect(find<HTMLButtonElement>('.round-builder button[type="submit"]').disabled).toBe(false);
  find('.category-toggle').click();
  expect(find('.category-toggle').getAttribute('aria-pressed')).toBe('true');
});

it('advances only correct answers after five seconds and frames the solution and wrong country together', async () => {
  await start('find');
  const counter = find('#question-number');
  const title = find('.verdict-title');
  const timer = find('.continue-timer');

  chooseCountry('NGA');
  expect(title.textContent).toBe('Richtig.');
  expect(timer.hidden).toBe(false);
  expect(map.mark).toHaveBeenLastCalledWith('NGA', 'correct');
  vi.advanceTimersByTime(AUTO_ADVANCE_MS - 1);
  expect(counter.textContent).toBe('01 / 4');
  vi.advanceTimersByTime(1);
  expect(counter.textContent).toBe('02 / 4');

  chooseCountry('NGA');
  expect(title.textContent).toBe('Falsch.');
  expect(timer.hidden).toBe(true);
  expect(map.focusCountries).toHaveBeenLastCalledWith(['NER', 'NGA'], expect.anything(), true, 'NER');
  vi.advanceTimersByTime(AUTO_ADVANCE_MS + 1);
  expect(counter.textContent).toBe('02 / 4');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

  window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
  expect(title.textContent).toBe('Übersprungen.');
  vi.advanceTimersByTime(AUTO_ADVANCE_MS + 1);
  expect(counter.textContent).toBe('03 / 4');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));

  chooseCountry('FRA');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
  vi.advanceTimersByTime(AUTO_ADVANCE_MS + 1);
  expect(find('.summary-score').textContent).toBe('2/4');
  expect(find('.menu-button').closest('[hidden]')).toBeNull();
});

it('uses the shared matcher for typed location answers and skips empty submissions', async () => {
  await start('typed');
  const form = find<HTMLFormElement>('.typed-answer');
  const input = form.querySelector('input')!;
  const title = find('.verdict-title');
  const submit = (value: string) => {
    input.value = value;
    form.requestSubmit();
  };

  expect(form.hidden).toBe(false);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
  expect(form.hidden).toBe(false);
  submit('Niger');
  expect(title.textContent).toBe('Falsch.');
  expect(find('.verdict-detail').textContent).toBe('Du hast Niger gewählt. Richtig ist „Nigeria“.');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

  submit('republique du niger');
  expect(title.textContent).toBe('Richtig.');
  vi.advanceTimersByTime(AUTO_ADVANCE_MS);
  submit('Deutshcland');
  expect(title.textContent).toBe('Richtig.');
  expect(find('.verdict-detail').textContent).toContain('Deutschland');
  vi.advanceTimersByTime(AUTO_ADVANCE_MS);
  submit('  ');
  expect(title.textContent).toBe('Übersprungen.');
  expect(find('#correct-count').textContent).toBe('02');
});

it('remembers a customized preset per set and uses it when reopening the app', async () => {
  find('.menu-button').click();
  find('[data-action="practice"]').click();
  await vi.advanceTimersByTimeAsync(0);
  find('[data-action="edit:typed"]').click();
  await vi.advanceTimersByTimeAsync(0);
  find('[data-action="segment:format:choice"]').click();
  expect(find('[data-action="segment:format:choice"]').getAttribute('aria-pressed')).toBe('true');
  renderMapQuiz(container, { definition, entities: countries }, { type: 'Topology', objects: {}, arcs: [] }, library);
  await start('typed');
  expect(find('.typed-answer').hidden).toBe(true);
  expect(find('.answers').hidden).toBe(false);
});

it('holds the remaining time until both the hover and map interaction end', async () => {
  await start('find');
  chooseCountry('NGA');
  const sheet = find('.answer-sheet');
  const label = find('.continue-label');
  const counter = find('#question-number');

  vi.advanceTimersByTime(1800);
  moveMap('gesture', true);
  sheet.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  expect(label.textContent).toBe('Pausiert');
  vi.advanceTimersByTime(AUTO_ADVANCE_MS);
  expect(counter.textContent).toBe('01 / 4');
  moveMap('gesture', false);
  expect(label.textContent).toBe('Pausiert');
  sheet.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
  expect(label.textContent).toBe('Weiter');
  vi.advanceTimersByTime(AUTO_ADVANCE_MS - 1801);
  expect(counter.textContent).toBe('01 / 4');
  vi.advanceTimersByTime(1);
  expect(counter.textContent).toBe('02 / 4');
});

it('allows map clicks after a correct answer and the panel or overlay after any answer', async () => {
  await start('find');
  const counter = find('#question-number');
  const map = container.querySelector('svg.world-map')!;
  const clickMap = () => map.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  chooseCountry('NGA');
  clickMap();
  expect(counter.textContent).toBe('02 / 4');

  chooseCountry('NGA');
  clickMap();
  expect(counter.textContent).toBe('02 / 4');
  find('.verdict-title').click();
  expect(counter.textContent).toBe('03 / 4');

  find('.skip-question').click();
  find('.continue-overlay').click();
  expect(counter.textContent).toBe('04 / 4');
});
