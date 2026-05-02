export const VISUAL_SETTINGS_STORAGE_KEY = 'cashly_visual_settings';
export const VISUAL_SETTINGS_EVENT = 'cashly_visual_change';

export const VISUAL_DEFAULTS = {
  particleCount: 40,
  particleSpeed: 1.0,
  particleSize: 0.5,
  particleOpacity: 0.29,
  particleFadeZone: 0.59,
  glowOpacity: 0.46,
  glowWidth: 810,
  glowHeight: 600,
  glowY: -180,
  particleShape: 'circle' as 'circle' | 'snowflake',
};

export type VisualSettings = typeof VISUAL_DEFAULTS;

type NumericVisualKey = Exclude<keyof VisualSettings, 'particleShape'>;

const NUMERIC_LIMITS: Record<NumericVisualKey, { min: number; max: number }> = {
  particleCount: { min: 10, max: 400 },
  particleSpeed: { min: 0.1, max: 5 },
  particleSize: { min: 0.2, max: 4 },
  particleOpacity: { min: 0, max: 1 },
  particleFadeZone: { min: 0.05, max: 0.9 },
  glowOpacity: { min: 0, max: 1 },
  glowWidth: { min: 300, max: 2000 },
  glowHeight: { min: 100, max: 1200 },
  glowY: { min: -600, max: 200 },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function normalizeVisualSettings(input: unknown): VisualSettings {
  const source = input && typeof input === 'object' ? input as Partial<VisualSettings> : {};
  const next: VisualSettings = { ...VISUAL_DEFAULTS };

  (Object.keys(NUMERIC_LIMITS) as NumericVisualKey[]).forEach((key) => {
    const value = Number(source[key]);
    const fallback = VISUAL_DEFAULTS[key];
    const { min, max } = NUMERIC_LIMITS[key];
    next[key] = clamp(Number.isFinite(value) ? value : fallback, min, max);
  });

  next.particleShape = source.particleShape === 'snowflake' ? 'snowflake' : 'circle';
  next.particleCount = Math.round(next.particleCount);
  return next;
}

export function loadCachedVisualSettings(): VisualSettings {
  if (typeof window === 'undefined') return { ...VISUAL_DEFAULTS };
  try {
    const raw = window.localStorage.getItem(VISUAL_SETTINGS_STORAGE_KEY);
    return raw ? normalizeVisualSettings(JSON.parse(raw)) : { ...VISUAL_DEFAULTS };
  } catch {
    return { ...VISUAL_DEFAULTS };
  }
}

export function cacheVisualSettings(settings: unknown): VisualSettings {
  const normalized = normalizeVisualSettings(settings);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(VISUAL_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    } catch {}
    window.dispatchEvent(new CustomEvent<VisualSettings>(VISUAL_SETTINGS_EVENT, { detail: normalized }));
  }
  return normalized;
}

export function subscribeToVisualSettings(onChange: (settings: VisualSettings) => void) {
  if (typeof window === 'undefined') return () => {};

  const handleLocalChange = (event: Event) => {
    const detail = (event as CustomEvent<VisualSettings>).detail;
    onChange(detail ? normalizeVisualSettings(detail) : loadCachedVisualSettings());
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === VISUAL_SETTINGS_STORAGE_KEY) onChange(loadCachedVisualSettings());
  };

  window.addEventListener(VISUAL_SETTINGS_EVENT, handleLocalChange);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(VISUAL_SETTINGS_EVENT, handleLocalChange);
    window.removeEventListener('storage', handleStorage);
  };
}

export async function fetchVisualSettings(signal?: AbortSignal): Promise<VisualSettings> {
  const response = await fetch('/api/visual-settings', {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`Failed to load visual settings (${response.status})`);
  const data = await response.json();
  return cacheVisualSettings(data?.settings);
}
