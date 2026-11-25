import { attributePoint } from '../data/map';
import type { Entity, SetDefinition } from '../data/schema';
import type { CountryMap } from '../map/country-map';
import { renderCountryMap } from './country-map';
import { flagImage } from './flag-image';

const wideOutlineRatio = 1.6;
const nameMaxSize = 60;
const nameMinSize = 36;
const nameSizeStep = 2;

function fitCountryName(art: HTMLElement, measure: HTMLElement, name: string, wide: boolean) {
  const width = art.clientWidth - 32;
  if (width <= 0) return;

  function measureAt(text: string, size: number) {
    measure.style.fontSize = `${size}px`;
    measure.textContent = text;
    return Math.ceil(measure.getBoundingClientRect().width);
  }

  const sideWidth = Math.floor(width * .66);
  const widestWord = Math.max(...name.split(/\s+/).map((word) => measureAt(word, nameMinSize)));
  const stack = wide || widestWord > sideWidth;
  const limit = stack ? Math.max(width, widestWord) : sideWidth;
  let size = nameMaxSize;
  let nameWidth = measureAt(name, size);
  while (size > nameMinSize && nameWidth > limit) {
    size -= nameSizeStep;
    nameWidth = measureAt(name, size);
  }

  art.toggleAttribute('data-stack-outline', stack);
  art.style.setProperty('--country-identity-width', `${Math.max(70, Math.min(nameWidth, limit))}px`);
  art.style.setProperty('--country-name-size', `${size}px`);
  art.style.setProperty('--country-name-width', `${stack ? limit : Math.min(nameWidth, limit)}px`);
  art.style.setProperty('--country-name-scale', String(Math.min(1, width / limit)));
}

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
  overlay?: boolean;
}) {
  const { entity, definition, map, onBack, position, previousColor, overlay } = options;
  const profile = position === undefined;
  const colorKey = definition.attributes.find(({ type }) => type === 'color')?.key;
  const candidate = colorKey ? entity[colorKey] : null;
  const color = typeof candidate === 'string' && /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : '#E4E4E4';
  const lightness = luminance(color);
  const paperContrast = 1.05 / (lightness + .05);
  const inkContrast = (lightness + .05) / (luminance('#111111') + .05);
  const wide = Boolean(map && map.aspect > wideOutlineRatio);
  const header = document.createElement('header');
  header.className = 'country-hero';
  header.toggleAttribute('data-wide', wide);
  header.toggleAttribute('data-profile-overlay', Boolean(overlay));
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
  back.textContent = overlay ? '×' : '← Karte';
  if (profile) back.setAttribute('aria-label', 'Steckbrief schließen');
  back.addEventListener('click', onBack);
  const counter = document.createElement('span');
  counter.className = 'meta-label';
  counter.textContent = position ?? 'Atlas';
  if (overlay) bar.append(counter, back);
  else bar.append(back, counter);

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
  title.className = 'country-title country-name-type';
  title.id = overlay ? 'quiz-profile-title' : profile ? 'profile-title' : 'country-round-title';
  title.tabIndex = -1;
  title.textContent = entity.name;
  mask.append(title);
  identity.append(flag, label, mask);

  const mapSlot = document.createElement('div');
  mapSlot.className = 'country-hero-point';
  const art = document.createElement('div');
  art.className = 'country-hero-art';
  if (map) {
    const pointAttribute = definition.attributes.find(({ point }) => point);
    const point = profile && pointAttribute ? attributePoint(entity, pointAttribute) : undefined;
    const outline = renderCountryMap(map, point ? `Umriss von ${entity.name} mit Hauptstadtpunkt` : `Umriss von ${entity.name}`, { answer: point });
    outline.svg.classList.add('country-silhouette');
    art.append(outline.svg);
  }
  art.append(mapSlot, identity);
  const measure = document.createElement('span');
  measure.className = 'country-name-type country-name-measure';
  measure.setAttribute('aria-hidden', 'true');
  header.append(background, bar, art, measure);

  let measuredWidth = 0;
  let disposed = false;
  const fit = (force = false) => {
    if (disposed || !header.isConnected) return;
    const width = art.clientWidth;
    if (force || measuredWidth !== width) fitCountryName(art, measure, entity.name, wide || header.hasAttribute('data-point'));
    measuredWidth = width;
  };
  const sizes = new ResizeObserver(() => fit());
  sizes.observe(art);
  void document.fonts?.ready.then(() => fit(true));

  function revealFlag(animate = true) {
    const flagKey = definition.attributes.find(({ type }) => type === 'flag')?.key;
    const value = flagKey ? entity[flagKey] : null;
    if (typeof value !== 'string' || flag.childElementCount) return;
    flag.toggleAttribute('data-drop', animate);
    flag.append(flagImage(value, `Flagge von ${entity.name}`));
  }
  if (profile) revealFlag(false);

  function setPointMap(map?: HTMLElement) {
    const changed = Boolean(map) !== header.hasAttribute('data-point');
    header.toggleAttribute('data-point', Boolean(map));
    mapSlot.replaceChildren(...(map ? [map] : []));
    if (changed) fit(true);
  }
  function dispose() {
    disposed = true;
    sizes.disconnect();
  }
  return { header, bar, color, setPointMap, revealFlag, dispose };
}
