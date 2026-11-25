import type { PracticeQuestion, createPracticeEngine } from '../quiz/practice';
import type { AnswerFormat, Preset, PresetLibrary, RoundSettings } from '../quiz/round-settings';
import type { SettingsStore } from '../settings/store';
import { renderSourceList } from './source-page';

interface MenuActions {
  area: string;
  setId: string;
  engine: ReturnType<typeof createPracticeEngine>;
  library: PresetLibrary;
  store: SettingsStore;
  startRound(settings: RoundSettings, label: string, questions: PracticeQuestion[]): void;
  showAtlas(): void;
  setAnimation(value: boolean): void;
  setMarkerRings(value: boolean): void;
  resetMap(): void;
}

type Page = { name: 'home' } | { name: 'practice' } | { name: 'sources' }
  | { name: 'builder'; preset?: Preset; settings: RoundSettings; error?: string };

const closeIcon = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M1 1l14 14M15 1L1 15"/></svg>';
const backIcon = '<svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true"><path d="M21 9H2m7-7L2 9l7 7"/></svg>';
const answers = [['map', 'Karte'], ['choice', '4 Optionen'], ['typed', 'Tippen']] as const;
const directions = [['forward', 'Land → Kategorie'], ['reverse', 'Kategorie → Land'], ['mixed', 'Gemischt']] as const;
const orders = [['mixed', 'Gemischt'], ['country', 'Land für Land']] as const;
const lengths = [[10, '10'], [20, '20'], ['all', 'Alle']] as const;

function button(label: string, action: string, className: string) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.className = className;
  element.dataset.action = action;
  return element;
}

export function renderMenu(dialog: HTMLDialogElement, toggle: HTMLButtonElement, actions: MenuActions) {
  const { engine, library, store, setId } = actions;
  let page: Page = { name: 'home' };
  let transitioning = false;
  let animationRun = 0;
  let animationEnabled = true;
  let rings = false;
  let settingsOpen = false;
  let returnToPractice = 'custom';

  function fitSettings(settings: RoundSettings): RoundSettings {
    const keys = new Set(engine.categories.map(({ key }) => key));
    const categories = Array.isArray(settings.categories) ? [...new Set(settings.categories.filter((key) => keys.has(key)))] : 'all';
    const region = engine.regions.includes(settings.region) ? settings.region : '';
    const fitted = { ...settings, categories: categories.length ? categories : 'all' as const, region };
    const formats = engine.formatsFor(fitted);
    const format = formats.has(fitted.format) ? fitted.format : [...formats][0] ?? fitted.format;
    return { ...fitted, format };
  }

  function initial(preset?: Preset) {
    return fitSettings({
      ...library.defaults,
      ...preset?.settings,
      ...(preset ? store.load(setId, preset.id) : undefined),
    });
  }

  function addTitle(stage: HTMLElement, title: string) {
    const header = document.createElement('header');
    header.className = 'menu-page-heading';
    header.setAttribute('data-menu-block', '');
    const back = button('', 'back', 'square-button');
    back.innerHTML = backIcon;
    back.setAttribute('aria-label', 'Zurück');
    const heading = document.createElement('h2');
    heading.textContent = title;
    heading.tabIndex = -1;
    header.append(back, heading);
    stage.append(header);
  }

  function sectionLabel(stage: HTMLElement, label: string) {
    const heading = document.createElement('h3');
    heading.className = 'meta-label menu-section-label';
    heading.setAttribute('data-menu-block', '');
    heading.textContent = label;
    stage.append(heading);
  }

  function renderHome(stage: HTMLElement) {
    stage.innerHTML = `
      <header class="menu-header" data-menu-block>
        <h2>GeoQuiz</h2>
        <span class="meta-label menu-area"></span>
        <button type="button" class="square-button" data-action="close" aria-label="Menü schließen">${closeIcon}</button>
      </header>
      <nav class="menu-modes" aria-label="Hauptmenü">
        <button type="button" class="menu-mode" data-action="practice" data-menu-block><span class="menu-number" aria-hidden="true">01</span><span>Üben</span><span class="menu-arrow" aria-hidden="true">→</span></button>
        <button type="button" class="menu-mode" data-action="atlas" data-menu-block><span class="menu-number" aria-hidden="true">02</span><span>Atlas</span><span class="menu-arrow" aria-hidden="true">→</span></button>
        <button type="button" class="menu-mode" data-menu-block disabled><span class="menu-number" aria-hidden="true">03</span><span>Fortschritt</span><span class="meta-label">Folgt</span></button>
      </nav>
      <div class="menu-settings">
        <button type="button" class="settings-toggle meta-label" data-action="settings" aria-controls="menu-drawer" aria-expanded="${settingsOpen}" data-menu-block>
          Einstellungen <span aria-hidden="true">+</span>
        </button>
        <div class="settings-drawer" id="menu-drawer" ${settingsOpen ? 'data-expanded' : ''}>
          <div ${settingsOpen ? '' : 'inert'}>
            <label data-menu-block><input type="checkbox" id="animate-feedback" ${animationEnabled ? 'checked' : ''}> Lösungszoom animieren</label>
            <label data-menu-block><input type="checkbox" id="marker-rings" ${rings ? 'checked' : ''}> Kleinstaaten-Ringe anzeigen</label>
            <button type="button" data-action="reset" data-menu-block>Weltansicht zurücksetzen</button>
            <button type="button" data-action="sources" data-menu-block>Quellen und Lizenzen</button>
          </div>
        </div>
      </div>
    `;
    stage.querySelector('.menu-area')!.textContent = `Gebiet: ${actions.area}`;
  }

  function renderPractice(stage: HTMLElement) {
    addTitle(stage, 'Üben');
    sectionLabel(stage, 'Vorlagen');
    const templates = document.createElement('div');
    templates.className = 'preset-list';
    for (const preset of library.presets) {
      const row = document.createElement('div');
      row.className = 'preset-row';
      row.setAttribute('data-menu-block', '');
      const main = button(preset.label, `start:${preset.id}`, 'preset-name');
      main.disabled = Boolean(preset.upcoming);
      if (preset.upcoming) {
        const status = document.createElement('span');
        status.className = 'meta-label';
        status.textContent = 'Folgt';
        row.append(main, status);
      } else {
        const edit = button('Anpassen', `edit:${preset.id}`, 'preset-edit');
        edit.setAttribute('aria-label', `${preset.label} anpassen`);
        row.append(main, edit);
      }
      templates.append(row);
    }
    stage.append(templates);
    sectionLabel(stage, 'Eigene Runde');
    const custom = button('Runde zusammenstellen', 'custom', 'custom-round preset-name');
    custom.setAttribute('data-menu-block', '');
    stage.append(custom);
  }

  function renderBuilder(stage: HTMLElement, builder: Extract<Page, { name: 'builder' }>) {
    const { settings, preset } = builder;
    addTitle(stage, 'Rundenaufbau');
    if (preset) sectionLabel(stage, preset.label);
    const form = document.createElement('form');
    form.className = 'round-builder';
    const available = engine.formatsFor(settings);
    const all = engine.categories.map(({ key }) => key);
    const selected = settings.categories === 'all' ? all : settings.categories;

    function row<T extends string | number>(
      label: string,
      key: keyof RoundSettings,
      values: readonly (readonly [T, string])[],
      pressed: (value: T) => boolean,
      disabled: (value: T) => boolean = () => false,
    ) {
      const field = document.createElement('div');
      field.className = 'builder-row';
      field.setAttribute('role', 'group');
      field.setAttribute('aria-label', label);
      field.setAttribute('data-menu-block', '');
      const legend = document.createElement('span');
      legend.className = 'meta-label';
      legend.textContent = label;
      const segments = document.createElement('div');
      segments.className = 'segments';
      for (const [value, text] of values) {
        const item = button(text, `segment:${key}:${value}`, 'segment');
        item.setAttribute('aria-pressed', String(pressed(value)));
        item.disabled = disabled(value);
        segments.append(item);
      }
      field.append(legend, segments);
      form.append(field);
      return field;
    }

    row('Kategorie', 'categories', engine.categories.map(({ key, label }) => [key, label]), (key) => selected.includes(key),
      (key) => selected.length === 1 && selected.includes(key));
    row('Richtung', 'direction', directions, (value) => settings.direction === value);
    row('Antwortart', 'format', answers, (value) => settings.format === value, (value) => !available.has(value));
    row('Reihenfolge', 'order', orders, (value) => settings.order === value);
    const selection = row('Auswahl', 'region', [['', 'Alle Regionen'], ...engine.regions.map((region) => [region, region] as const)],
      (value) => settings.region === value);
    const difficulty = document.createElement('span');
    difficulty.className = 'builder-difficulty meta-label';
    difficulty.textContent = 'Schwierigkeit · Folgt';
    selection.lastElementChild!.append(difficulty);
    row<RoundSettings['length']>('Länge', 'length', lengths, (value) => settings.length === value);

    const status = document.createElement('p');
    status.className = 'builder-status';
    status.setAttribute('role', 'status');
    status.hidden = !builder.error;
    status.textContent = builder.error ?? '';
    form.append(status);

    const footer = document.createElement('div');
    footer.className = 'builder-footer';
    footer.setAttribute('data-menu-block', '');
    footer.innerHTML = '<button type="submit" class="primary-button">Runde starten <span aria-hidden="true">→</span></button>';
    footer.querySelector('button')!.disabled = !available.size;
    form.append(footer);
    stage.append(form);
  }

  function render(focusAction?: string, preserveScroll = false) {
    const scroll = dialog.scrollTop;
    const stage = document.createElement('div');
    stage.className = 'menu-content';
    stage.dataset.level = page.name;
    if (page.name === 'home') renderHome(stage);
    else if (page.name === 'practice') renderPractice(stage);
    else if (page.name === 'sources') {
      addTitle(stage, 'Quellen und Lizenzen');
      stage.append(renderSourceList());
    } else renderBuilder(stage, page);
    dialog.replaceChildren(stage);
    dialog.scrollTop = preserveScroll ? scroll : 0;
    const controls = [...stage.querySelectorAll<HTMLButtonElement>('button[data-action]')];
    const focus = controls.find((control) => control.dataset.action === focusAction && !control.disabled)
      ?? stage.querySelector<HTMLElement>(page.name === 'home' ? '[data-action="close"]' : 'h2');
    focus?.focus({ preventScroll: true });
  }

  async function animate(phase: string) {
    const run = ++animationRun;
    const elements = [...dialog.querySelectorAll<HTMLElement>('[data-menu-block]:not([inert] *)')];
    const exit = phase.endsWith('out');
    for (const [index, element] of elements.entries()) {
      const delay = phase === 'opening' ? 150 + index * 50
        : phase === 'closing' ? (elements.length - index - 1) * 15
          : index * (exit ? 20 : 50);
      element.style.setProperty('--menu-delay', `${delay}ms`);
    }
    dialog.dataset.transition = phase;
    const animations = [dialog, ...elements].flatMap((element) => element.getAnimations?.() ?? [])
      .filter((motion) => 'animationName' in motion && String(motion.animationName).startsWith('menu-'));
    await Promise.allSettled(animations.map((motion) => motion.finished));
    if (run === animationRun) delete dialog.dataset.transition;
  }

  async function move(next: Page, forward: boolean, focusAction?: string) {
    if (transitioning) return;
    transitioning = true;
    await animate(forward ? 'forward-out' : 'back-out');
    page = next;
    render(focusAction);
    transitioning = false;
    void animate(forward ? 'forward-in' : 'back-in');
  }

  async function close(after?: () => void) {
    if (transitioning) return;
    transitioning = true;
    await animate('closing');
    dialog.close();
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus({ preventScroll: true });
    transitioning = false;
    after?.();
  }

  function back() {
    if (page.name === 'home') void close();
    else if (page.name === 'practice') void move({ name: 'home' }, false, 'practice');
    else if (page.name === 'sources') void move({ name: 'home' }, false, 'sources');
    else void move({ name: 'practice' }, false, returnToPractice);
  }

  function start(builder: Extract<Page, { name: 'builder' }>) {
    const { settings, preset } = builder;
    const questions = engine.createRound(settings);
    if (!questions.length) {
      const next = { ...builder, error: 'Für diese Auswahl gibt es keine Fragen.' };
      if (page.name === 'builder') {
        page = next;
        render('start', true);
      } else {
        void move(next, true);
      }
      return;
    }
    if (preset) store.save(setId, preset.id, settings);
    void close(() => actions.startRound(settings, preset?.label ?? 'Eigene Runde', questions));
  }

  function changeSegment(key: string, value: string, control: string) {
    if (page.name !== 'builder') return;
    const next = { ...page.settings };
    switch (key) {
      case 'categories': {
        const all = engine.categories.map(({ key }) => key);
        const existing = next.categories === 'all' ? all : next.categories;
        const categories = existing.includes(value) ? existing.filter((item) => item !== value) : [...existing, value];
        next.categories = categories.length === all.length ? 'all' : categories;
        break;
      }
      case 'direction': next.direction = value as RoundSettings['direction']; break;
      case 'order': next.order = value as RoundSettings['order']; break;
      case 'format': next.format = value as AnswerFormat; break;
      case 'region': next.region = value; break;
      case 'length': next.length = value === 'all' ? value : value === '10' ? 10 : 20; break;
    }
    page = { ...page, settings: fitSettings(next), error: undefined };
    if (page.preset) store.save(setId, page.preset.id, page.settings);
    render(control, true);
  }

  toggle.addEventListener('click', () => {
    page = { name: 'home' };
    settingsOpen = false;
    dialog.showModal();
    toggle.setAttribute('aria-expanded', 'true');
    render();
    void animate('opening');
  });

  dialog.addEventListener('click', (event) => {
    const control = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
    if (!control?.dataset.action || control.disabled || transitioning) return;
    const [action, key, ...parts] = control.dataset.action.split(':');
    switch (action) {
      case 'close': void close(); break;
      case 'back': back(); break;
      case 'practice': void move({ name: 'practice' }, true); break;
      case 'sources': void move({ name: 'sources' }, true); break;
      case 'atlas': void close(actions.showAtlas); break;
      case 'reset': void close(actions.resetMap); break;
      case 'settings': {
        settingsOpen = !settingsOpen;
        control.setAttribute('aria-expanded', String(settingsOpen));
        const drawer = dialog.querySelector('#menu-drawer')!;
        drawer.toggleAttribute('data-expanded', settingsOpen);
        drawer.firstElementChild!.toggleAttribute('inert', !settingsOpen);
        break;
      }
      case 'custom':
        returnToPractice = 'custom';
        void move({ name: 'builder', settings: initial() }, true);
        break;
      case 'edit':
      case 'start': {
        const preset = library.presets.find(({ id }) => id === key);
        if (!preset || preset.upcoming) break;
        returnToPractice = control.dataset.action;
        const builder = { name: 'builder', preset, settings: initial(preset) } as const;
        if (action === 'start') start(builder);
        else void move(builder, true);
        break;
      }
      case 'segment': changeSegment(key, parts.join(':'), control.dataset.action); break;
    }
  });

  dialog.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.id === 'animate-feedback') actions.setAnimation(animationEnabled = input.checked);
    if (input.id === 'marker-rings') actions.setMarkerRings(rings = input.checked);
  });
  dialog.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!transitioning && page.name === 'builder') start(page);
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    back();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      back();
    } else if (event.key === 'Enter' && page.name === 'builder' && !transitioning
      && !event.repeat && !(event.target as Element).closest('[data-action="back"]')) {
      event.preventDefault();
      start(page);
    }
  });
}
