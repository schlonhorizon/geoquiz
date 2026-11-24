import type { Topology } from 'topojson-specification';
import type { QuizSet } from '../data/load';
import { renderWorldMap } from '../map/world-map';
import { createMapQuestion } from '../quiz/map-questions';
import type { MapMode, MapQuestion } from '../quiz/map-questions';

export function renderMapQuiz(container: HTMLElement, { definition, entities }: QuizSet, topology: Topology) {
  const prompts = definition.map.prompts;
  if (!prompts || !entities.length) throw new Error('The world set needs countries and map prompts');

  container.innerHTML = `
    <header class="quiz-bar">
      <div class="question-bar">
        <div class="progress">
          <span id="question-number"></span>
          <span id="correct-count"></span>
        </div>
        <h1 class="question" tabindex="-1"></h1>
      </div>
      <button type="button" class="map-control menu-button" aria-label="Menü" aria-expanded="false" aria-controls="quiz-menu">
        <span class="menu-icon" aria-hidden="true"></span>
      </button>
    </header>
    <section class="menu-panel" id="quiz-menu" aria-label="Menü" hidden>
      <p class="panel-label" id="mode-label">Spielmodus</p>
      <div class="modes" role="group" aria-labelledby="mode-label">
        <button type="button" id="find-mode" aria-pressed="true">Finden</button>
        <button type="button" id="name-mode" aria-pressed="false">Benennen</button>
      </div>
      <p class="panel-label">Einstellungen</p>
      <label class="setting"><input type="checkbox" id="animate-feedback"> Lösungszoom animieren</label>
    </section>
    <svg class="world-map" role="group" aria-label="Weltkarte" aria-describedby="map-instructions"></svg>
    <p class="sr-only" id="map-instructions">Ziehen zum Verschieben. Mit Mausrad oder zwei Fingern zoomen.</p>
    <div class="zoom-controls" role="group" aria-label="Kartenansicht">
      <button type="button" class="map-control" id="zoom-in" aria-label="Hineinzoomen">+</button>
      <button type="button" class="map-control" id="zoom-out" aria-label="Herauszoomen">−</button>
      <button type="button" class="map-control" id="reset-map" aria-label="Weltansicht">↺</button>
    </div>
    <section class="answer-sheet" aria-label="Antwort">
      <p class="find-hint">Wähle das Land auf der Karte.</p>
      <div class="answers" role="group" aria-label="Antwortmöglichkeiten" hidden></div>
      <div class="round-result">
        <p class="feedback" role="status" aria-atomic="true"></p>
        <button type="button" class="next-question" hidden>Nächste Frage</button>
      </div>
    </section>
  `;
  const menuButton = container.querySelector<HTMLButtonElement>('.menu-button')!;
  const menu = container.querySelector<HTMLElement>('#quiz-menu')!;
  const animation = container.querySelector<HTMLInputElement>('#animate-feedback')!;
  const findButton = container.querySelector<HTMLButtonElement>('#find-mode')!;
  const nameButton = container.querySelector<HTMLButtonElement>('#name-mode')!;
  const prompt = container.querySelector<HTMLElement>('.question')!;
  const questionNumber = container.querySelector<HTMLElement>('#question-number')!;
  const correctCount = container.querySelector<HTMLElement>('#correct-count')!;
  const findHint = container.querySelector<HTMLElement>('.find-hint')!;
  const options = container.querySelector<HTMLElement>('.answers')!;
  const feedback = container.querySelector<HTMLElement>('.feedback')!;
  const next = container.querySelector<HTMLButtonElement>('.next-question')!;
  const svg = container.querySelector<SVGSVGElement>('.world-map')!;

  const map = renderWorldMap(svg, topology, definition.map, entities, submitAnswer);
  let mode: MapMode = 'find';
  let question: MapQuestion | undefined;
  let answered = false;
  let round = 0;
  let correctAnswers = 0;
  const optionButtons = new Map<string, HTMLButtonElement>();

  function showProgress() {
    questionNumber.textContent = `Frage ${round}`;
    correctCount.textContent = `${correctAnswers} richtig`;
  }

  function toggleMenu(open: boolean) {
    menu.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
  }

  const showQuestion = (nextMode: MapMode, focusPrompt = true) => {
    if (mode !== nextMode) {
      round = 0;
      correctAnswers = 0;
    }
    mode = nextMode;
    question = createMapQuestion(entities, mode, question?.target.id);
    answered = false;
    round++;
    showProgress();
    const { target } = question;
    prompt.textContent = prompts[mode].replaceAll('{entity}', () => target.name);
    feedback.textContent = '';
    delete feedback.dataset.state;
    next.hidden = true;
    findButton.setAttribute('aria-pressed', String(mode === 'find'));
    nameButton.setAttribute('aria-pressed', String(mode === 'name'));
    map.showQuestion(target.id, mode === 'find');
    findHint.hidden = mode !== 'find';
    options.hidden = mode === 'find';
    optionButtons.clear();

    const buttons = question.options.map(({ id, name }, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'answer';
      const key = document.createElement('span');
      key.className = 'answer-key';
      key.textContent = String(index + 1);
      key.setAttribute('aria-hidden', 'true');
      button.append(key, name);
      button.setAttribute('aria-keyshortcuts', String(index + 1));
      button.addEventListener('click', () => submitAnswer(id));
      optionButtons.set(id, button);
      return button;
    });
    options.replaceChildren(...buttons);
    if (focusPrompt) prompt.focus({ preventScroll: true });
  };

  function submitAnswer(selectedId: string) {
    if (answered || !question) return;
    answered = true;
    const { target } = question;
    const correct = selectedId === target.id;
    if (correct) correctAnswers++;
    showProgress();
    map.revealAnswer(target.id, selectedId, animation.checked);
    for (const [id, button] of optionButtons) {
      button.disabled = true;
      if (id === target.id) button.dataset.state = 'correct';
      else if (id === selectedId) button.dataset.state = 'incorrect';
    }
    feedback.textContent = correct ? `Richtig! ${target.name}.` : `Falsch. Richtig ist ${target.name}.`;
    feedback.dataset.state = correct ? 'correct' : 'incorrect';
    findHint.hidden = true;
    next.hidden = false;
    next.focus({ preventScroll: true });
  }

  animation.checked = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  nameButton.disabled = new Set(entities.map(({ name }) => name)).size < 4;
  menuButton.addEventListener('click', () => toggleMenu(menu.hidden));
  findButton.addEventListener('click', () => {
    toggleMenu(false);
    if (mode !== 'find') showQuestion('find');
    else menuButton.focus();
  });
  nameButton.addEventListener('click', () => {
    toggleMenu(false);
    if (mode !== 'name') showQuestion('name');
    else menuButton.focus();
  });
  next.addEventListener('click', () => showQuestion(mode));
  container.querySelector('#zoom-out')!.addEventListener('click', () => map.zoomBy(1 / 1.6));
  container.querySelector('#zoom-in')!.addEventListener('click', () => map.zoomBy(1.6));
  container.querySelector('#reset-map')!.addEventListener('click', () => map.resetView());

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      toggleMenu(false);
      menuButton.focus();
      event.preventDefault();
      return;
    }
    if (mode !== 'name' || answered || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (!/^[1-4]$/.test(event.key)) return;
    const option = question?.options[Number(event.key) - 1];
    if (option) {
      event.preventDefault();
      submitAnswer(option.id);
    }
  });

  showQuestion('find', false);
}
