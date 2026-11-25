import type { QuizSet } from '../data/load';
import type { Entity } from '../data/schema';
import type { CountryMap } from '../map/country-map';
import { renderCountryHero } from './country-hero';

export function renderProfile(
  sheet: HTMLElement,
  { definition, entities }: QuizSet,
  entity: Entity,
  map: CountryMap | undefined,
  onSelect: (id: string) => void,
  onClose: () => void,
) {
  const previousColor = sheet.querySelector<HTMLElement>('.country-hero')?.style.getPropertyValue('--country-color');
  const { header } = renderCountryHero({ entity, definition, map, onBack: onClose, previousColor });

  const names = new Map(entities.map(({ id, name }) => [id, name]));
  const fields = document.createElement('dl');
  fields.className = 'atlas-fields';
  for (const attribute of definition.attributes) {
    const { key, label, type, noteColumn } = attribute;
    if (type === 'flag' || type === 'color') continue;
    const value = entity[key];
    const note = noteColumn ? entity[noteColumn] : undefined;
    const empty = value == null || value === '' || (Array.isArray(value) && !value.length);
    const fallback = attribute.emptyValueColumn ? entity[attribute.emptyValueColumn] : undefined;
    if (empty && !note && !fallback) continue;
    const row = document.createElement('div');
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    if (type === 'entityRefList' && Array.isArray(value)) {
      for (const id of value) {
        const name = names.get(id);
        if (!name) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = name;
        button.addEventListener('click', () => onSelect(id));
        description.append(button);
      }
      if (!description.childElementCount && !note) continue;
    } else if (!empty) {
      description.textContent = Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? value ? 'Ja' : 'Nein' : String(value);
    } else if (typeof fallback === 'string') {
      description.textContent = fallback;
    }
    if ('alternativeValuesColumn' in attribute && attribute.alternativeValuesColumn) {
      const alternatives = entity[attribute.alternativeValuesColumn];
      if (Array.isArray(alternatives) && alternatives.length) {
        description.append(` (${alternatives.join(', ')} ebenfalls möglich)`);
      }
    }
    if (!empty && attribute.source) description.append(` (${attribute.source})`);
    if (typeof note === 'string') {
      const detail = document.createElement('p');
      detail.className = 'atlas-note';
      detail.textContent = note;
      description.append(detail);
    }
    row.append(term, description);
    fields.append(row);
  }
  sheet.replaceChildren(header, fields);
  sheet.hidden = false;
}
