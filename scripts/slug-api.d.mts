// slug-api.mjs 的类型声明（模式同 slugs.d.mts）
export interface SlugApi {
  behavior: string | null;
  init: string | null;
  exports: string[];
  events: string[];
  sharedModule: boolean;
}
export function behaviorOf(slug: string): string | null;
export function slugApi(slug: string): SlugApi;
export function allSlugApi(): Record<string, SlugApi>;
