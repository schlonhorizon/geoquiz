import type { QuizSet } from '../data/load';
import type { Entity } from '../data/schema';
import { flagImage } from './flag-image';

export function renderProfile(
  sheet: HTMLElement,
  { definition, entities }: QuizSet,
  entity: Entity,
  onSelect: (id: string) => void,
  onClose: () => void,
) {
  const flagKey = definition.attributes.find(({ type }) => type === 'flag')?.key;
  const header = document.createElement('header');
  header.className = 'atlas-header';
  const title = document.createElement('h2');
  title.id = 'profile-title';
  title.textContent = entity.name;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'square-button';
  close.setAttribute('aria-label', 'Steckbrief schließen');
  close.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M1 1l14 14M15 1L1 15"/></svg>';
  close.addEventListener('click', onClose);

  header.append(title);
  if (flagKey && typeof entity[flagKey] === 'string') header.append(flagImage(entity[flagKey]));
  header.append(close);

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
