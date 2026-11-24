import { attributeFormats } from '../quiz/attribute-questions';
import type { AttributeRoundSettings, Direction, createAttributeEngine } from '../quiz/attribute-questions';
import type { MapMode } from '../quiz/map-questions';

export type AttributeMode = 'category' | 'random';

export function configureAttributeMenu(
  menu: HTMLDialogElement,
  setLabel: string,
  attributeEngine: ReturnType<typeof createAttributeEngine>,
  onStart: (mode: AttributeMode, settings: AttributeRoundSettings) => void,
) {
  let configuredMode: AttributeMode = 'category';
  const categoryButton = menu.querySelector<HTMLButtonElement>('#category-mode')!;
  const randomButton = menu.querySelector<HTMLButtonElement>('#random-mode')!;
  const settings = menu.querySelector<HTMLFormElement>('#attribute-settings')!;
  const settingsTitle = settings.querySelector<HTMLElement>('#attribute-title')!;
  const categorySelect = settings.querySelector<HTMLSelectElement>('#attribute-category')!;
  const directionSelect = settings.querySelector<HTMLSelectElement>('#attribute-direction')!;
  const regionSelect = settings.querySelector<HTMLSelectElement>('#attribute-region')!;
  const formatSelect = settings.querySelector<HTMLSelectElement>('#attribute-format')!;
  const lengthSelect = settings.querySelector<HTMLSelectElement>('#attribute-length')!;
  const settingsStatus = settings.querySelector<HTMLElement>('.attribute-status')!;
  const startAttributes = settings.querySelector<HTMLButtonElement>('[type="submit"]')!;
  settings.querySelector('#attribute-set')!.textContent = setLabel;

  function readSettings(): AttributeRoundSettings {
    const categoryMode = configuredMode === 'category';
    return {
      category: categoryMode ? categorySelect.value : undefined,
      direction: categoryMode ? directionSelect.value as Direction : undefined,
      format: formatSelect.value as AttributeRoundSettings['format'],
      region: categoryMode ? undefined : regionSelect.value || undefined,
      length: lengthSelect.value === 'all' ? Infinity : Number(lengthSelect.value),
    };
  }

  function restrictOptions(select: HTMLSelectElement, allowed: readonly string[]) {
    for (const option of select.options) {
      option.disabled = !allowed.includes(option.value);
      option.hidden = option.disabled;
    }
    if (!allowed.includes(select.value)) select.value = allowed[0] ?? '';
  }

  function refreshSettings() {
    const categoryMode = configuredMode === 'category';
    const attribute = attributeEngine.categories.find(({ key }) => key === categorySelect.value);
    categorySelect.parentElement!.hidden = !categoryMode;
    directionSelect.parentElement!.hidden = !categoryMode;
    regionSelect.parentElement!.hidden = categoryMode || !attributeEngine.regions.length;
    if (categoryMode && attribute) {
      const directions = (['forward', 'reverse'] as const).filter((direction) => attributeFormats(attribute, direction).length);
      restrictOptions(directionSelect, directions);
      const formats = attributeFormats(attribute, directionSelect.value as Direction);
      restrictOptions(formatSelect, formats.includes('choice') && formats.includes('typed') ? [...formats, 'mixed'] : formats);
    } else {
      const formats = [...new Set(attributeEngine.categories.flatMap((item) =>
        [...attributeFormats(item, 'forward'), ...attributeFormats(item, 'reverse')]))];
      restrictOptions(formatSelect, formats.includes('choice') && formats.includes('typed') ? [...formats, 'mixed'] : formats);
    }
    const available = attributeEngine.createRound({ ...readSettings(), length: 1 }, () => 0.5).length > 0;
    startAttributes.disabled = !available;
    settingsStatus.hidden = available;
  }

  for (const { key, label } of attributeEngine.categories) categorySelect.add(new Option(label, key));
  for (const region of attributeEngine.regions) regionSelect.add(new Option(region, region));
  categoryButton.disabled = randomButton.disabled = !attributeEngine.categories.length;
  function configureAttributes(nextMode: typeof configuredMode) {
    configuredMode = nextMode;
    settingsTitle.textContent = nextMode === 'category' ? 'Kategorie' : 'Zufall';
    settings.hidden = false;
    categoryButton.setAttribute('aria-expanded', String(nextMode === 'category'));
    randomButton.setAttribute('aria-expanded', String(nextMode === 'random'));
    refreshSettings();
    settingsTitle.focus();
  }
  categoryButton.addEventListener('click', () => configureAttributes('category'));
  randomButton.addEventListener('click', () => configureAttributes('random'));
  settings.addEventListener('change', refreshSettings);
  settings.addEventListener('submit', (event) => {
    event.preventDefault();
    if (startAttributes.disabled) return;
    onStart(configuredMode, readSettings());
  });

  return (mode: MapMode | AttributeMode) => {
    categoryButton.setAttribute('aria-current', String(mode === 'category'));
    randomButton.setAttribute('aria-current', String(mode === 'random'));
  };
}
