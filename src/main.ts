import '@fontsource-variable/inter-tight';
import { loadMap, loadPresets, loadSets } from './data/load';
import { renderMapQuiz } from './ui/map-quiz';
import './ui/tokens.css';
import './style.css';
import './ui/menu.css';

const container = document.querySelector<HTMLElement>('#quiz');
if (container) {
  Promise.all([loadSets(), loadPresets()])
    .then(async ([sets, presets]) => {
      const world = sets.find(({ definition }) => definition.id === 'world');
      if (!world) throw new Error('The world set is missing');
      renderMapQuiz(container, world, await loadMap(world.definition), presets);
    })
    .catch((error: unknown) => {
      console.error(error);
      const status = document.createElement('p');
      status.setAttribute('role', 'alert');
      status.textContent = 'Die Weltkarte konnte nicht geladen werden.';
      container.replaceChildren(status);
    });
}
