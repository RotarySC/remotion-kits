import React from 'react';
import {createRoot} from 'react-dom/client';
import {Stage, FrameAt, ScaleProvider, useFrames} from './stage';
import {NativeDemo, demoCode} from './demos';
import {
  DEFAULT_CONTROLS,
  KIND_LABELS,
  ownedCategories,
  trialWindow,
  type Asset,
  type Controls,
  type Manifest,
  type Registry,
  type Kind,
} from './model';
import {WORKBENCH_STYLES} from './workbench-styles';
import {LibraryPages} from './library-pages';
import {
  route,
  hashFor,
  routeKey,
  primaryAsset,
  defaultDemo,
  firstFrame,
  type State,
  type Page,
} from './navigation';

type Status = {
  phase: string;
  buildId: string | null;
  lastSuccess: string | null;
  source: string;
  error: string | null;
  pending: boolean;
};
const experimentNames = new Set(['Flow', 'Panel', 'ScrollArea', 'FreeComposition']);
const relativeFrame = (asset: Asset, demo: string) =>
  asset.demonstrations?.find((d) => d.id === demo);
function storageKey(manifest: Manifest) {
  return 'kit-showcase:v3:' + manifest.source.path;
}
function initial(manifest: Manifest): State {
  let saved: Partial<State> = {};
  try {
    saved = JSON.parse(sessionStorage.getItem(storageKey(manifest)) ?? '{}');
  } catch {}
  return route(manifest, new URLSearchParams(location.hash.slice(1)), saved);
}
class DemoError extends React.Component<
  {reset: string; children: React.ReactNode},
  {error: string | null}
> {
  state = {error: null as string | null};
  static getDerivedStateFromError(error: Error) {
    return {error: error.message};
  }
  componentDidUpdate(previous: any) {
    if (previous.reset !== this.props.reset && this.state.error) this.setState({error: null});
  }
  render() {
    return this.state.error ? (
      <div className="demo-error">演示无法挂载：{this.state.error}</div>
    ) : (
      this.props.children
    );
  }
}
function Canvas({
  asset,
  registry,
  themeSuite,
  themeId,
  demo,
  c,
  frame,
  compact = false,
}: {
  asset: Asset;
  registry: Registry;
  themeSuite: string;
  themeId: string;
  demo: string;
  c: Controls;
  frame: number;
  compact?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null),
    [width, setWidth] = React.useState(900),
    [nativeHeight, setNativeHeight] = React.useState(1080),
    scale = Math.min(width / 1920, (compact ? 190 : 460) / nativeHeight);
  React.useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const observer = new ResizeObserver(() => setWidth(root.clientWidth));
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  React.useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const natural = root.querySelector('[data-native-body]') as HTMLElement | null;
    if (!natural) {
      setNativeHeight(1080);
      return;
    }
    const observer = new ResizeObserver(() =>
      setNativeHeight(Math.max(1080, natural.offsetHeight)),
    );
    observer.observe(natural);
    return () => observer.disconnect();
  }, [asset.id, demo, c.length, c.height, themeId]);
  return (
    <div
      className={'canvas ' + (compact ? 'compact' : '')}
      ref={ref}
      style={{
        height: compact ? 190 : Math.min(460, nativeHeight * scale),
        background: registry[themeSuite]?.getTheme?.(themeId)?.color.bg ?? '#18201b',
      }}
    >
      <div
        className="native-scene"
        style={{
          width: 1920,
          height: nativeHeight,
          transform: `scale(${scale})`,
          left: '50%',
          top: '50%',
          marginLeft: -960,
          marginTop: -nativeHeight / 2,
        }}
      >
        <ScaleProvider scale={scale}>
          <FrameAt frame={frame}>
            <DemoError reset={JSON.stringify([asset.id, demo, themeId, c])}>
              <NativeDemo
                asset={asset}
                registry={registry}
                themeSuite={themeSuite}
                themeId={themeId}
                demo={demo}
                c={c}
              />
            </DemoError>
          </FrameAt>
        </ScaleProvider>
      </div>
    </div>
  );
}
function Card({
  asset,
  registry,
  themeSuite,
  themeId,
  onSelect,
  reduced,
  image,
}: {
  asset: Asset;
  registry: Registry;
  themeSuite: string;
  themeId: string;
  onSelect: () => void;
  reduced: boolean;
  image?: string;
}) {
  const [hover, setHover] = React.useState(false),
    [visible, setVisible] = React.useState(false),
    ref = React.useRef<HTMLDivElement>(null);
  const demonstration = asset.demonstrations?.[0],
    demo = asset.demoIds.includes('experiment') ? 'experiment' : (asset.demoIds[0] ?? ''),
    spec = demonstration
      ? {kind: 'loop' as const, from: demonstration.from, duration: demonstration.duration}
      : {kind: 'once' as const, to: asset.demoFrame};
  const frame = useFrames(spec, hover && !reduced);
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {rootMargin: '180px'},
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <article
      className="asset-card"
      data-asset-id={asset.id}
      data-owner={asset.owner}
      data-kind={asset.kind}
      ref={ref}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        className="card-preview"
        onClick={onSelect}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        aria-label={'打开 ' + asset.name + ' ' + asset.label}
      >
        {image ? (
          <img className="static-thumb" src={image} alt={asset.label + ' · 静态定格'} />
        ) : visible && asset.demoIds.length ? (
          <Canvas
            asset={asset}
            registry={registry}
            themeSuite={themeSuite}
            themeId={themeId}
            demo={demo}
            c={{...DEFAULT_CONTROLS}}
            frame={frame}
            compact
          />
        ) : (
          <div className="no-demo">
            {asset.demoIds.length ? '正在准备预览' : '已发现 · 尚无演示'}
          </div>
        )}
      </button>
      <button className="card-info" onClick={onSelect}>
        <span className="card-name">
          <code>{asset.name}</code>
          <span>{asset.label}</span>
        </span>
        <p>{asset.purpose}</p>
        <span className="card-footer">
          <span>
            {asset.owner} · {KIND_LABELS[asset.kind]}
          </span>
          <span>试一试 ↗</span>
        </span>
      </button>
    </article>
  );
}
function useReducedMotion() {
  const [reduced, setReduced] = React.useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  React.useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)'),
      update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}
function App({manifest, registry}: {manifest: Manifest; registry: Registry}) {
  const [state, setState] = React.useState(() => initial(manifest)),
    [playing, setPlaying] = React.useState(false),
    [panel, setPanel] = React.useState<'parameters' | 'usage'>('parameters'),
    [status, setStatus] = React.useState<Status | null>(null),
    [syncOpen, setSyncOpen] = React.useState(false),
    [message, setMessage] = React.useState(''),
    [dark, setDark] = React.useState(false),
    [staticThumbs, setStaticThumbs] = React.useState(false),
    [typePacksOpen, setTypePacksOpen] = React.useState(false),
    [anchorRequest, setAnchorRequest] = React.useState(0),
    [activeCategory, setActiveCategory] = React.useState(''),
    dialogRef = React.useRef<HTMLDialogElement>(null),
    searchRef = React.useRef<HTMLInputElement>(null),
    workspaceRef = React.useRef<HTMLElement>(null),
    typePacksRef = React.useRef<HTMLButtonElement>(null),
    stateRef = React.useRef(state),
    previousRoute = React.useRef(routeKey(state)),
    hydrated = React.useRef(false),
    reduced = useReducedMotion();
  stateRef.current = state;
  const asset = manifest.assets.find((a) => a.id === state.assetId) ?? manifest.assets[0],
    scopeSuite = manifest.suites.find((s) => s.name === state.scope),
    ownerSuite = manifest.suites.find((s) => s.name === asset.owner) ?? manifest.suites[0];
  const canUseScopeTheme =
    ['primitive', 'arrangement', 'motion', 'skin', 'example'].includes(asset.kind) &&
    asset.name !== 'FreeComposition';
  const themeSuite = canUseScopeTheme && scopeSuite?.themeIds.length ? scopeSuite : ownerSuite;
  const themes = themeSuite.themeIds,
    themeId =
      asset.kind === 'theme'
        ? asset.name
        : themes.includes(state.themeId)
          ? state.themeId
          : (themes[0] ?? '');
  const demo = asset.demoIds.includes(state.demoId)
      ? state.demoId
      : asset.demoIds.includes('experiment')
        ? 'experiment'
        : (asset.demoIds[0] ?? ''),
    range = relativeFrame(asset, demo),
    start = range?.from ?? 0,
    duration = range?.duration ?? Math.max(90, state.controls.start + state.controls.duration + 15),
    end = start + duration - 1,
    frame = Math.min(end, Math.max(start, state.frame));
  const patch = (change: Partial<State>) => setState((before) => ({...before, ...change}));
  const control = <K extends keyof Controls>(key: K, value: Controls[K]) =>
    setState((before) => ({...before, controls: {...before.controls, [key]: value}}));
  const navigate = (page: Page, target = '', category = 'all') => {
    setPlaying(false);
    setTypePacksOpen(false);
    setAnchorRequest((request) => request + 1);
    const scope =
      page === 'kernel' ? manifest.library.kernel : page === 'type-detail' ? target : '';
    const next = primaryAsset(manifest, scope || manifest.library.kernel);
    patch({
      page,
      scope,
      view: 'gallery',
      category,
      query: '',
      assetId: next.id,
      demoId: defaultDemo(next),
      frame: firstFrame(next),
      themeId: '',
      missing: undefined,
    });
  };
  const openTypePacks = () => {
    setTypePacksOpen(true);
    typePacksRef.current?.focus({preventScroll: true});
    const sidebar = typePacksRef.current?.closest<HTMLElement>('.sidebar');
    if (sidebar) sidebar.scrollTop = 0;
  };
  const choose = (a: Asset, context?: string) => {
    setPlaying(false);
    setTypePacksOpen(false);
    const requested = manifest.suites.find((s) => s.name === (context ?? scopeSuite?.name));
    const scope = requested?.refs.includes(a.id) ? requested.name : a.owner;
    patch({
      page: scope === manifest.library.kernel ? 'kernel' : 'type-detail',
      scope,
      assetId: a.id,
      demoId: defaultDemo(a),
      view: 'workbench',
      frame: firstFrame(a),
      themeId: '',
      query: '',
      missing: undefined,
    });
  };
  const notify = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 2800);
  };
  React.useEffect(() => {
    const restore = () => {
      setPlaying(false);
      setState((before) => route(manifest, new URLSearchParams(location.hash.slice(1)), before));
    };
    window.addEventListener('hashchange', restore);
    window.addEventListener('popstate', restore);
    return () => {
      window.removeEventListener('hashchange', restore);
      window.removeEventListener('popstate', restore);
    };
  }, []);
  React.useEffect(() => {
    const hash = hashFor(state),
      key = routeKey(state);
    if (hash !== location.hash) {
      if (hydrated.current && key !== previousRoute.current) history.pushState(null, '', hash);
      else history.replaceState(null, '', hash);
    }
    hydrated.current = true;
    previousRoute.current = key;
    try {
      sessionStorage.setItem(storageKey(manifest), JSON.stringify(state));
    } catch {}
  }, [state]);
  React.useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const section =
      state.view === 'gallery' && !state.query && state.category !== 'all'
        ? workspace.querySelector<HTMLElement>('[data-owned-kind="' + state.category + '"]')
        : null;
    workspace.scrollTop = section
      ? workspace.scrollTop +
        section.getBoundingClientRect().top -
        workspace.getBoundingClientRect().top -
        20
      : 0;
  }, [
    state.page,
    state.scope,
    state.category,
    state.view,
    state.assetId,
    state.query,
    anchorRequest,
  ]);
  React.useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace || state.view !== 'gallery' || state.query) {
      setActiveCategory('');
      return;
    }
    let scheduled = 0;
    const update = () => {
      scheduled = 0;
      const sections = Array.from(workspace.querySelectorAll<HTMLElement>('[data-owned-kind]'));
      const edge = workspace.getBoundingClientRect().top + 21;
      let current = sections[0]?.dataset.ownedKind ?? '';
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= edge) current = section.dataset.ownedKind!;
      }
      // 最后一个分组可能无法顶齐窗口；到底时仍标明最后一类。
      if (
        workspace.scrollTop > 0 &&
        workspace.scrollTop + workspace.clientHeight >= workspace.scrollHeight - 2
      )
        current = sections[sections.length - 1]?.dataset.ownedKind ?? '';
      setActiveCategory(current);
    };
    const onScroll = () => {
      if (!scheduled) scheduled = requestAnimationFrame(update);
    };
    update();
    workspace.addEventListener('scroll', onScroll, {passive: true});
    return () => {
      workspace.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(scheduled);
    };
  }, [manifest, state.page, state.scope, state.view, state.query]);
  React.useEffect(() => {
    if (!playing || reduced) return;
    let raf = 0;
    const beginning = performance.now(),
      base = frame;
    const tick = (now: number) => {
      const next = base + Math.floor(((now - beginning) * 30) / 1000);
      if (next > end) {
        setPlaying(false);
        patch({frame: end});
        return;
      }
      patch({frame: next});
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, reduced, start, end]);
  React.useEffect(() => {
    if (!['http:', 'https:'].includes(location.protocol)) return;
    let mounted = true;
    const poll = async () => {
      try {
        const response = await fetch('/__showcase_status', {cache: 'no-store'});
        if (!response.ok) return;
        const next: Status = await response.json();
        if (!mounted) return;
        setStatus(next);
        if (
          next.phase === 'ready' &&
          !next.pending &&
          next.buildId &&
          next.buildId !== manifest.buildId
        ) {
          sessionStorage.setItem(storageKey(manifest), JSON.stringify(stateRef.current));
          location.reload();
        }
      } catch {}
    };
    void poll();
    const timer = setInterval(poll, 1200);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);
  React.useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);
  React.useEffect(() => {
    if (syncOpen) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [syncOpen]);
  React.useEffect(() => {
    (window as any).__DSH_MANIFEST__ = manifest;
    (window as any).__DSH_GALLERY_STATE__ = state;
  }, [state]);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify('已复制。');
    } catch {
      notify('剪贴板不可用，请选择文本手动复制。');
    }
  };
  const sourceLabel = manifest.source.kind === 'master' ? '套件母版' : '隔离验证母版';
  const failed = status?.phase === 'failed',
    building = status?.phase === 'building' || status?.pending;
  const parameters = () => {
    const c = state.controls,
      experiment = demo === 'experiment';
    if (!experiment)
      return (
        <>
          <p className="help">
            这是既有夹具。选择不同场景、主题或帧查看效果；其内容声明仍由原夹具持有。
          </p>
          <div className="chips">
            {asset.tunable?.map((p) => (
              <code key={p}>{p}</code>
            ))}
          </div>
          {asset.slots ? (
            <div className="contract">
              <strong>槽契约</strong>
              {asset.slots.map((s) => (
                <p key={s.name}>
                  <code>{s.name}</code> · {s.required ? '必填' : '可选'}
                  <small>
                    {s.kind} / {s.overflow}
                  </small>
                </p>
              ))}
            </div>
          ) : null}
          <p className="help">完整公开 Props 和位置在「用法」中。</p>
        </>
      );
    return (
      <>
        {['Flow', 'ScrollArea'].includes(asset.name) ? (
          <div className="field">
            <label htmlFor="height">
              可用高度 <code>{c.height} px</code>
            </label>
            <input
              id="height"
              type="range"
              min={asset.name === 'Flow' ? 520 : 380}
              max="780"
              step="20"
              value={c.height}
              onChange={(e) => control('height', +e.target.value)}
            />
            <p className="help">改变父级实际给到的空间。</p>
          </div>
        ) : null}
        {asset.kind !== 'motion' ? (
          <div className="field">
            <span className="field-label">内容长度</span>
            <div className="choices">
              {(['short', 'long'] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={c.length === value}
                  className={c.length === value ? 'active' : ''}
                  onClick={() => control('length', value)}
                >
                  {value === 'short' ? '短内容' : '长内容'}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {asset.name === 'Flow' ? (
          <div className="field">
            <span className="field-label">空间分配</span>
            <div className="choices">
              {(['tracks', 'equal', 'ratio'] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={c.arrangement === value}
                  className={c.arrangement === value ? 'active' : ''}
                  onClick={() => control('arrangement', value)}
                >
                  {value === 'tracks' ? '剩余 + 内容' : value === 'equal' ? '等分' : '2 : 1'}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {asset.name !== 'ScrollArea' ? (
          <div className="field">
            <label htmlFor="title">内容标题</label>
            <input
              id="title"
              value={c.title}
              maxLength={28}
              onChange={(e) => control('title', e.target.value)}
            />
          </div>
        ) : null}
        {['Flow', 'Panel'].includes(asset.name) || asset.kind === 'skin' ? (
          <>
            <div className="field">
              <label htmlFor="skin">卡片的皮</label>
              <select
                id="skin"
                value={asset.kind === 'skin' ? asset.name : c.skin}
                disabled={asset.kind === 'skin'}
                onChange={(e) => control('skin', e.target.value)}
              >
                {(registry[asset.owner]?.skins?.SKIN_IDS ?? ['plain']).map((id: string) => (
                  <option key={id}>{id}</option>
                ))}
              </select>
            </div>
            <label className="check-field">
              <input
                id="radius"
                type="checkbox"
                checked={c.radius}
                onChange={(e) => control('radius', e.target.checked)}
              />{' '}
              实例覆盖圆角 <code>22 px</code>
            </label>
            <p className="help">实例 prop 优先于皮和主题。</p>
          </>
        ) : null}
        {asset.name === 'ScrollArea' ? (
          <>
            <div className="field">
              <label htmlFor="scroll">
                手动滚动 <code>{c.scroll}%</code>
              </label>
              <input
                id="scroll"
                type="range"
                min="0"
                max="100"
                value={c.scroll}
                onChange={(e) => {
                  setPlaying(false);
                  patch({frame: 0});
                  control('scroll', +e.target.value);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="anchor">内容锚点</label>
              <select
                id="anchor"
                value={c.anchor}
                onChange={(e) => control('anchor', e.target.value as Controls['anchor'])}
              >
                {[
                  ['manual', '手动 / 随帧'],
                  ['start', '开头'],
                  ['middle', '中段'],
                  ['end', '结尾'],
                ].map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}
        {asset.kind === 'motion'
          ? (['start', 'duration', 'distance'] as const).map((key, i) => (
              <div className="field" key={key}>
                <label htmlFor={key}>
                  {['起点', '时长', '位移'][i]}{' '}
                  <code>
                    {c[key]} {i === 2 ? 'px' : '帧'}
                  </code>
                </label>
                <input
                  id={key}
                  type="range"
                  min={key === 'duration' ? 1 : 0}
                  max={key === 'distance' ? 100 : 90}
                  value={c[key]}
                  onChange={(e) => control(key, +e.target.value)}
                />
              </div>
            ))
          : null}
        <button
          className="reset"
          onClick={() => {
            setPlaying(false);
            patch({controls: {...DEFAULT_CONTROLS}, frame: start});
          }}
        >
          重置当前试验
        </button>
      </>
    );
  };
  const preview = (a = asset, compare?: 'short' | 'long') => (
    <Canvas
      asset={a}
      registry={registry}
      themeSuite={themeSuite.name}
      themeId={themeId}
      demo={demo}
      c={compare ? {...state.controls, length: compare} : state.controls}
      frame={frame}
    />
  );
  const demoLabel = (id: string) =>
    id === 'experiment'
      ? '内容与实例试验'
      : id === 'registry'
        ? '既有隔离演示'
        : (asset.demonstrations?.find((d) => d.id === id)?.name ?? '真实母版演示');
  const compareAllowed =
    demo === 'experiment' &&
    (experimentNames.has(asset.name) || asset.kind === 'skin' || asset.kind === 'motion');
  return (
    <div className={dark ? 'app dark' : 'app'}>
      <style>{WORKBENCH_STYLES}</style>
      <a
        href="#main"
        className="skip"
        onClick={(event) => {
          event.preventDefault();
          workspaceRef.current?.focus();
        }}
      >
        跳到演示
      </a>
      <header className="topbar">
        <div className="brand">
          <b>
            k<span>/</span>
          </b>
          <div>
            套件演示<small>KIT PLAYGROUND</small>
          </div>
        </div>
        <div className="search">
          <input
            ref={searchRef}
            aria-label="搜索能力"
            placeholder="搜索能力、参数或用途…"
            value={state.query}
            onChange={(e) => patch({query: e.target.value, view: 'gallery'})}
          />
          <kbd>/</kbd>
        </div>
        <span className="top-spacer" />
        <button
          className={'sync-button ' + (failed ? 'failed' : '')}
          onClick={() => setSyncOpen(true)}
        >
          <span className="dot" />
          {failed ? '未同步' : building ? '正在同步' : status ? '已同步' : '离线快照'}{' '}
          <span>↗</span>
        </button>
      </header>
      <div className="shell">
        <aside className="sidebar" tabIndex={0} aria-label="套件内容导航">
          <nav aria-label="系统导航">
            <button
              className={state.page === 'overview' && !state.query ? 'active' : ''}
              aria-current={state.page === 'overview' && !state.query ? 'page' : undefined}
              onClick={() => navigate('overview')}
            >
              系统总览
            </button>
            <button
              className={state.page === 'kernel' && !state.query ? 'active' : ''}
              aria-current={state.page === 'kernel' && !state.query ? 'page' : undefined}
              onClick={() => navigate('kernel')}
            >
              通用内核
            </button>
            <button
              ref={typePacksRef}
              data-type-packs-toggle
              className={state.page === 'type-detail' && !state.query ? 'active' : ''}
              aria-expanded={typePacksOpen}
              aria-controls="type-packs-list"
              onClick={() => setTypePacksOpen((open) => !open)}
            >
              <span>类型包</span>
              <span className="disclosure-arrow" aria-hidden="true">
                {typePacksOpen ? '▾' : '▸'}
              </span>
            </button>
            {typePacksOpen ? (
              <div id="type-packs-list" data-type-packs-list className="type-packs-list">
                {manifest.suites
                  .filter((s) => s.role === 'type')
                  .map((suite) => (
                    <button
                      key={suite.name}
                      data-type-pack-link={suite.name}
                      aria-current={
                        state.page === 'type-detail' && state.scope === suite.name && !state.query
                          ? 'page'
                          : undefined
                      }
                      onClick={() => {
                        navigate('type-detail', suite.name);
                        typePacksRef.current?.focus({preventScroll: true});
                      }}
                    >
                      {suite.name}
                    </button>
                  ))}
                {!manifest.library.typePacks.length ? (
                  <p className="help">当前来源没有类型包。</p>
                ) : null}
              </div>
            ) : null}
          </nav>
          {!state.query &&
          scopeSuite &&
          (state.page === 'kernel' || state.page === 'type-detail') ? (
            <div className="sidebar-catalog" data-sidebar-catalog>
              {[scopeSuite].map((suite) => (
                <section className="owner-categories" data-owner-nav={suite.name} key={suite.name}>
                  <button
                    className="catalog-owner"
                    data-owner-link={suite.name}
                    onClick={() =>
                      navigate(suite.role === 'kernel' ? 'kernel' : 'type-detail', suite.name)
                    }
                  >
                    <span>{suite.role === 'kernel' ? '内核' : '类型包'}</span>
                    <strong>{suite.name}</strong>
                  </button>
                  <nav aria-label={suite.name + ' 元素分类'}>
                    {ownedCategories(manifest, suite.name).map((c) => {
                      const active =
                        state.scope === suite.name &&
                        activeCategory === c.kind &&
                        state.view === 'gallery' &&
                        !state.query;
                      return (
                        <a
                          key={c.kind}
                          data-owner-category={suite.name}
                          data-category={c.kind}
                          className={active ? 'active' : ''}
                          aria-current={active ? 'location' : undefined}
                          aria-label={suite.name + ' · ' + c.label}
                          href={hashFor({
                            ...state,
                            page: suite.role === 'kernel' ? 'kernel' : 'type-detail',
                            scope: suite.name,
                            view: 'gallery',
                            category: c.kind,
                            query: '',
                          })}
                          onClick={(event) => {
                            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
                              return;
                            event.preventDefault();
                            navigate(
                              suite.role === 'kernel' ? 'kernel' : 'type-detail',
                              suite.name,
                              c.kind,
                            );
                          }}
                        >
                          <span>{c.label}</span>
                        </a>
                      );
                    })}
                  </nav>
                </section>
              ))}
            </div>
          ) : null}
          <div className="sidebar-bottom">
            一套积木，开放的画面。
            <br />
            <button onClick={() => setDark(!dark)}>切换页面明暗</button>
          </div>
        </aside>
        <main
          id="main"
          ref={workspaceRef}
          tabIndex={-1}
          className="workspace"
          data-page={state.query ? 'search' : state.page}
        >
          <div className="workspace-top">
            <div>
              <div className="eyebrow">EXPLORE / TRY / COMPOSE</div>
              <h1>
                {state.query
                  ? '搜索结果'
                  : state.page === 'overview'
                    ? '系统总览'
                    : state.page === 'kernel'
                      ? '通用内核'
                      : state.scope}
              </h1>
            </div>
            {!state.query && state.view !== 'gallery' ? (
              <div className="views">
                {(['workbench', 'compare'] as const).map((v) => (
                  <button
                    key={v}
                    className={state.view === v ? 'active' : ''}
                    aria-pressed={state.view === v}
                    onClick={() => patch({view: v})}
                  >
                    {v === 'workbench' ? '工作台' : '对照'}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {!state.query && state.view !== 'gallery' ? (
            <div className="breadcrumb" data-context>
              <button onClick={() => navigate(state.page, state.scope)}>
                {state.page === 'type-detail'
                  ? '返回 ' + state.scope + ' 自有内容'
                  : '返回内核目录'}
              </button>
              <span>
                {asset.owner === manifest.library.kernel ? '内核' : '类型包'} / {asset.name}
              </span>
              {scopeSuite && asset.owner !== scopeSuite.name ? (
                <strong>在 {scopeSuite.name} 组合中试用</strong>
              ) : null}
            </div>
          ) : null}
          {state.missing ? (
            <p role="status" className="help">
              {state.missing}
            </p>
          ) : null}
          {failed ? (
            <div className="stale-banner" role="status">
              新内容未同步：{status.error}
              <br />
              当前保留 {manifest.generatedAt} 的成功展示。
            </div>
          ) : null}
          {state.view === 'gallery' || state.query ? (
            <>
              {manifest.images &&
              (state.page === 'kernel' || state.page === 'type-detail' || state.query) ? (
                <label className="thumb-toggle">
                  <input
                    type="checkbox"
                    checked={staticThumbs}
                    onChange={(e) => setStaticThumbs(e.target.checked)}
                  />
                  使用本次构建的静态缩略图
                </label>
              ) : null}
              <LibraryPages
                page={state.page}
                manifest={manifest}
                suite={scopeSuite}
                query={state.query}
                navigate={navigate}
                openTypePacks={openTypePacks}
                choose={choose}
                renderCard={(a) => {
                  const own = manifest.suites.find((s) => s.name === a.owner)!;
                  return (
                    <Card
                      key={a.id}
                      asset={a}
                      registry={registry}
                      themeSuite={own.name}
                      themeId={own.themeIds[0] ?? ''}
                      onSelect={() => choose(a, state.query ? a.owner : scopeSuite?.name)}
                      reduced={reduced}
                      image={staticThumbs ? manifest.images?.[a.id] : undefined}
                    />
                  );
                }}
                previewPack={(suite, compact = false) => {
                  const representative =
                    manifest.assets.find((a) => a.owner === suite.name && a.kind === 'frame') ??
                    manifest.assets.find((a) => a.owner === suite.name && a.demoIds.length);
                  return representative ? (
                    <Canvas
                      asset={representative}
                      registry={registry}
                      themeSuite={suite.name}
                      themeId={suite.themeIds[0] ?? ''}
                      demo={defaultDemo(representative)}
                      c={{...DEFAULT_CONTROLS}}
                      frame={representative.demoFrame}
                      compact={compact}
                    />
                  ) : (
                    <div className="no-demo">当前没有整体演示</div>
                  );
                }}
              />
            </>
          ) : state.view === 'compare' ? (
            <>
              <div className="asset-head">
                <h2>
                  <code>{asset.name}</code> <span>{asset.label}</span>
                </h2>
                <span className="tag">{asset.owner}</span>
              </div>
              {compareAllowed ? (
                <>
                  <p className="purpose">
                    同一能力和参数，改变{asset.kind === 'motion' ? '入场起点' : '内容长度'}
                    ，观察实际效果。
                  </p>
                  <div className="compare-grid">
                    {(['short', 'long'] as const).map((length) => (
                      <div className="preview" key={length}>
                        <div className="preview-toolbar">
                          {asset.kind === 'motion'
                            ? length === 'short'
                              ? '对照 A · 第 0 帧入场'
                              : '对照 B · 第 30 帧入场'
                            : length === 'short'
                              ? '对照 A · 短内容'
                              : '对照 B · 长内容'}
                        </div>
                        {asset.kind === 'motion' ? (
                          <Canvas
                            asset={asset}
                            registry={registry}
                            themeSuite={themeSuite.name}
                            themeId={themeId}
                            demo={demo}
                            c={{...state.controls, start: length === 'short' ? 0 : 30}}
                            frame={30}
                          />
                        ) : (
                          preview(asset, length)
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="help">
                    {asset.name === 'Flow'
                      ? "tracks=[1, 'content'] 可让底部按内容占位；也可回工作台换成比例或等分。"
                      : '返回工作台可更换主题与实例参数。'}
                  </p>
                </>
              ) : (
                <div className="empty">
                  当前夹具没有内容对照适配器。
                  <button
                    onClick={() => {
                      const flow = manifest.assets.find((a) => a.name === 'Flow');
                      if (flow) {
                        choose(flow);
                        patch({view: 'compare'});
                      }
                    }}
                  >
                    试试 Flow 的长短内容对照 ↗
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="work-grid">
              <section className="work-intro">
                <div className="asset-head">
                  <h2>
                    <code>{asset.name}</code> <span>{asset.label}</span>
                  </h2>
                  <span className="tag">
                    {asset.owner} ·{' '}
                    {manifest.suites.find((s) => s.name === asset.owner)?.role === 'type'
                      ? '类型包'
                      : '内核'}
                  </span>
                  {scopeSuite && asset.owner !== scopeSuite.name ? (
                    <small>由 {asset.owner} 补入</small>
                  ) : null}
                </div>
                <p className="purpose">{asset.purpose}</p>
                <div className="demo-row">
                  <label htmlFor="demo">演示场景</label>
                  <select
                    id="demo"
                    value={demo}
                    onChange={(e) => {
                      setPlaying(false);
                      const d = relativeFrame(asset, e.target.value);
                      patch({
                        demoId: e.target.value,
                        frame: d?.from ?? 0,
                      });
                    }}
                  >
                    {asset.demoIds.map((id) => (
                      <option key={id} value={id}>
                        {demoLabel(id)}
                      </option>
                    ))}
                  </select>
                  {asset.name === 'Flow' ||
                  ['layout', 'frame', 'furniture', 'theme'].includes(asset.kind) ? (
                    <label className="bounds-check">
                      <input
                        type="checkbox"
                        checked={state.controls.bounds}
                        onChange={(e) => control('bounds', e.target.checked)}
                      />
                      显示边界
                    </label>
                  ) : null}
                </div>
              </section>
              <section className="main-area">
                <div className="preview">
                  <div className="preview-toolbar">
                    <span>真实组件 · {demoLabel(demo)}</span>
                    <span>1920 × 1080 · 30 FPS</span>
                  </div>
                  {asset.demoIds.length ? (
                    preview()
                  ) : (
                    <div className="empty">这项能力已发现，尚无演示适配器。</div>
                  )}
                  <div className="player-bar">
                    <button
                      className="play"
                      aria-label={playing ? '暂停' : '播放'}
                      onClick={() => {
                        if (reduced) {
                          notify('系统设置减少动态效果，可手动拖动帧。');
                          return;
                        }
                        if (!playing && frame >= end) patch({frame: start});
                        setPlaying(!playing);
                      }}
                    >
                      {playing ? 'Ⅱ' : '▶'}
                    </button>
                    <input
                      aria-label="预览帧"
                      type="range"
                      min={start}
                      max={end}
                      value={frame}
                      onChange={(e) => {
                        setPlaying(false);
                        patch({frame: +e.target.value});
                      }}
                    />
                    <code>
                      {frame - start} / {duration - 1}
                    </code>
                  </div>
                </div>
                <div className="preview-caption">
                  <span>使用来源中的真实组件与夹具。</span>
                  <span>参数临时生效</span>
                </div>
                <div className="related-title">
                  继续试一试 <small>{asset.owner} · 自有目录</small>
                </div>
                <div className="related">
                  {trialWindow(manifest, asset).map((a) => (
                    <button
                      key={a.id}
                      data-trial-asset={a.id}
                      className={a.id === asset.id ? 'active' : ''}
                      onClick={() => choose(a)}
                    >
                      <code>{a.name}</code>
                      <small>{a.label}</small>
                    </button>
                  ))}
                </div>
              </section>
              <div className="inspector-slot">
                <aside className="inspector" aria-label="实例试验" tabIndex={0}>
                  <div className="inspector-head">
                    实例试验<small>仅作用于当前预览</small>
                  </div>
                  <div className="inspector-tabs">
                    {(['parameters', 'usage'] as const).map((v) => (
                      <button
                        key={v}
                        className={panel === v ? 'active' : ''}
                        onClick={() => setPanel(v)}
                      >
                        {v === 'parameters' ? '参数' : '用法'}
                      </button>
                    ))}
                  </div>
                  <div className="inspector-body">
                    <div className="field">
                      <label htmlFor="theme">主题</label>
                      <select
                        id="theme"
                        value={themeId}
                        disabled={asset.kind === 'theme' || !themes.length}
                        onChange={(e) => patch({themeId: e.target.value})}
                      >
                        {themes.map((id) => (
                          <option key={id}>{id}</option>
                        ))}
                      </select>
                    </div>
                    {panel === 'parameters' ? (
                      asset.demoIds.length ? (
                        parameters()
                      ) : (
                        <p className="help">已发现此项能力，尚无可调整的演示适配器。</p>
                      )
                    ) : (
                      <>
                        <div className="code-head">
                          调用示意{' '}
                          <button onClick={() => void copy(demoCode(asset, state.controls, demo))}>
                            复制
                          </button>
                        </div>
                        <pre>{demoCode(asset, state.controls, demo)}</pre>
                        {asset.publicProps ? (
                          <details>
                            <summary>公开 Props（由实际组件类型读取）</summary>
                            {asset.publicProps.map((p) => (
                              <p className="prop-line" key={p.name}>
                                <code>{p.name}</code> {p.required ? '必填' : '可选'}
                                <small>{p.type}</small>
                              </p>
                            ))}
                          </details>
                        ) : null}
                      </>
                    )}
                  </div>
                  <div className="source-detail">
                    <strong>归属与来源</strong>
                    <p>维护归属　{asset.owner}</p>
                    <p>当前读取　{sourceLabel}</p>
                    <code>{asset.sourcePath}</code>
                    <button
                      onClick={() =>
                        void copy(
                          asset.sourcePath.startsWith('/') || asset.sourcePath[1] === ':'
                            ? asset.sourcePath
                            : manifest.source.path + '/' + asset.sourcePath,
                        )
                      }
                    >
                      复制来源路径 ↗
                    </button>
                  </div>
                </aside>
              </div>
            </div>
          )}
          <footer>
            <span>
              构建于 {new Date(manifest.generatedAt).toLocaleString('zh-CN')} · Remotion{' '}
              {manifest.runtime.remotion}
            </span>
            <button onClick={() => setSyncOpen(true)}>
              {manifest.notes.length} 条覆盖提示 · 来源详情 ↗
            </button>
          </footer>
        </main>
      </div>
      <dialog ref={dialogRef} className="sync-dialog" onClose={() => setSyncOpen(false)}>
        <div className="dialog-title">
          <h2>展示页同步</h2>
          <button aria-label="关闭同步详情" onClick={() => setSyncOpen(false)}>
            ×
          </button>
        </div>
        <p className="sync-state">
          {failed
            ? '构建失败，保留上次成功结果'
            : building
              ? '来源已变化，正在重建'
              : status
                ? '当前展示已同步'
                : '离线快照，未连接实时状态'}
        </p>
        <dl>
          <dt>母版目录</dt>
          <dd>{manifest.source.path}</dd>
          <dt>当前版本</dt>
          <dd>
            <code>{manifest.buildId}</code>
          </dd>
          <dt>最后成功构建</dt>
          <dd>{status?.lastSuccess ?? manifest.generatedAt}</dd>
          {status?.source !== undefined && status.source !== manifest.source.path ? (
            <>
              <dt>待同步来源</dt>
              <dd>{status.source}</dd>
            </>
          ) : null}
        </dl>
        {status?.error ? <pre className="error-detail">{status.error}</pre> : null}
        <details>
          <summary>覆盖提示（{manifest.notes.length}）</summary>
          <ul>
            {manifest.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
        <p className="help">
          实时模式监听新增、修改、删除和重命名；只有成功构建才刷新。更新展示页与更新工程副本是两个动作。
        </p>
        <code className="command">
          pwsh -File showcase/generate.ps1 -Project &lt;工程&gt; -Watch
        </code>
      </dialog>
      {message ? (
        <div className="toast" role="status">
          {message}
        </div>
      ) : null}
    </div>
  );
}
export function mount({manifest, registry}: {manifest: Manifest; registry: Registry}) {
  createRoot(document.getElementById('root')!).render(
    <Stage
      duration={Math.max(
        2000,
        ...manifest.assets.flatMap((a) => a.demonstrations?.map((d) => d.from + d.duration) ?? []),
      )}
    >
      <App manifest={manifest} registry={registry} />
    </Stage>,
  );
}
