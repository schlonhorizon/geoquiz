import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import isoCountries from 'i18n-iso-countries';

export const flagPackage = dirname(createRequire(import.meta.url).resolve('flag-icons/package.json'));
export const flagDirectory = join(flagPackage, 'flags', '4x3');

export function flagCode(id: string) {
  return id === 'XKX' ? 'xk' : isoCountries.alpha3ToAlpha2(id)?.toLowerCase();
}
