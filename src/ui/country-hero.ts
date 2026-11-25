import { attributePoint } from '../data/map';
import type { Entity, SetDefinition } from '../data/schema';
import type { CountryMap } from '../map/country-map';
import { renderCountryMap } from './country-map';
import { flagImage } from './flag-image';

function luminance(color: string) {
  const weights = [.2126, .7152, .0722];
  return weights.reduce((sum, weight, index) => {
    const channel = parseInt(color.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    return sum + weight * (channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  }, 0);
}

export function renderCountryHero(options: {
  entity: Entity;
  definition: SetDefinition;
  map?: CountryMap;
  onBack: () => void;
  position?: string;
  previousColor?: string;
}) {
  const { entity, definition, map, onBack, position, previousColor } = options;
  const profile = position === undefined;
  const colorKey = definition.attributes.find(({ type }) => type === 'color')?.key;
  const candidate = colorKey ? entity[colorKey] : null;
  const color = typeof candidate === 'string' && /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : '#E4E4E4';
  const lightness = luminance(color);
  const paperContrast = 1.05 / (lightness + .05);
  const inkContrast = (lightness + .05) / (luminance('#111111') + .05);
  const header = document.createElement('header');
  header.className = 'country-hero';
  header.style.setProperty('--country-color', color);
  header.style.setProperty('--previous-color', previousColor ?? 'var(--paper)');
  header.style.setProperty('--country-ink', paperContrast > inkContrast ? 'var(--paper)' : 'var(--ink)');
  const background = document.createElement('span');
  background.className = 'country-color';
  background.setAttribute('aria-hidden', 'true');
  const bar = document.createElement('div');
  bar.className = 'country-hero-bar';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'country-back';
  back.textContent = '← Karte';
  if (profile) back.setAttribute('aria-label', 'Steckbrief schließen');
  back.addEventListener('click', onBack);
  const counter = document.createElement('span');
  counter.className = 'meta-label';
  counter.textContent = position ?? 'Atlas';
  bar.append(back, counter);

  const identity = document.createElement('div');
  identity.className = 'country-identity';
  const flag = document.createElement('div');
  flag.className = 'country-hero-flag';
  const label = document.createElement('span');
  label.className = 'meta-label';
  label.textContent = definition.entityLabel;
  const mask = document.createElement('div');
  mask.className = 'country-name-mask';
  const title = document.createElement('h2');
  title.className = 'country-title';
  title.id = profile ? 'profile-title' : 'country-round-title';
  title.toggleAttribute('data-long', Array.from(entity.name).length > 10);
  title.tabIndex = -1;
  title.textContent = entity.name;
  mask.append(title);
  identity.append(flag, label, mask);

  const mapSlot = document.createElement('div');
  mapSlot.className = 'country-hero-point';
  header.append(background);
  if (map) {
    const pointAttribute = definition.attributes.find(({ point }) => point);
    const point = profile && pointAttribute ? attributePoint(entity, pointAttribute) : undefined;
    const outline = renderCountryMap(map, point ? `Umriss von ${entity.name} mit Hauptstadtpunkt` : `Umriss von ${entity.name}`, { answer: point });
    outline.svg.classList.add('country-silhouette');
    header.append(outline.svg);
  }
  header.append(mapSlot, bar, identity);

  function revealFlag(animate = true) {
    const flagKey = definition.attributes.find(({ type }) => type === 'flag')?.key;
    const value = flagKey ? entity[flagKey] : null;
    if (typeof value !== 'string' || flag.childElementCount) return;
    flag.toggleAttribute('data-drop', animate);
    flag.append(flagImage(value, `Flagge von ${entity.name}`));
  }
  if (profile) revealFlag(false);

  function setPointMap(svg?: SVGSVGElement) {
    header.toggleAttribute('data-point', Boolean(svg));
    mapSlot.replaceChildren(...(svg ? [svg] : []));
  }
  return { header, bar, color, setPointMap, revealFlag };
}
