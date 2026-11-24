import type { Topology } from 'topojson-specification';
import type { QuizSet } from '../data/load';
import { renderWorldMap } from '../map/world-map';
import { createMapRound } from '../quiz/map-questions';
import type { MapMode, MapQuestion } from '../quiz/map-questions';

const answerDelay = 1100;
const modeLabels = { find: 'Finden', name: 'Benennen' };
const verdictLabels = { correct: 'Richtig.', incorrect: 'Falsch.', skipped: 'Übersprungen.' };
type Verdict = keyof typeof verdictLabels;

export function renderMapQuiz(container: HTMLElement, { definition, entities }: QuizSet, topology: Topology) {
  const prompts = definition.map.prompts;
  if (!prompts || !entities.length) throw new Error('The world set needs countries and map prompts');

  container.style.setProperty('--answer-delay', `${answerDelay}ms`);
  container.innerHTML = `
    <header class="quiz-bar">
      <div class="question-bar">
        <div class="question-meta">
          <div class="meta-label progress">
            <span id="mode-name"></span>
            <span id="question-number"></span>
            <span><span id="correct-count"></span> Punkte</span>
          </div>
          <button type="button" class="square-button menu-button" aria-label="Menü öffnen" aria-haspopup="dialog" aria-expanded="false" aria-controls="quiz-menu">
            <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true"><path d="M0 1h20M0 7h20M0 13h20"/></svg>
          </button>
        </div>
        <div class="question-body">
          <h1 class="question" tabindex="-1"></h1>
          <span class="question-flag" aria-hidden="true"></span>
        </div>
      </div>
    </header>
    <div class="answer-dock">
      <section class="answer-sheet" aria-label="Antwort" hidden>
        <div class="verdict" hidden>
          <div class="meta-label verdict-meta"><span class="verdict-dot" aria-hidden="true"></span><span class="verdict-number"></span></div>
          <h2 class="verdict-title"></h2>
          <p class="verdict-detail"></p>
        </div>
        <div class="answers" role="group" aria-label="Antwortmöglichkeiten" hidden></div>
        <button type="button" class="primary-button next-question" aria-keyshortcuts="Space Enter" hidden>
          <span class="next-label">Weiter</span>
          <span class="button-hint" aria-hidden="true"><span class="meta-label">Leertaste</span> <span>→</span></span>
          <span class="timer-bar" aria-hidden="true" hidden></span>
        </button>
      </section>
      <section class="answer-sheet round-summary" aria-labelledby="summary-title" hidden>
        <div class="summary-content">
          <h2 class="meta-label" id="summary-title">Runde beendet</h2>
          <p class="summary-score"></p>
          <p class="summary-detail"></p>
        </div>
        <button type="button" class="primary-button new-round" aria-keyshortcuts="Space Enter">
          <span>Neue Runde</span>
          <span class="button-hint" aria-hidden="true"><span class="meta-label">Leertaste</span> <span>→</span></span>
        </button>
      </section>
    </div>
    <button type="button" class="skip-question">Überspringen</button>
    <div class="zoom-controls" role="group" aria-label="Kartenansicht">
      <button type="button" class="square-button" id="zoom-in" aria-label="Hineinzoomen">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0v16M0 8h16"/></svg>
      </button>
      <button type="button" class="square-button" id="zoom-out" aria-label="Herauszoomen">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M0 8h16"/></svg>
      </button>
    </div>
    <svg class="world-map" role="group" aria-label="Weltkarte" aria-describedby="map-instructions"></svg>
    <p class="sr-only" id="map-instructions">Ziehen zum Verschieben. Mit Mausrad oder zwei Fingern zoomen.</p>
    <p class="sr-only feedback" role="status" aria-atomic="true"></p>
    <dialog class="menu-overlay" id="quiz-menu" aria-labelledby="menu-title">
      <div class="menu-content">
        <header class="menu-header">
          <h2 id="menu-title">GeoQuiz</h2>
          <button type="button" class="square-button close-menu" aria-label="Menü schließen" autofocus>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M1 1l14 14M15 1L1 15"/></svg>
          </button>
        </header>
        <p class="meta-label" id="mode-label">Modus</p>
        <nav class="menu-modes" aria-labelledby="mode-label">
          <button class="menu-mode" type="button" id="find-mode"><span class="menu-number" aria-hidden="true">01</span><span>Finden</span><span class="menu-arrow" aria-hidden="true">→</span></button>
          <button class="menu-mode" type="button" id="name-mode"><span class="menu-number" aria-hidden="true">02</span><span>Benennen</span><span class="menu-arrow" aria-hidden="true">→</span></button>
          <button class="menu-mode" type="button" disabled><span class="menu-number" aria-hidden="true">03</span><span>Flaggen</span><span class="meta-label">Folgt</span></button>
          <button class="menu-mode" type="button" disabled><span class="menu-number" aria-hidden="true">04</span><span>Länder</span><span class="meta-label">Folgt</span></button>
          <button class="menu-mode" type="button" disabled><span class="menu-number" aria-hidden="true">05</span><span>Statistik</span><span class="meta-label">Folgt</span></button>
        </nav>
        <div class="menu-settings">
          <p class="meta-label">Einstellungen</p>
          <label><input type="checkbox" id="animate-feedback" checked> Lösungszoom animieren</label>
          <label><input type="checkbox" id="marker-rings" autocomplete="off"> Kleinstaaten-Ringe anzeigen</label>
          <button type="button" id="reset-map">Weltansicht zurücksetzen</button>
        </div>
      </div>
    </dialog>
  `;

  const menu = container.querySelector<HTMLDialogElement>('#quiz-menu')!;
  const menuButton = container.querySelector<HTMLButtonElement>('.menu-button')!;
  const animation = container.querySelector<HTMLInputElement>('#animate-feedback')!;
  const markerRings = container.querySelector<HTMLInputElement>('#marker-rings')!;
  const findButton = container.querySelector<HTMLButtonElement>('#find-mode')!;
  const nameButton = container.querySelector<HTMLButtonElement>('#name-mode')!;
  const questionBody = container.querySelector<HTMLElement>('.question-body')!;
  const prompt = container.querySelector<HTMLElement>('.question')!;
  const modeName = container.querySelector<HTMLElement>('#mode-name')!;
  const questionNumber = container.querySelector<HTMLElement>('#question-number')!;
  const correctCount = container.querySelector<HTMLElement>('#correct-count')!;
  const sheet = container.querySelector<HTMLElement>('.answer-sheet')!;
  const options = container.querySelector<HTMLElement>('.answers')!;
  const verdictPanel = container.querySelector<HTMLElement>('.verdict')!;
  const verdictNumber = container.querySelector<HTMLElement>('.verdict-number')!;
  const verdictTitle = container.querySelector<HTMLElement>('.verdict-title')!;
  const verdictDetail = container.querySelector<HTMLElement>('.verdict-detail')!;
  const feedback = container.querySelector<HTMLElement>('.feedback')!;
  const next = container.querySelector<HTMLButtonElement>('.next-question')!;
  const nextLabel = container.querySelector<HTMLElement>('.next-label')!;
  const timer = container.querySelector<HTMLElement>('.timer-bar')!;
  const skip = container.querySelector<HTMLButtonElement>('.skip-question')!;
  const summary = container.querySelector<HTMLElement>('.round-summary')!;
  const summaryScore = container.querySelector<HTMLElement>('.summary-score')!;
  const summaryDetail = container.querySelector<HTMLElement>('.summary-detail')!;
  const newRound = container.querySelector<HTMLButtonElement>('.new-round')!;
  const zoomControls = container.querySelector<HTMLElement>('.zoom-controls')!;
  const svg = container.querySelector<SVGSVGElement>('.world-map')!;

  const names = new Map(entities.map(({ id, name }) => [id, name]));
  const map = renderWorldMap(svg, topology, definition.map, entities, submitAnswer);
  const optionButtons = new Map<string, HTMLButtonElement>();
  let mode: MapMode = 'find';
  let questions: MapQuestion[] = [];
  let index = 0;
  let score = 0;
  let verdict: Verdict | undefined;
  let autoTimer: number | undefined;

  const pad = (number: number) => String(number).padStart(2, '0');

  function updateScore(pop: boolean) {
    const value = document.createElement('span');
    if (pop) value.className = 'score-pop';
    value.textContent = pad(score);
    correctCount.replaceChildren(value);
  }

  function showPrompt({ target }: MapQuestion) {
    const text = document.createElement('span');
    text.className = 'question-entry';
    if (mode === 'find') {
      const [lead, ending] = prompts!.find.split('{entity}', 2);
      const preface = document.createElement('span');
      preface.className = 'question-lead';
      preface.textContent = lead.trim();
      const country = document.createElement('span');
      country.className = 'country-name';
      const size = Array.from(target.name).length;
      country.dataset.size = size <= 11 ? 'large' : size <= 18 ? 'medium' : 'small';
      country.textContent = target.name + (ending ?? '');
      text.append(preface, ' ', country);
    } else {
      text.textContent = prompts!.name;
    }
    prompt.replaceChildren(text);
  }

  function showQuestion(restart: boolean, focus: boolean) {
    const question = questions[index];
    verdict = undefined;
    feedback.textContent = '';
    questionBody.hidden = false;
    modeName.textContent = modeLabels[mode];
    questionNumber.textContent = `${pad(index + 1)} / ${questions.length}`;
    questionNumber.setAttribute('aria-label', `Frage ${index + 1} von ${questions.length}`);
    showPrompt(question);
    map.showQuestion(question.target.id, { clickable: mode === 'find', restart, animate: animation.checked });

    next.hidden = true;
    timer.hidden = true;
    summary.hidden = true;
    verdictPanel.hidden = true;
    skip.hidden = false;
    zoomControls.hidden = false;
    options.hidden = mode === 'find';
    sheet.hidden = options.hidden;

    optionButtons.clear();
    options.replaceChildren(...question.options.map(({ id, name }, position) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'answer';
      row.dataset.countryId = id;
      row.style.setProperty('--delay', `${position * 50}ms`);
      row.setAttribute('aria-keyshortcuts', String(position + 1));
      const key = document.createElement('span');
      key.className = 'answer-key';
      key.textContent = String(position + 1);
      key.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span');
      text.className = 'answer-label';
      text.textContent = name;
      row.append(key, text);
      row.addEventListener('click', () => submitAnswer(id));
      optionButtons.set(id, row);
      return row;
    }));
    if (focus && !menu.open) prompt.focus({ preventScroll: true });
  }

  function startRound(nextMode: MapMode, focus = true) {
    window.clearTimeout(autoTimer);
    mode = nextMode;
    questions = createMapRound(entities, mode);
    index = 0;
    score = 0;
    findButton.setAttribute('aria-current', String(mode === 'find'));
    nameButton.setAttribute('aria-current', String(mode === 'name'));
    updateScore(false);
    showQuestion(true, focus);
  }

  function submitAnswer(selectedId?: string) {
    const question = questions[index];
    if (!question || verdict) return;
    const { target } = question;
    const correct = selectedId === target.id;
    verdict = correct ? 'correct' : selectedId ? 'incorrect' : 'skipped';
    if (correct) {
      score++;
      updateScore(true);
    }

    map.revealAnswer(target.id, selectedId, { fly: mode === 'find' && !correct, animate: animation.checked });
    for (const [id, button] of optionButtons) {
      button.disabled = true;
      button.dataset.state = id === target.id ? 'correct' : id === selectedId ? 'incorrect' : 'muted';
    }
    verdictPanel.dataset.state = verdict;
    verdictNumber.textContent = `Frage ${pad(index + 1)}`;
    verdictTitle.textContent = verdictLabels[verdict];
    const selectedName = selectedId ? names.get(selectedId) : undefined;
    const solution = `${target.name} ist blau markiert.`;
    verdictDetail.textContent = correct ? 'Weiter geht’s gleich.'
      : selectedName ? `Du hast ${selectedName} gewählt. ${solution}` : solution;
    feedback.textContent = `${verdictLabels[verdict]} ${verdictDetail.textContent}`;
    nextLabel.textContent = index === questions.length - 1 ? 'Ergebnis' : 'Weiter';
    skip.hidden = true;
    zoomControls.hidden = true;
    sheet.hidden = false;
    verdictPanel.hidden = false;
    timer.hidden = !correct;
    next.hidden = false;
    if (!menu.open) next.focus({ preventScroll: true });
    if (correct) autoTimer = window.setTimeout(() => advance(true), answerDelay);
  }

  function advance(automatic = false) {
    if (!verdict || index >= questions.length) return;
    window.clearTimeout(autoTimer);
    const focus = !automatic || document.activeElement === next;
    index++;
    if (index < questions.length) {
      showQuestion(false, focus);
      return;
    }

    questionBody.hidden = true;
    sheet.hidden = true;
    summaryScore.textContent = `${score}/${questions.length}`;
    summaryDetail.textContent = `Du hast ${score} von ${questions.length} Fragen richtig beantwortet.`;
    summary.hidden = false;
    if (focus && !menu.open) newRound.focus({ preventScroll: true });
  }

  function closeMenu() {
    menu.close();
    menuButton.setAttribute('aria-expanded', 'false');
  }

  nameButton.disabled = new Set(entities.map(({ name }) => name)).size < 4;
  menuButton.addEventListener('click', () => {
    menu.showModal();
    menuButton.setAttribute('aria-expanded', 'true');
  });
  container.querySelector('.close-menu')!.addEventListener('click', closeMenu);
  findButton.addEventListener('click', () => {
    closeMenu();
    if (mode !== 'find') startRound('find');
  });
  nameButton.addEventListener('click', () => {
    closeMenu();
    if (mode !== 'name') startRound('name');
  });
  container.querySelector('#reset-map')!.addEventListener('click', () => {
    map.resetView();
    closeMenu();
  });
  markerRings.addEventListener('change', () => svg.classList.toggle('show-marker-rings', markerRings.checked));
  container.querySelector('#zoom-out')!.addEventListener('click', () => map.zoomBy(1 / 1.6));
  container.querySelector('#zoom-in')!.addEventListener('click', () => map.zoomBy(1.6));
  skip.addEventListener('click', () => submitAnswer());
  next.addEventListener('click', () => advance());
  newRound.addEventListener('click', () => startRound(mode));

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) {
      event.preventDefault();
      closeMenu();
      menuButton.focus({ preventScroll: true });
      return;
    }
    if (menu.open || event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))) return;
    if ((event.key === ' ' || event.key === 'Enter') && verdict) {
      event.preventDefault();
      if (index === questions.length) startRound(mode);
      else advance();
      return;
    }
    if (mode === 'name' && !verdict && /^[1-4]$/.test(event.key)) {
      const option = questions[index]?.options[Number(event.key) - 1];
      if (option) {
        event.preventDefault();
        submitAnswer(option.id);
      }
    }
  });

  startRound('find', false);
}
