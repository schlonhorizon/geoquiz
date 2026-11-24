import type { QuizSet } from '../data/load';

export function renderSets(container: HTMLElement, sets: QuizSet[]) {
  const collator = new Intl.Collator('de');
  const sections = sets.map(({ definition, entities }) => {
    const section = document.createElement('section');
    const title = document.createElement('h2');
    title.textContent = definition.label;

    const count = document.createElement('p');
    const label = entities.length === 1 ? definition.entityLabel : definition.entityLabelPlural;
    count.textContent = `${entities.length} ${label}`;

    const list = document.createElement('ul');
    for (const entity of [...entities].sort((a, b) => collator.compare(a.name, b.name))) {
      const item = document.createElement('li');
      item.textContent = entity.name;
      list.append(item);
    }

    section.append(title, count, list);
    return section;
  });

  container.replaceChildren(...sections);
}
