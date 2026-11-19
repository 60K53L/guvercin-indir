/**
 * Tema kimlikleri — CSS içe ALMAZ.
 *
 * Hem tarayıcı (src/themes.js) hem de saf Node betikleri (src/schema.js,
 * scripts/test-*.mjs) bu listeyi kullanır. `import css from '?raw'` içeren
 * modülleri Node yükleyemediği için kimlikler burada ayrı tutulur.
 */
export const THEME_IDS = ['guncel', 'zumrut', 'aydinlik', 'kizil', 'gokyuzu', 'dumanli', 'saray']

export const FALLBACK_THEME = 'dumanli'

/** Tanınmayan/değer yoksa yedeğe düşer. */
export function normalizeThemeId(id) {
  return THEME_IDS.includes(id) ? id : FALLBACK_THEME
}