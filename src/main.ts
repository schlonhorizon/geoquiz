import '@fontsource-variable/inter-tight';
import { loadMap, loadMapResources, loadPresets, loadSets } from './data/load';
import { renderMapQuiz } from './ui/map-quiz';
import './ui/tokens.css';
import './style.css';
import './ui/menu.css';
import './ui/country.css';
import './ui/mobile.css';

const container = document.querySelector<HTMLElement>('#quiz');
if (container) {
  Promise.all([loadSets(), loadPresets()])
    .then(async ([sets, presets]) => {
      const world = sets.find(({ definition }) => definition.id === 'world');
      if (!world) throw new Error('The world set is missing');
      const [map, resources] = await Promise.all([loadMap(world.definition), loadMapResources(world.definition)]);
      renderMapQuiz(container, world, map, presets, resources);
    })
    .catch((error: unknown) => {
      console.error(error);
      const status = document.createElement('p');
      status.setAttribute('role', 'alert');
      status.textContent = 'Die Weltkarte konnte nicht geladen werden.';
      container.replaceChildren(status);
    });
}
