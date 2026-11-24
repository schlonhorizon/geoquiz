import { loadSets } from './data/load';
import { renderSets } from './ui/sets';
import './style.css';

const container = document.querySelector<HTMLElement>('#sets');
if (container) {
  loadSets()
    .then((sets) => renderSets(container, sets))
    .catch((error: unknown) => {
      console.error(error);
      container.textContent = 'Die Datensätze konnten nicht geladen werden.';
    });
}
