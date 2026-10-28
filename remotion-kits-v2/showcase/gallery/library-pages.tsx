import React from 'react';
import {KIND_LABELS, ownedCategories, type Asset, type Manifest, type Suite} from './model';
import type {Page} from './navigation';
type Props = {
  page: Page;
  manifest: Manifest;
  suite?: Suite;
  query: string;
  navigate: (page: Page, scope?: string) => void;
  openTypePacks: () => void;
  choose: (asset: Asset, context?: string) => void;
  renderCard: (asset: Asset) => React.ReactNode;
  previewPack: (suite: Suite, compact?: boolean) => React.ReactNode;
};
export function LibraryPages(p: Props) {
  const {manifest, page, suite, query} = p;
  const kernel = manifest.suites.find((s) => s.name === manifest.library.kernel)!,
    packs = manifest.suites.filter((s) => s.role === 'type');
  const owned = (name: string) => manifest.assets.filter((a) => a.owner === name);
  const summary = (s: Suite) =>
    Object.entries(KIND_LABELS)
      .flatMap(([kind, label]) => {
        const count = owned(s.name).filter((a) => a.kind === kind && kind !== 'example').length;
        return count ? [`${label} ${count}`] : [];
      })
      .join(' · ');
  const cards = (assets: Asset[]) => (
    <div className="gallery-grid">{assets.map((a) => p.renderCard(a))}</div>
  );
  const ownedSections = (owner: string, subheading = false) =>
    ownedCategories(manifest, owner).map((c) => (
      <section
        className="element-section"
        id={'element-' + owner + '-' + c.kind}
        data-owned-kind={c.kind}
        key={c.kind}
      >
        <div className="section-heading">
          {subheading ? <h3>{c.label}</h3> : <h2>{c.label}</h2>}
        </div>
        {cards(owned(owner).filter((a) => a.kind === c.kind))}
      </section>
    ));
  if (query) {
    const matches = manifest.assets.filter((a) =>
      [a.name, a.label, a.purpose, a.owner, ...(a.tunable ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
    return (
      <section className="search-results">
        <p className="purpose">跨库查找“{query}”，结果按实际维护归属分组。</p>
        {manifest.suites
          .filter((s) => matches.some((a) => a.owner === s.name))
          .map((s) => (
            <section data-search-owner={s.name} key={s.name}>
              <div className="section-heading">
                <h2>
                  {s.role === 'kernel' ? '通用内核' : '类型包'} · {s.name}
                </h2>
                <small>{matches.filter((a) => a.owner === s.name).length} 条结果</small>
              </div>
              {cards(matches.filter((a) => a.owner === s.name))}
            </section>
          ))}
        {!matches.length ? <div className="empty">没有匹配的能力。</div> : null}
      </section>
    );
  }
  if (page === 'overview')
    return (
      <section className="overview">
        <div className="overview-intro">
          <p className="lead">通用能力集中维护，类型差异各归其包。</p>
          <p>从内核试一块积木，或进入类型包查看它增加的表达方式。内容与具体构图由创作项目持有。</p>
        </div>
        <div className="overview-grid">
          <article className="kernel-entry">
            <span className="eyebrow">一个通用内核</span>
            <h2>{kernel.name}</h2>
            <p>排布、内容构件、外观、动效与真实组件试验。</p>
            <div className="summary-line">
              {owned(kernel.name).filter((a) => a.kind !== 'example').length} 项构件与机制 ·{' '}
              {owned(kernel.name).filter((a) => a.kind === 'example').length} 个组合示例
            </div>
            <button className="primary-action" onClick={() => p.navigate('kernel', kernel.name)}>
              进入通用内核 ↗
            </button>
          </article>
          <article className="type-entry">
            <span className="eyebrow">按类型扩展</span>
            <h2>{packs.length} 个类型包</h2>
            <p>每个包维护自己的版式、家具、外观或扩展，按实际内容呈现。</p>
            <button className="secondary-action" onClick={p.openTypePacks}>
              选择类型包 ↗
            </button>
          </article>
        </div>
        <div className="relationship">
          <div className="rel-head">
            <strong>如何组合</strong>
            <small>目录记录维护归属；真实演示按声明组合。展示页提供发现与试验工具。</small>
          </div>
          <div className="rel-paths">
            <div className="rel-path">
              <span>直接复用</span>
              <p>
                <b>创作项目</b>
                <i>→</i>
                <b>通用内核</b>
              </p>
            </div>
            <div className="rel-path">
              <span>带类型差异</span>
              <p>
                <b>创作项目</b>
                <i>→</i>
                <b>选用的类型包</b>
                <i>→</i>
                <b>声明的能力来源</b>
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  if (page === 'kernel') {
    return (
      <section data-owned-assets>
        <p className="purpose">
          按元素类型查看内核自有内容。点击侧栏标签定位到对应分组，可以直接试验与使用这些能力。
        </p>
        {ownedSections(kernel.name)}
      </section>
    );
  }
  if (!suite) return null;
  const assets = owned(suite.name);
  const providers = Object.entries(suite.inherited),
    dependentAssets = manifest.assets.filter(
      (a) =>
        suite.refs.includes(a.id) &&
        a.owner !== suite.name &&
        ['Flow', 'Panel', 'ScrollArea'].includes(a.name),
    );
  const frame = assets.find((a) => a.kind === 'frame');
  return (
    <section className="type-detail">
      <p className="purpose">
        {summary(suite) || '当前包尚无自有展示资产'}。演示按真实组合关系渲染；本页目录记录由{' '}
        {suite.name} 维护的内容。
      </p>
      {frame ? (
        <section className="pack-hero" data-pack-preview>
          <div className="section-heading">
            <h2>整体演示</h2>
            <small>
              {suite.layoutCount} 个自有版式 / {suite.layoutSceneCount} 个版式场景
            </small>
          </div>
          {p.previewPack(suite)}
          <button className="primary-action" onClick={() => p.choose(frame, suite.name)}>
            打开整体演示工作台 ↗
          </button>
        </section>
      ) : (
        <p className="help">这个包当前没有整体画面夹具，下面展示已发现的自有内容。</p>
      )}
      <section data-owned-assets>
        <div className="section-heading">
          <h2>本包自有内容</h2>
          <small>{assets.length} 条自有记录，按实际类别呈现</small>
        </div>
        {ownedSections(suite.name, true)}
        {!assets.length ? <p className="help">尚无自有展示资产。来源关系仍可在下面查看。</p> : null}
      </section>
      <section className="composition" data-composition>
        <div className="section-heading">
          <h2>组合与依赖</h2>
          <small>补入关系保留实际供应方</small>
        </div>
        {providers.map(([layer, owner]) => (
          <div className="provider-line" key={layer}>
            <span>
              {layer === 'elements' ? '原语层' : layer === 'scenes' ? '组件演示层' : layer}
            </span>
            <strong>{owner}</strong>
            <button
              onClick={() => p.navigate(owner === kernel.name ? 'kernel' : 'type-detail', owner)}
            >
              查看 {owner} ↗
            </button>
          </div>
        ))}
        {!providers.length ? <p className="help">当前没有补入层声明。</p> : null}
        {dependentAssets.length ? (
          <>
            <p className="help">在 {suite.name} 的组合情境中试用来自内核的组件：</p>
            <div className="dependency-links">
              {dependentAssets.map((a) => (
                <button
                  data-dependency-asset={a.id}
                  key={a.id}
                  onClick={() => p.choose(a, suite.name)}
                >
                  {a.name}
                  <small>
                    {a.owner} · {a.label}
                  </small>
                </button>
              ))}
            </div>
          </>
        ) : null}
        {suite.guidePath ? (
          <p className="help">
            {/^https?:$/.test(location.protocol) ? (
              <a
                data-pack-guide
                href={
                  '/__showcase_doc?' +
                  new URLSearchParams({source: manifest.source.path, pack: suite.name})
                }
                target="_blank"
                rel="noopener"
              >
                阅读 {suite.name} 使用说明 ↗
              </a>
            ) : (
              <>
                使用说明位置：{manifest.source.path}/{suite.guidePath}
              </>
            )}
          </p>
        ) : null}
      </section>
    </section>
  );
}
