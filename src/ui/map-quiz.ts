import type { Topology } from 'topojson-specification';
import type { MapResources, QuizSet } from '../data/load';
import { assessCapital, createCountryMaps } from '../map/country-map';
import { renderWorldMap } from '../map/world-map';
import { createPracticeEngine, locationCategory } from '../quiz/practice';
import type { PracticeQuestion } from '../quiz/practice';
import type { PresetLibrary, RoundSettings } from '../quiz/round-settings';
import { LocalSettingsStore } from '../settings/store';
import { createQuizProfile, renderProfile } from './atlas';
import { AUTO_ADVANCE_MS, createAdvanceTimer } from './advance-timer';
import { formatCapitalDistance } from './capital-feedback';
import type { CapitalAttempt } from './capital-feedback';
import { flagImage } from './flag-image';
import { renderMenu } from './menu';
import { mobileLayout, observeKeyboard } from './mobile-viewport';
import { renderCountryMap } from './country-map';
import { renderCountryHero } from './country-hero';
import { renderCountryResult } from './country-result';
import type { QuestionOutcome } from './country-result';

const continueGap = 8;
const verdictLabels = { correct: 'Richtig.', incorrect: 'Falsch.', skipped: 'Übersprungen.' };

export function renderMapQuiz(container: HTMLElement, set: QuizSet, topology: Topology, library: PresetLibrary, resources: MapResources = {}) {
  const { definition, entities } = set;
  if (!entities.length) throw new Error('The world set needs countries');

  container.style.setProperty('--auto-advance-ms', `${AUTO_ADVANCE_MS}ms`);
  container.style.setProperty('--continue-gap', `${continueGap}px`);
  container.innerHTML = `
    <div class="quiz-stage">
    <div class="round-hero" hidden></div>
    <div class="country-progress" role="group" aria-label="Fragenfortschritt" hidden></div>
    <header class="quiz-bar">
      <div class="question-bar">
        <div class="question-meta">
          <div class="meta-label progress">
            <span id="mode-name"></span>
            <span id="question-number"></span>
            <span><span id="correct-count"></span> Punkte</span>
          </div>
          <button type="button" class="square-button skip-question" aria-label="Überspringen" aria-keyshortcuts="S" hidden>
            <svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true"><path d="M1 9h13M8 3l6 6-6 6M20 1v16"/></svg>
          </button>
          <button type="button" class="square-button menu-button" aria-label="Menü öffnen" aria-haspopup="dialog" aria-expanded="false" aria-controls="quiz-menu">
            <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true"><path d="M0 1h20M0 7h20M0 13h20"/></svg>
          </button>
        </div>
        <div class="question-body">
          <h1 class="question" tabindex="-1"></h1>
          <span class="question-flag" hidden></span>
        </div>
      </div>
    </header>
    <div class="answer-dock">
      <section class="answer-sheet" aria-label="Antwort" hidden>
        <div class="answer-content">
        <div class="verdict" hidden>
          <div class="meta-label verdict-meta"><span class="verdict-dot" aria-hidden="true"></span><span class="verdict-number"></span></div>
          <h2 class="verdict-title"></h2>
          <div class="verdict-context">
            <p class="verdict-detail"></p>
            <div class="verdict-profiles"></div>
          </div>
        </div>
        <div class="answers" role="group" aria-label="Antwortmöglichkeiten" hidden></div>
        <form class="typed-answer" hidden>
          <div class="typed-answer-field">
            <label class="meta-label" for="country-answer"></label>
            <input id="country-answer" type="text" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="go">
          </div>
          <button type="submit" class="primary-button">Antwort prüfen</button>
        </form>
        </div>
      </section>
      <section class="country-result" aria-labelledby="country-result-title" hidden></section>
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
    <section class="answer-sheet atlas-sheet profile-sheet" aria-labelledby="profile-title" hidden></section>
    <button type="button" class="continue-overlay" aria-label="Weiter" aria-keyshortcuts="Space Enter" hidden>
      <span class="meta-label continue-label">Weiter</span>
      <span class="continue-hint" aria-hidden="true"></span>
      <span class="continue-timer" aria-hidden="true" hidden></span>
    </button>
    </div>
    <svg class="world-map" role="group" aria-label="Weltkarte" aria-describedby="map-instructions"></svg>
    <div class="point-stage" hidden></div>
    <p class="sr-only" id="map-instructions">Ziehen zum Verschieben. Mit Mausrad oder zwei Fingern zoomen.</p>
    <p class="sr-only feedback" role="status" aria-atomic="true"></p>
    <dialog class="menu-overlay" id="quiz-menu" aria-label="GeoQuiz"></dialog>
    <dialog class="quiz-profile profile-sheet" aria-labelledby="quiz-profile-title"></dialog>
  `;

  const menu = container.querySelector<HTMLDialogElement>('#quiz-menu')!;
  const menuButton = container.querySelector<HTMLButtonElement>('.menu-button')!;
  const quizBar = container.querySelector<HTMLElement>('.quiz-bar')!;
  const questionMeta = container.querySelector<HTMLElement>('.question-meta')!;
  const questionBar = container.querySelector<HTMLElement>('.question-bar')!;
  const questionBody = container.querySelector<HTMLElement>('.question-body')!;
  const questionFlag = container.querySelector<HTMLElement>('.question-flag')!;
  const prompt = container.querySelector<HTMLElement>('.question')!;
  const modeName = container.querySelector<HTMLElement>('#mode-name')!;
  const questionNumber = container.querySelector<HTMLElement>('#question-number')!;
  const scoreDisplay = container.querySelector<HTMLElement>('#correct-count')!;
  const scoreLine = scoreDisplay.parentElement!;
  const dock = container.querySelector<HTMLElement>('.answer-dock')!;
  const sheet = container.querySelector<HTMLElement>('.answer-sheet')!;
  const answerContent = container.querySelector<HTMLElement>('.answer-content')!;
  const options = container.querySelector<HTMLElement>('.answers')!;
  const typedAnswer = container.querySelector<HTMLFormElement>('.typed-answer')!;
  const typedInput = typedAnswer.querySelector('input')!;
  const typedLabel = typedAnswer.querySelector('label')!;
  const verdictPanel = container.querySelector<HTMLElement>('.verdict')!;
  const verdictNumber = container.querySelector<HTMLElement>('.verdict-number')!;
  const verdictTitle = container.querySelector<HTMLElement>('.verdict-title')!;
  const verdictDetail = container.querySelector<HTMLElement>('.verdict-detail')!;
  const profileLinks = container.querySelector<HTMLElement>('.verdict-profiles')!;
  const profileDialog = container.querySelector<HTMLDialogElement>('.quiz-profile')!;
  const feedback = container.querySelector<HTMLElement>('.feedback')!;
  const next = container.querySelector<HTMLButtonElement>('.continue-overlay')!;
  const nextLabel = container.querySelector<HTMLElement>('.continue-label')!;
  const nextHint = container.querySelector<HTMLElement>('.continue-hint')!;
  const timer = container.querySelector<HTMLElement>('.continue-timer')!;
  const skip = container.querySelector<HTMLButtonElement>('.skip-question')!;
  const atlas = container.querySelector<HTMLElement>('.atlas-sheet')!;
  const summary = container.querySelector<HTMLElement>('.round-summary')!;
  const summaryScore = container.querySelector<HTMLElement>('.summary-score')!;
  const summaryDetail = container.querySelector<HTMLElement>('.summary-detail')!;
  const newRound = container.querySelector<HTMLButtonElement>('.new-round')!;
  const svg = container.querySelector<SVGSVGElement>('.world-map')!;
  const stage = container.querySelector<HTMLElement>('.quiz-stage')!;
  const heroSlot = container.querySelector<HTMLElement>('.round-hero')!;
  const countryProgress = container.querySelector<HTMLElement>('.country-progress')!;
  const countryResult = container.querySelector<HTMLElement>('.country-result')!;
  const pointStage = container.querySelector<HTMLElement>('.point-stage')!;
  const mobile = window.matchMedia(mobileLayout);

  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const engine = createPracticeEngine(set);
  const countryMaps = createCountryMaps(topology, definition.map, resources.water);
  const settings = new LocalSettingsStore();
  const waterVisible = settings.loadWaterVisibility();
  container.classList.toggle('hide-map-water', !waterVisible);
  const countdown = createAdvanceTimer((paused) => {
    next.toggleAttribute('data-paused', paused);
    nextLabel.textContent = paused ? 'Pausiert' : 'Weiter';
  }, () => advance(true));
  const quizProfile = createQuizProfile(profileDialog, (id, onSelect, close) => {
    const entity = byId.get(id);
    if (entity) renderProfile(profileDialog, set, entity, countryMaps.get(id), onSelect, close, true);
  }, (open) => {
    if (!open) countdown.setPaused('sheet', !touch && sheet.matches(':hover'));
    countdown.setPaused('profile', open);
  });
  const map = renderWorldMap(svg, topology, definition.map, entities, (id) => {
    if (!round) showProfile(id);
    else if (round.questions[index]?.format === 'map' && !round.questions[index].point) submitAnswer(id);
  }, (source, active) => countdown.setPaused(source, active), {
    ...resources, capital: definition.attributes.find(({ key, point }) => key === 'capital' && point),
  });
  if (!waterVisible) map.setWaterVisible(false);
  const optionButtons = new Map<string, HTMLButtonElement>();
  let round: { questions: PracticeQuestion[]; settings: RoundSettings; label: string; countryCount: number } | undefined;
  let focusIds: string[] = [];
  let radarId: string | undefined;
  let atlasProfileRevision = 0;
  let animateZoom = true;
  let index = 0;
  let score = 0;
  let verdict: QuestionOutcome | undefined;
  let touch = window.matchMedia('(pointer: coarse)').matches;
  let hero: ReturnType<typeof renderCountryHero> | undefined;
  let stopResult: (() => void) | undefined;
  let activePointMap: ReturnType<typeof renderCountryMap> | undefined;
  let countryNumber = 1;
  let countryStart = 0;
  let countryEnd = 0;
  let countryOutcomes: QuestionOutcome[] = [];
  const pad = (number: number) => String(number).padStart(2, '0');

  function measureFrame() {
    const height = svg.clientHeight;
    if (round?.settings.countryRound) return { top: 0, bottom: height };
    const top = (questionBar.parentElement?.offsetTop ?? 0) + questionBar.offsetHeight;
    let bottom = !atlas.hidden ? atlas.offsetTop : dock.offsetHeight ? dock.offsetTop : height;
    const floatingContinue = !next.hidden && !mobile.matches;
    const continueLeft = floatingContinue ? dock.offsetLeft + dock.offsetWidth / 2 : 0;
    const continueTop = bottom - continueGap;
    if (floatingContinue) {
      bottom -= next.offsetHeight + continueGap;
      next.style.left = `${continueLeft}px`;
      next.style.top = `${continueTop}px`;
    }
    dock.style.setProperty('--quiz-top', `${top}px`);
    atlas.style.setProperty('--quiz-top', `${top}px`);
    pointStage.style.top = `${top}px`;
    pointStage.style.bottom = `${Math.max(0, height - bottom)}px`;
    return { top, bottom };
  }

  function focusMap(ids: string[], animate = animateZoom, solutionId?: string) {
    focusIds = ids;
    radarId = solutionId;
    const frame = measureFrame();
    if (ids.length) map.focusCountries(ids, frame, animate, solutionId);
  }

  function clearContinue() {
    countdown.stop();
    next.hidden = timer.hidden = true;
    next.removeAttribute('data-paused');
    dock.removeAttribute('data-verdict');
    stage.removeAttribute('data-verdict');
  }

  function updateScore(pop: boolean) {
    const value = document.createElement('span');
    if (pop) value.className = 'score-pop';
    value.textContent = pad(score);
    scoreDisplay.replaceChildren(value);
  }

  function labelFor(question: PracticeQuestion) {
    const label = engine.categories.find(({ key }) => key === question.category)?.label ?? '';
    return question.point ? `${label} auf der Karte` : label;
  }

  function toggleCountryLayout(active: boolean) {
    container.toggleAttribute('data-country-round', active);
    heroSlot.hidden = countryProgress.hidden = !active;
    svg.setAttribute('aria-hidden', String(active));
    placeContinue();
    if (!active) {
      questionMeta.append(menuButton);
      hero?.dispose();
      heroSlot.replaceChildren();
      hero = undefined;
    }
    next.style.removeProperty('top');
    next.style.removeProperty('left');
    stage.scrollTop = 0;
  }

  function placeContinue() {
    if (mobile.matches) sheet.append(next);
    else if (container.hasAttribute('data-country-round')) dock.prepend(next);
    else stage.append(next);
    next.style.removeProperty('top');
    next.style.removeProperty('left');
  }

  function resetPointMap() {
    activePointMap?.dispose();
    activePointMap = undefined;
    countdown.setPaused('capital-map', false);
    pointStage.hidden = true;
    pointStage.replaceChildren();
    hero?.setPointMap();
  }

  function openPointMap(question: PracticeQuestion) {
    const solution = question.point!;
    const { id, name } = question.entity;
    const model = countryMaps.get(id, 'capital');
    if (!model) return;
    const view = renderCountryMap(model, `Landeskarte von ${name}`, {
      capitalName: question.answer.name,
      loadDetail: resources.loadDetail,
      onPick: (guess) => submitAnswer(undefined, false, false, { guess, ...assessCapital(guess, solution, model.bounds) }),
      onResolvedClick: () => { if (verdict === 'correct') advance(); },
      onInteraction: (active) => { if (activePointMap === view) countdown.setPaused('capital-map', active); },
    });
    activePointMap = view;
    if (hero) hero.setPointMap(view.frame);
    else {
      pointStage.replaceChildren(view.frame);
      pointStage.hidden = false;
    }
    view.refreshWater();
  }

  function showCountryIntro() {
    const question = round?.questions[index];
    if (!round || !question) return;
    countryEnd = index + 1;
    while (round.questions[countryEnd]?.entity.id === question.entity.id) countryEnd++;
    countryOutcomes = [];
    hero?.dispose();
    hero = renderCountryHero({
      entity: question.entity, definition, map: countryMaps.get(question.entity.id), onBack: showAtlas,
      position: `Land ${pad(countryNumber)} / ${pad(round.countryCount)}`, previousColor: hero?.color,
    });
    heroSlot.replaceChildren(hero.header);
    hero.bar.append(menuButton);
    countryProgress.replaceChildren(...round.questions.slice(index, countryEnd).map((item, offset) => {
      const cell = document.createElement('span');
      cell.className = 'country-progress-cell';
      cell.setAttribute('role', 'img');
      cell.setAttribute('aria-label', `Frage ${offset + 1} · ${labelFor(item)}`);
      return cell;
    }));
  }

  function showPrompt(question: PracticeQuestion) {
    const text = document.createElement('span');
    text.className = 'question-entry';
    const nameStart = question.prompt.indexOf(question.entity.name);
    if (question.category === locationCategory.key && question.direction === 'forward' && nameStart > 0) {
      const lead = document.createElement('span');
      lead.className = 'question-lead';
      lead.textContent = question.prompt.slice(0, nameStart).trim();
      const name = document.createElement('span');
      name.className = 'country-name';
      const length = Array.from(question.entity.name).length;
      name.dataset.size = length <= 11 ? 'large' : length <= 18 ? 'medium' : 'small';
      name.textContent = question.prompt.slice(nameStart);
      text.append(lead, ' ', name);
    } else {
      text.textContent = question.prompt;
    }
    prompt.replaceChildren(text);
    questionFlag.hidden = !question.flag;
    questionFlag.replaceChildren(...(question.flag ? [flagImage(question.flag, 'Gesuchte Flagge')] : []));
  }

  function showOptions(question: PracticeQuestion) {
    optionButtons.clear();
    options.classList.toggle('flag-options', question.options.some(({ flag }) => flag));
    options.replaceChildren(...question.options.map(({ id, name, flag }, position) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'answer';
      row.dataset.answerId = id;
      row.style.setProperty('--delay', `${position * 50}ms`);
      row.setAttribute('aria-keyshortcuts', String(position + 1));
      const key = document.createElement('span');
      key.className = 'answer-key';
      key.textContent = String(position + 1);
      key.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span');
      text.className = 'answer-label';
      text.textContent = name;
      if (flag) {
        row.classList.add('flag-option');
        row.setAttribute('aria-label', `Flagge ${position + 1}`);
        const caption = document.createElement('span');
        caption.className = 'flag-caption';
        caption.append(key, text);
        row.append(flagImage(flag), caption);
      } else {
        row.append(key, text);
      }
      row.addEventListener('click', () => submitAnswer(id));
      optionButtons.set(id, row);
      const wrapper = document.createElement('div');
      wrapper.className = 'answer-row';
      const clip = document.createElement('div');
      clip.className = 'answer-clip';
      clip.append(row);
      wrapper.append(clip);
      return wrapper;
    }));
  }

  function showQuestion(focus: boolean) {
    if (!round) return;
    const question = round.questions[index];
    const countryRound = Boolean(round.settings.countryRound);
    resetPointMap();
    verdict = undefined;
    feedback.textContent = '';
    questionBody.hidden = quizBar.hidden = false;
    modeName.textContent = labelFor(question) || round.label;
    const position = countryRound ? index - countryStart + 1 : index + 1;
    const count = countryRound ? countryEnd - countryStart : round.questions.length;
    questionNumber.textContent = `${pad(position)} / ${count}`;
    questionNumber.setAttribute('aria-label', `Frage ${position} von ${count}`);
    questionNumber.hidden = false;
    scoreLine.hidden = countryRound;
    if (countryRound) countryProgress.children[position - 1]?.setAttribute('aria-current', 'step');
    showPrompt(question);

    clearContinue();
    summary.hidden = verdictPanel.hidden = atlas.hidden = countryResult.hidden = true;
    skip.hidden = false;
    typedInput.value = '';
    typedLabel.textContent = question.answerLabel;
    typedAnswer.hidden = question.format !== 'typed';
    options.hidden = question.format !== 'choice';
    sheet.hidden = question.format === 'map';
    dock.toggleAttribute('data-flag-question', Boolean(question.flag || question.options.some(({ flag }) => flag)));
    dock.scrollTop = 0;
    answerContent.scrollTop = 0;
    showOptions(question);

    const clickable = question.format === 'map' && !question.point && !countryRound;
    const visibleCountry = !clickable && (question.category === locationCategory.key || question.direction === 'forward');
    map.clear();
    map.setPicking(clickable, clickable && question.acceptedIds.size === 1 ? question.entity.id : undefined);
    if (question.point) {
      openPointMap(question);
      focusMap([]);
    } else if (countryRound) {
      focusMap([]);
    } else if (visibleCountry) {
      map.mark(question.entity.id, 'highlighted', true);
      focusMap([question.entity.id]);
    } else {
      focusMap([]);
      map.resetView(animateZoom);
    }
    if (countryRound) stage.scrollTop = 0;
    if (focus && !menu.open) (activePointMap?.svg ?? (typedAnswer.hidden || mobile.matches ? prompt : typedInput)).focus({ preventScroll: true });
  }

  function startRound(settings: RoundSettings, label: string, questions: PracticeQuestion[]) {
    if (!questions.length) return;
    stopResult?.();
    round = { settings, label, questions, countryCount: new Set(questions.map(({ entity }) => entity.id)).size };
    index = score = 0;
    countryNumber = 1;
    countryStart = 0;
    map.setAtlas(false);
    toggleCountryLayout(Boolean(settings.countryRound));
    if (settings.countryRound) showCountryIntro();
    updateScore(false);
    showQuestion(true);
  }

  function showAtlas() {
    atlasProfileRevision++;
    clearContinue();
    stopResult?.();
    resetPointMap();
    toggleCountryLayout(false);
    round = undefined;
    map.setAtlas(true);
    verdict = undefined;
    questionBody.hidden = quizBar.hidden = false;
    questionFlag.hidden = questionNumber.hidden = scoreLine.hidden = skip.hidden = true;
    questionFlag.replaceChildren();
    sheet.hidden = summary.hidden = atlas.hidden = countryResult.hidden = true;
    modeName.textContent = 'Atlas';
    prompt.textContent = 'Land antippen';
    feedback.textContent = '';
    dock.removeAttribute('data-flag-question');
    map.clear();
    map.setPicking(true);
    focusMap([]);
    map.resetView();
  }

  function showProfile(id: string) {
    const entity = byId.get(id);
    if (!entity) return;
    const revision = ++atlasProfileRevision;
    renderProfile(atlas, set, entity, countryMaps.get(id), (neighbor) => {
      showProfile(neighbor);
      const title = atlas.querySelector<HTMLElement>('#profile-title')!;
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }, () => {
      atlasProfileRevision++;
      atlas.hidden = true;
      map.clear();
      focusMap([]);
      prompt.focus({ preventScroll: true });
    });
    map.clear();
    map.mark(id, 'highlighted', true);
    // Let the profile lay itself out once before measuring the free camera frame.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (revision === atlasProfileRevision && !round && !atlas.hidden) focusMap([id]);
    }));
    feedback.textContent = `Steckbrief: ${entity.name}`;
  }

  function submitAnswer(
    selectedId?: string, typo = false, unmatched = false,
    pointAttempt?: CapitalAttempt,
  ) {
    const question = round?.questions[index];
    if (!round || !question || verdict) return;
    const countryRound = Boolean(round.settings.countryRound);
    const mouseOverPanel = !touch && sheet.matches(':hover');
    const outcome = (pointAttempt?.correct || selectedId && question.acceptedIds.has(selectedId)) ? 'correct'
      : pointAttempt || selectedId || unmatched ? 'incorrect' : 'skipped';
    const correct = outcome === 'correct';
    verdict = outcome;
    if (correct) {
      score++;
      updateScore(true);
    }
    if (countryRound) {
      countryOutcomes.push(outcome);
      const cell = countryProgress.children[index - countryStart] as HTMLElement;
      cell.removeAttribute('aria-current');
      cell.dataset.outcome = outcome;
      cell.setAttribute('aria-label', `${cell.getAttribute('aria-label')} · ${verdictLabels[outcome]}`);
      if (question.answer.flag) hero?.revealFlag();
    }

    const countryAnswer = question.category === locationCategory.key || question.direction === 'reverse';
    const rightCountry = countryAnswer && correct && selectedId ? selectedId : question.entity.id;
    const wrongCountry = countryAnswer && !correct && selectedId && byId.has(selectedId) ? selectedId : undefined;
    const selectedCountry = selectedId
      ? (countryAnswer || question.answer.flag ? selectedId : question.countryForAnswer?.get(selectedId))
      : undefined;
    profileLinks.replaceChildren(...[...new Set([question.entity.id, selectedCountry])].flatMap((id) => {
      const country = id && byId.get(id);
      if (!country) return [];
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${country.name} · Steckbrief`;
      button.addEventListener('click', () => quizProfile.open(country.id, button));
      return [button];
    }));
    map.setPicking(false);
    if (!countryRound && !question.point) {
      map.mark(rightCountry, countryAnswer || correct ? 'correct' : outcome === 'incorrect' ? 'incorrect' : 'highlighted');
      if (wrongCountry) map.mark(wrongCountry, 'incorrect');
    }

    for (const [id, button] of optionButtons) {
      button.disabled = true;
      button.dataset.state = id === question.answer.id || (id === selectedId && correct) ? 'correct' : id === selectedId ? 'incorrect' : 'muted';
      if (button.dataset.state === 'muted') button.closest('.answer-row')?.setAttribute('data-muted', '');
      if (button.classList.contains('flag-option')) button.setAttribute('aria-label', button.querySelector('.answer-label')!.textContent!);
    }
    verdictPanel.dataset.state = outcome;
    verdictNumber.textContent = `Frage ${pad(index - (countryRound ? countryStart : 0) + 1)}`;
    verdictTitle.textContent = verdictLabels[outcome];
    const selected = question.options.find(({ id }) => id === selectedId)?.name
      ?? question.alternativeAnswers?.find(({ id }) => id === selectedId)?.name
      ?? (selectedId ? byId.get(selectedId)?.name : undefined);
    const source = question.source ? ` (${question.source})` : '';
    const solution = `Richtig ist „${question.answer.name}“${source}.`;
    const alternatives = question.alternativeAnswers?.map(({ name }) => `„${name}“`);
    const alsoCorrect = alternatives?.length ? ` Auch ${alternatives.join(', ')} ${alternatives.length === 1 ? 'gilt' : 'gelten'} als richtig.` : '';
    const note = question.noteColumn ? byId.get(rightCountry)?.[question.noteColumn] : undefined;
    const incorrect = selected ? `Du hast ${selected} gewählt. ${solution}` : solution;
    const accepted = selected ?? question.answer.name;
    let detail = `${incorrect}${alsoCorrect}`;
    if (correct) {
      detail = typo ? `Die richtige Schreibweise ist „${accepted}“${source}.`
        : source || note || question.point ? `„${accepted}“${source}.` : 'Weiter geht’s gleich.';
    }
    if (pointAttempt) detail += ` Entfernung: ${formatCapitalDistance(pointAttempt.distanceKm)}.`;
    verdictDetail.textContent = typeof note === 'string' ? `${detail} ${note}` : detail;
    feedback.textContent = `${verdictLabels[outcome]} ${verdictDetail.textContent}`;
    nextLabel.textContent = 'Weiter';
    nextHint.textContent = mobile.matches || touch ? 'Tippen' : 'Leertaste';
    typedInput.blur();
    skip.hidden = typedAnswer.hidden = true;
    sheet.hidden = verdictPanel.hidden = next.hidden = false;
    timer.hidden = !correct;
    dock.setAttribute('data-verdict', '');
    stage.setAttribute('data-verdict', '');
    dock.scrollTop = 0;
    answerContent.scrollTop = 0;
    focusMap(countryRound || question.point ? [] : wrongCountry ? [rightCountry, wrongCountry] : [rightCountry], animateZoom, rightCountry);
    if (question.point) activePointMap?.reveal(question.point, pointAttempt);
    if (!menu.open && !mobile.matches) next.focus({ preventScroll: true });
    if (countryRound && !mobile.matches) next.scrollIntoView?.({ block: 'nearest' });
    if (correct) {
      countdown.setPaused('sheet', mouseOverPanel);
      countdown.start();
    }
  }

  function repeatRound() {
    if (round) startRound(round.settings, round.label, engine.createRound(round.settings));
  }

  function startNextCountry() {
    if (!round) return;
    stopResult?.();
    if (index === round.questions.length) {
      repeatRound();
      return;
    }
    countryNumber++;
    countryStart = index;
    showCountryIntro();
    showQuestion(true);
  }

  function showCountryResult(focus: boolean) {
    if (!round) return;
    resetPointMap();
    quizBar.hidden = sheet.hidden = true;
    const items = round.questions.slice(countryStart, index);
    const country = items[0].entity.id;
    const result = renderCountryResult(countryResult, items.map((question, offset) => ({
      question, label: labelFor(question), outcome: countryOutcomes[offset],
    })), () => {
      showAtlas();
      showProfile(country);
      atlas.querySelector<HTMLElement>('#profile-title')?.focus({ preventScroll: true });
    }, startNextCountry, index < round.questions.length);
    stopResult = result.stop;
    stage.scrollTop = 0;
    if (focus && !menu.open) result.heading.focus({ preventScroll: true });
  }

  function advance(automatic = false) {
    if (!round || !verdict || index >= round.questions.length) return;
    const focus = !automatic || document.activeElement === next;
    clearContinue();
    index++;
    if (round.settings.countryRound && index === countryEnd) {
      showCountryResult(focus);
      return;
    }
    if (index < round.questions.length) {
      showQuestion(focus);
      return;
    }
    questionBody.hidden = sheet.hidden = true;
    map.clear();
    focusMap([]);
    summaryScore.textContent = `${score}/${round.questions.length}`;
    summaryDetail.textContent = `Du hast ${score} von ${round.questions.length} Fragen richtig beantwortet.`;
    summary.hidden = false;
    if (focus && !menu.open) newRound.focus({ preventScroll: true });
  }

  renderMenu(menu, menuButton, {
    area: definition.areaLabel ?? definition.label,
    setId: definition.id,
    engine,
    library,
    store: settings,
    startRound,
    showAtlas,
    setAnimation: (animate) => { animateZoom = animate; },
    setMarkerRings: (show) => svg.classList.toggle('show-marker-rings', show),
    waterVisible,
    setWaterVisibility: (show) => {
      container.classList.toggle('hide-map-water', !show);
      settings.saveWaterVisibility(show);
      map.setWaterVisible(show);
      activePointMap?.refreshWater();
    },
    resetMap: () => { focusMap([]); map.resetView(); },
  });

  let viewportWidth = svg.clientWidth;
  let viewportHeight = svg.clientHeight;
  const layoutObserver = new ResizeObserver(() => {
    measureFrame();
    if (svg.clientWidth === viewportWidth && svg.clientHeight === viewportHeight) return;
    viewportWidth = svg.clientWidth;
    viewportHeight = svg.clientHeight;
    focusMap(focusIds, false, radarId);
  });
  layoutObserver.observe(svg);
  layoutObserver.observe(quizBar);
  layoutObserver.observe(dock);
  observeKeyboard(stage, measureFrame);
  mobile.addEventListener('change', () => {
    placeContinue();
    nextHint.textContent = mobile.matches || touch ? 'Tippen' : 'Leertaste';
    focusMap(focusIds, false, radarId);
  });
  stage.addEventListener('transitionend', (event) => {
    if (event.target === questionFlag && event.propertyName === 'height') focusMap(focusIds, false, radarId);
  });
  atlas.addEventListener('transitionend', (event) => {
    if (event.target === atlas && event.propertyName === 'height' && !atlas.hidden) focusMap(focusIds, false, radarId);
  });

  typedAnswer.addEventListener('submit', (event) => {
    event.preventDefault();
    if (typedAnswer.hidden || verdict) return;
    const input = typedInput.value.trim();
    if (!input) {
      submitAnswer();
      return;
    }
    const result = round?.questions[index]?.match?.(input);
    submitAnswer(result?.id, result?.kind === 'typo', !result);
  });
  skip.addEventListener('click', () => submitAnswer());
  container.addEventListener('pointerdown', (event) => {
    touch = event.pointerType === 'touch' || event.pointerType === 'pen';
  }, true);
  sheet.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') countdown.setPaused('sheet', true);
  });
  sheet.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') countdown.setPaused('sheet', false);
  });
  // Capture the click before the answer handler can publish a new verdict.
  sheet.addEventListener('click', (event) => {
    if (verdict && !(event.target as Element).closest('.verdict-profiles, .continue-overlay')) advance();
  }, true);
  svg.addEventListener('click', () => { if (verdict === 'correct') advance(); }, true);
  next.addEventListener('click', () => advance());
  newRound.addEventListener('click', repeatRound);

  window.addEventListener('keydown', (event) => {
    if (!svg.isConnected || !round || menu.open || profileDialog.open || event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))) return;
    if ((event.key === ' ' || event.key === 'Enter') && verdict) {
      if (target instanceof Element && target.closest('.verdict-profiles')) return;
      if (!countryResult.hidden) {
        if (!(target instanceof Element && target.closest('button, a'))) {
          event.preventDefault();
          startNextCountry();
        }
        return;
      }
      event.preventDefault();
      if (index === round.questions.length) repeatRound();
      else advance();
    } else if (event.key === 'Enter' && !typedAnswer.hidden && !typedInput.value.trim()
      && !(target instanceof Element && target.closest('button, a'))) {
      event.preventDefault();
      submitAnswer();
    } else if (!skip.hidden && event.key.toLowerCase() === 's') {
      event.preventDefault();
      submitAnswer();
    } else if (!options.hidden && !verdict && /^[1-4]$/.test(event.key)) {
      const option = round.questions[index]?.options[Number(event.key) - 1];
      if (option) {
        event.preventDefault();
        submitAnswer(option.id);
      }
    }
  });

  showAtlas();
}
