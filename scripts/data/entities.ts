import { parse } from 'csv-parse/sync';
import type { AttributeDefinition, Entity, EntityValue, SetDefinition } from '../../src/data/schema';
import { normalizeAnswer } from '../../src/match/answers';
import type { DataIssues } from './issues';

type ColumnRole = 'id' | 'name' | 'aliases' | 'attribute' | 'lat' | 'lon' | 'flag' | 'flag-similar' | 'note' | 'alternatives';

interface CsvRecord {
  record: string[];
  info: { lines: number };
}

function getColumnRoles(definition: SetDefinition, issues: DataIssues): Map<string, ColumnRole> {
  const roles = new Map<string, ColumnRole>([
    ['id', 'id'],
    ['name', 'name'],
    ['name_aliases', 'aliases'],
  ]);

  function register(column: string, role: ColumnRole) {
    const previous = roles.get(column);
    if (previous && (previous !== role || role === 'attribute' || role === 'flag' || role === 'alternatives')) {
      issues.errors.push(`Spalte "${column}" ist mehrfach oder widersprüchlich definiert.`);
    } else {
      roles.set(column, role);
    }
  }

  for (const attribute of definition.attributes) {
    register(attribute.key, attribute.type === 'flag' ? 'flag' : 'attribute');
    if (attribute.aliasesColumn) {
      register(attribute.aliasesColumn, 'aliases');
    }
    if (attribute.noteColumn) register(attribute.noteColumn, 'note');
    if (attribute.emptyValueColumn) register(attribute.emptyValueColumn, 'note');
    if (attribute.point) {
      register(attribute.point.lat, 'lat');
      register(attribute.point.lon, 'lon');
    }
    if ('alternativeValuesColumn' in attribute && attribute.alternativeValuesColumn) {
      register(attribute.alternativeValuesColumn, 'alternatives');
    }
    if (attribute.type === 'enum' && new Set(attribute.values).size !== attribute.values.length) {
      issues.errors.push(`Attribut "${attribute.key}" enthält doppelte Enum-Werte.`);
    }
  }
  if (definition.attributes.some(({ type }) => type === 'flag')) register('flag_similar', 'flag-similar');

  return roles;
}

function splitList(value: string): string[] {
  return value.split('|').map((item) => item.trim()).filter(Boolean);
}

function parseNumber(value: string): number {
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(value)) {
    return NaN;
  }
  return Number(value.replace(',', '.'));
}

function parseAttribute(value: string, attribute: AttributeDefinition, context: string, issues: DataIssues): EntityValue {
  if (!value) {
    return null;
  }

  switch (attribute.type) {
    case 'flag':
      return null; // Populated from ISO codes by the build.
    case 'text':
      return value;
    case 'color':
      if (!/^#[0-9a-f]{6}$/i.test(value)) {
        issues.errors.push(`${context}: Erwartet wird eine Hex-Farbe im Format #RRGGBB.`);
      }
      return value;
    case 'enum':
      if (!attribute.values.includes(value)) {
        issues.errors.push(`${context}: "${value}" ist kein erlaubter Enum-Wert.`);
      }
      return value;
    case 'list':
    case 'entityRefList': {
      const items = splitList(value);
      return items.length > 0 ? items : null;
    }
    case 'boolean':
      if (value === 'true' || value === 'false') {
        return value === 'true';
      }
      issues.errors.push(`${context}: Erwartet wird "true" oder "false", gefunden wurde "${value}".`);
      return null;
    case 'number': {
      const number = parseNumber(value);
      if (Number.isFinite(number)) {
        return number;
      }
      issues.errors.push(`${context}: Ungültige Zahl "${value}".`);
      return null;
    }
  }
}

export function readEntities(csv: string, definition: SetDefinition, issues: DataIssues): Map<string, Entity> {
  // The parser returns record envelopes with info enabled, which its sync types omit.
  const records: unknown = parse(csv, {
    bom: true,
    delimiter: ';',
    info: true,
    skip_empty_lines: true,
  });
  const [header, ...rows] = records as CsvRecord[];
  if (!header) {
    throw new Error('Die CSV-Kopfzeile fehlt.');
  }

  const roles = getColumnRoles(definition, issues);
  const attributes = new Map(definition.attributes.map((attribute) => [attribute.key, attribute]));
  const headers = header.record.map((cell) => cell.trim());
  if (headers.includes('')) {
    issues.errors.push('Die CSV enthält eine Spalte ohne Namen.');
  }
  if (new Set(headers).size !== headers.length) {
    issues.errors.push('Die CSV enthält doppelte Spaltennamen.');
  }

  for (const column of headers) {
    if (column && !roles.has(column)) {
      issues.warnings.push(`CSV-Spalte "${column}" hat keine Attribut-Definition.`);
    } else if (roles.get(column) === 'flag') {
      issues.errors.push(`CSV-Spalte "${column}" wird aus der Entity-ID erzeugt.`);
    }
  }
  const requiresNameAliases = definition.attributes.some(({ aliasesColumn }) => aliasesColumn === 'name_aliases');
  for (const [column, role] of roles) {
    if (role === 'flag' || role === 'flag-similar') continue;
    if ((column !== 'name_aliases' || requiresNameAliases) && !headers.includes(column)) {
      issues.errors.push(`Erforderliche CSV-Spalte "${column}" fehlt.`);
    }
  }

  const idColumn = headers.indexOf('id');
  const nameColumn = headers.indexOf('name');
  const nameAliasesColumn = headers.indexOf('name_aliases');
  const idPattern = definition.parent ? /^[A-Z]{2}-[A-Z0-9]{1,3}$/ : /^[A-Z]{3}$/;
  const entities = new Map<string, Entity>();

  for (const { record, info } of rows) {
    const cells = record.map((cell) => cell.trim());
    const id = cells[idColumn] ?? '';
    const name = cells[nameColumn] ?? '';
    const location = `Zeile ${info.lines}${id ? ` (${id})` : ''}`;
    if (idColumn !== -1 && !idPattern.test(id)) {
      issues.errors.push(`${location}: Ungültige ID (erwartet wird ${definition.parent ? 'ISO 3166-2' : 'ISO 3166-1 alpha-3'}).`);
    }
    if (nameColumn !== -1 && !name) {
      issues.errors.push(`${location}: Der Name fehlt.`);
    }
    if (entities.has(id)) {
      issues.errors.push(`${location}: Doppelte ID "${id}".`);
      continue;
    }

    const values = new Map<string, EntityValue>();
    for (const [index, column] of headers.entries()) {
      const cell = cells[index] ?? '';
      const role = roles.get(column);
      const attribute = attributes.get(column);
      const context = `${location}, Spalte "${column}"`;
      if (role === 'attribute' && attribute) {
        values.set(column, parseAttribute(cell, attribute, context, issues));
      } else if (role === 'note') {
        values.set(column, cell || null);
      } else if (role === 'alternatives') {
        const alternatives = splitList(cell);
        values.set(column, alternatives.length ? alternatives : null);
      } else if ((role === 'aliases' && column !== 'name_aliases') || role === 'flag-similar') {
        values.set(column, splitList(cell));
      } else if (role === 'lat' || role === 'lon') {
        const limit = role === 'lat' ? 90 : 180;
        const coordinate = cell ? parseNumber(cell) : null;
        if (coordinate !== null && !(coordinate >= -limit && coordinate <= limit)) {
          issues.errors.push(`${context}: Koordinate "${cell}" liegt außerhalb von −${limit} bis ${limit} oder ist ungültig.`);
        }
        values.set(column, coordinate);
      }
    }

    for (const attribute of definition.attributes) {
      const { key, point, emptyValueColumn } = attribute;
      const primary = values.get(key);
      if (point) {
        const latitude = values.get(point.lat);
        const longitude = values.get(point.lon);
        if ((latitude == null) !== (longitude == null) || (point.required && primary != null && latitude == null)) {
          issues.errors.push(`${location}, Attribut "${key}": Breiten- und Längengrad müssen zusammen angegeben werden.`);
        }
      }
      if (emptyValueColumn && values.get(emptyValueColumn) != null && primary != null) {
        issues.errors.push(`${location}, Spalte "${emptyValueColumn}": Der Hinweis ist nur bei leerem Wert in "${key}" zulässig.`);
      }
      if ('alternativeValuesColumn' in attribute && attribute.alternativeValuesColumn) {
        const column = attribute.alternativeValuesColumn;
        const alternatives = values.get(column);
        if (!Array.isArray(alternatives)) continue;
        const context = `${location}, Spalte "${column}"`;
        if (primary == null) issues.errors.push(`${context}: Der Hauptwert in "${key}" fehlt.`);
        const normalized = alternatives.map(normalizeAnswer);
        if (new Set(normalized).size !== alternatives.length || (typeof primary === 'string' && normalized.includes(normalizeAnswer(primary)))) {
          issues.errors.push(`${context}: Hauptwert und Alternativen müssen verschieden sein.`);
        }
        if (attribute.type === 'enum') {
          for (const value of alternatives) {
            if (!attribute.values.includes(value)) issues.errors.push(`${context}: "${value}" ist kein erlaubter Enum-Wert.`);
          }
        }
      }
    }

    if (id) {
      entities.set(id, {
        id,
        name,
        name_aliases: splitList(cells[nameAliasesColumn] ?? ''),
        ...Object.fromEntries(values),
      });
    }
  }

  for (const [id, { flag_similar }] of entities) {
    if (!Array.isArray(flag_similar)) continue;
    for (const reference of flag_similar) {
      if (reference === id || !entities.has(reference)) {
        issues.errors.push(`${id}, Spalte "flag_similar": Ungültige Entity-ID "${reference}".`);
      }
    }
  }

  for (const { key, type } of definition.attributes) {
    if (type !== 'entityRefList') {
      continue;
    }

    for (const [id, entity] of entities) {
      const references = entity[key];
      if (!Array.isArray(references)) {
        continue;
      }

      for (const reference of references) {
        const target = entities.get(reference);
        const reverse = target?.[key];
        if (!target) {
          issues.errors.push(`${id}, Spalte "${key}": Unbekannte Entity-ID "${reference}".`);
        } else if (key === 'neighbors' && !(Array.isArray(reverse) && reverse.includes(id))) {
          issues.warnings.push(`Nachbarschaft ${id} → ${reference} ist nicht symmetrisch.`);
        }
      }
    }
  }

  return entities;
}
