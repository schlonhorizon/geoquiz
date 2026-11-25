import { roundSettingsSchema } from '../quiz/round-settings';
import type { RoundSettings } from '../quiz/round-settings';

export interface SettingsStore {
  load(setId: string, presetId: string): RoundSettings | undefined;
  save(setId: string, presetId: string, settings: RoundSettings): void;
}

export class LocalSettingsStore implements SettingsStore {
  private readonly memory = new Map<string, RoundSettings>();

  load(setId: string, presetId: string): RoundSettings | undefined {
    const key = this.key(setId, presetId);
    const cached = this.memory.get(key);
    if (cached) return cached;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const data = roundSettingsSchema.safeParse(JSON.parse(raw));
      return data.success ? data.data : undefined;
    } catch {
      return undefined;
    }
  }

  save(setId: string, presetId: string, settings: RoundSettings): void {
    const key = this.key(setId, presetId);
    this.memory.set(key, settings);
    try {
      window.localStorage.setItem(key, JSON.stringify(settings));
    } catch {
      // Keep the most recent settings for this session even if storage is unavailable.
    }
  }

  private key(setId: string, presetId: string) {
    return `geoquiz:settings:v1:${setId}:${presetId}`;
  }
}
