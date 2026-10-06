/** scripts/migrate-engine.mjs 的类型声明（与 .mjs 同名的 .d.mts 会被 tsc 自动关联，无需 declare module 包装）。 */
export interface MigrateMap {
  version: number;
  classes: Record<string, string>;
  stateClassPrefix: string;
  attrs: string[];
  themePresets: string[];
  themeStyles: string[];
  varFamilies: string[];
  skippedThemeClasses: string[];
  protect?: string[];
}
export interface MigrateReport {
  changed: { file: string; replacements: number }[];
  warnings: string[];
  scanned: number;
}
export declare function buildMap(uiSrcDir: string): MigrateMap;
export declare function buildMapFromGit(repoRoot: string): MigrateMap;
export declare function compileMap(map: MigrateMap): unknown;
export declare function migratePaths(roots: string[], map: MigrateMap, opts?: { write?: boolean }): MigrateReport;
export declare function migrateCssText(text: string, R: unknown, warnings: string[], file: string): string;
export declare function migrateMarkupText(text: string, R: unknown, warnings: string[], file: string): string;
export declare function migrateCodeText(text: string, R: unknown, warnings: string[], file: string): string;
export declare function migrateMarkdownText(text: string, R: unknown, warnings: string[], file: string): string;
export declare function extractClassesFromCss(cssText: string): Set<string>;
export declare function extractDataAttrs(text: string): Set<string>;
export declare function collectFiles(roots: string[]): string[];
