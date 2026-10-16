import type themes from '../src/tokens/themes.json';
export function renderThemeColors(catalogue: typeof themes): string;
export function generateThemeColors(check?: boolean): Promise<typeof themes>;
