import {DEFAULT_CONTROLS, ownedCategories, type Asset, type Controls, type Manifest} from './model';
export type Page = 'overview' | 'kernel' | 'type-detail';
export type View = 'gallery' | 'workbench' | 'compare';
export type State = {
  page: Page;
  view: View;
  scope: string;
  category: string;
  assetId: string;
  themeId: string;
  demoId: string;
  controls: Controls;
  frame: number;
  query: string;
  missing?: string;
};
export const defaultDemo = (asset: Asset) =>
  asset.demoIds.includes('experiment') ? 'experiment' : (asset.demoIds[0] ?? '');
export const firstFrame = (asset: Asset, demo = defaultDemo(asset)) =>
  asset.demonstrations?.find((d) => d.id === demo)?.from ?? 0;
export const primaryAsset = (manifest: Manifest, scope: string) =>
  manifest.assets.find((a) => a.owner === scope && a.kind === 'frame') ??
  manifest.assets.find((a) => a.owner === scope && a.kind === 'layout') ??
  manifest.assets.find((a) => a.owner === scope) ??
  manifest.assets[0];
export function route(
  manifest: Manifest,
  params: URLSearchParams,
  saved: Partial<State> = {},
): State {
  const requested = params.get('asset'),
    found = manifest.assets.find((a) => a.id === requested);
  const rawScope =
    params.get('tab') ??
    (requested ? (found?.owner ?? '') : (saved.scope ?? manifest.library.initialSuite ?? ''));
  const suite = manifest.suites.find((s) => s.name === rawScope);
  const legacyPage: Page = suite
    ? suite.role === 'kernel'
      ? 'kernel'
      : 'type-detail'
    : 'overview';
  const rawPage =
    params.get('page') ??
    (params.has('tab') || requested
      ? found
        ? legacyPage === 'overview'
          ? found.owner === manifest.library.kernel
            ? 'kernel'
            : 'type-detail'
          : legacyPage
        : legacyPage
      : (saved.page ?? (manifest.library.initialSuite ? legacyPage : 'overview')));
  let page: Page = ['overview', 'kernel', 'type-detail'].includes(rawPage)
    ? (rawPage as Page)
    : 'overview';
  let scope =
    page === 'kernel'
      ? manifest.library.kernel
      : page === 'type-detail'
        ? suite?.role === 'type'
          ? suite.name
          : found?.owner !== manifest.library.kernel
            ? (found?.owner ?? '')
            : ''
        : '';
  if (page === 'type-detail' && !manifest.library.typePacks.includes(scope)) {
    page = 'overview';
    scope = '';
  }
  if (found && page !== 'overview') {
    const context = manifest.suites.find((s) => s.name === scope);
    if (found.owner !== scope && !context?.refs.includes(found.id)) {
      scope = found.owner;
      page = scope === manifest.library.kernel ? 'kernel' : 'type-detail';
    }
  }
  const savedAsset =
    saved.page && saved.page === page && saved.scope === scope
      ? manifest.assets.find((a) => a.id === saved.assetId)
      : undefined;
  const asset = found ?? savedAsset ?? primaryAsset(manifest, scope || manifest.library.kernel);
  const mode =
    params.get('mode') ??
    ((params.has('page') || params.has('tab')) && !requested ? 'gallery' : saved.view);
  const view: View =
    requested && !found
      ? 'gallery'
      : found && (page === 'kernel' || page === 'type-detail')
        ? mode === 'compare'
          ? 'compare'
          : 'workbench'
        : mode === 'workbench' || mode === 'compare'
          ? page === 'kernel' || page === 'type-detail'
            ? mode
            : 'gallery'
          : 'gallery';
  const rawCategory =
    params.get('category') ??
    (params.has('page') || params.has('tab') ? 'all' : (saved.category ?? 'all'));
  const legacyCategories: Record<string, string> = {
    space: 'arrangement',
    content: 'primitive',
    appearance: 'layout',
    examples: 'example',
  };
  const category = legacyCategories[rawCategory] ?? rawCategory;
  const sameAsset = saved.assetId === asset.id;
  const demoId =
    sameAsset && asset.demoIds.includes(saved.demoId ?? '') ? saved.demoId! : defaultDemo(asset);
  return {
    page,
    scope,
    view,
    category: ownedCategories(manifest, scope).some((c) => c.kind === category) ? category : 'all',
    assetId: asset.id,
    themeId: saved.themeId ?? '',
    demoId,
    controls: {...DEFAULT_CONTROLS, ...saved.controls},
    frame: sameAsset && Number.isFinite(saved.frame) ? saved.frame! : firstFrame(asset, demoId),
    query: params.get('q') ?? '',
    missing: requested && !found ? '所选资产已移除，已返回所属目录。' : undefined,
  };
}
export function hashFor(state: State) {
  const params = new URLSearchParams({page: state.page});
  if (state.scope) params.set('tab', state.scope);
  if (state.view !== 'gallery' && !state.query) {
    params.set('asset', state.assetId);
    params.set('mode', state.view);
  }
  if (state.category !== 'all' && state.view === 'gallery' && !state.query)
    params.set('category', state.category);
  if (state.query) params.set('q', state.query);
  return '#' + params.toString();
}
export const routeKey = (state: State) =>
  [
    state.page,
    state.scope,
    state.query ? 'search' : state.view,
    state.query ? '' : state.view === 'gallery' ? state.category : state.assetId,
  ].join('|');
