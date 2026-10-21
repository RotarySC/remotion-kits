import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import type {Asset, Controls, Registry} from './model';

/** 这些是展示夹具；作品不经过这里，也不把此处控制当运行时契约。 */
export function demoCode(asset: Asset, c: Controls, demo: string) {
  if (demo === 'registry')
    return `// 既有隔离演示\n// ${asset.owner}/components/specs.tsx\n<Spec.Demo />`;
  if (asset.name === 'Flow')
    return `<div style={{height: ${c.height}}}>\n  <Flow direction="column" sizing="fill"\n    ${c.arrangement === 'tracks' ? "tracks={[1, 'content']}" : c.arrangement === 'ratio' ? 'ratio={[2, 1]}' : 'ratio={[1, 1]}'} gap={20}>\n    <Panel>{mainContent}</Panel>\n    <Panel>{notes}</Panel>\n  </Flow>\n</div>`;
  if (asset.kind === 'skin' || asset.name === 'Panel')
    return `<Panel skin="${asset.kind === 'skin' ? asset.name : c.skin}"${c.radius ? ' radius={22}' : ''}>\n  {yourContent}\n</Panel>`;
  if (asset.name === 'ScrollArea')
    return `<ScrollArea scroll={scroll}\n  onMeasured={onMeasured}>\n  {yourContent}\n</ScrollArea>\n\n// 可用 anchorScroll 对齐实际内容锚点`;
  if (asset.kind === 'motion')
    return `const enter = ${asset.name}({\n  frame, startInFrames: ${c.start},\n  durationInFrames: ${c.duration}${asset.name === 'fadeUp' ? ',\n  distanceInPx: ' + c.distance : ',\n  shift: "0px ' + c.distance + 'px"'}\n});\n<div style={enter}>{content}</div>`;
  if (asset.name === 'FreeComposition')
    return `<Flow ratio={[2, 1]} sizing="fill">\n  <Panel>{yourJSX}</Panel>\n  <div>{ordinaryJSX}</div>\n</Flow>`;
  return `// 演示与源码\n// ${asset.sourcePath}\n// 调用处持有内容和时序`;
}
function ScrollExperiment({lib, c}: {lib: any; c: Controls}) {
  const frame = useCurrentFrame(),
    ScrollArea = lib.elements.ScrollArea,
    api = lib.exports.ScrollArea;
  const [sizes, setSizes] = React.useState({viewport: 0, content: 0}),
    nodes = React.useRef<(HTMLParagraphElement | null)[]>([]);
  const measured = React.useCallback(
    (next: {viewport: number; content: number}) =>
      setSizes((before) =>
        before.viewport === next.viewport && before.content === next.content ? before : next,
      ),
    [],
  );
  const count = c.length === 'long' ? 13 : 3,
    index = c.anchor === 'start' ? 0 : c.anchor === 'middle' ? Math.floor(count / 2) : count - 1;
  const node = nodes.current[index],
    manual = (c.scroll / 100) * Math.max(0, sizes.content - sizes.viewport);
  const scroll =
    c.anchor === 'manual'
      ? Math.max(
          manual,
          interpolate(frame, [0, 89], [0, Math.max(0, sizes.content - sizes.viewport)], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        )
      : api?.anchorScroll && node
        ? api.anchorScroll({
            target: node.offsetTop,
            size: node.offsetHeight,
            content: sizes.content,
            viewport: sizes.viewport,
            align: 'center',
          })
        : 0;
  return (
    <div data-live-scroll style={{width: 1500, height: c.height, position: 'relative'}}>
      <ScrollArea scroll={scroll} rail onMeasured={measured}>
        <div style={{position: 'relative', padding: 32}}>
          {Array.from({length: count}, (_, i) => (
            <p
              key={i}
              ref={(n) => {
                nodes.current[i] = n;
              }}
              data-anchor-index={i}
              style={{
                fontSize: 34,
                lineHeight: 1.8,
                margin: '0 0 24px',
                borderBottom: '1px solid currentColor',
                paddingBottom: 14,
              }}
            >
              {String(i + 1).padStart(2, '0')}
              　内容是作品自己的。每一段都可以有自己的节奏与组织方式。
            </p>
          ))}
        </div>
      </ScrollArea>
      <span
        data-scroll-metrics
        data-content-size={sizes.content}
        data-viewport-size={sizes.viewport}
        data-scroll={scroll}
        style={{position: 'absolute', right: 10, bottom: 5, fontSize: 18, opacity: 0.75}}
      >
        内容 {Math.round(sizes.content)} / 窗口 {Math.round(sizes.viewport)}
      </span>
    </div>
  );
}
function FrameContent({
  lib,
  asset,
  c,
  themeId,
}: {
  lib: any;
  asset: Asset;
  c: Controls;
  themeId: string;
}) {
  const furniture = lib.useShowcaseFurniture?.() ?? {},
    Master = lib.MasterFrame,
    Scenes = lib.ShowcaseScenes;
  if (!Master) return <p>该母版缺少可挂载的展示入口。</p>;
  return (
    <Master theme={lib.getTheme(themeId)} furniture={furniture} grid vignette>
      {asset.kind !== 'furniture' && Scenes ? <Scenes /> : null}
      {c.bounds ? (
        <div
          data-master-content
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            outline: '4px dashed #41a6e5',
            outlineOffset: -4,
          }}
        />
      ) : null}
    </Master>
  );
}
export function NativeDemo({
  asset,
  registry,
  themeSuite,
  themeId,
  demo,
  c,
}: {
  asset: Asset;
  registry: Registry;
  themeSuite: string;
  themeId: string;
  demo: string;
  c: Controls;
}) {
  const frame = useCurrentFrame(),
    owner = registry[asset.owner],
    themeLib = registry[themeSuite] ?? owner,
    Provider = themeLib.ThemeProvider ?? React.Fragment,
    theme = themeLib.getTheme?.(themeId),
    Panel = owner.elements.Panel,
    Flow = owner.elements.Flow;
  const props = theme ? {theme} : {};
  let content: React.ReactNode;
  if (
    asset.kind === 'layout' ||
    asset.kind === 'frame' ||
    asset.kind === 'furniture' ||
    asset.kind === 'theme'
  )
    return (
      <FrameContent
        key={asset.owner}
        lib={owner}
        asset={asset}
        c={c}
        themeId={asset.kind === 'theme' ? asset.name : themeId}
      />
    );
  if (asset.kind === 'example' && asset.name !== 'FreeComposition') {
    const Kit = owner.KitShowcase;
    return <Provider {...props}>{Kit ? <Kit /> : <p>这个组合没有可挂载的夹具。</p>}</Provider>;
  }
  if (demo === 'registry') {
    const spec = owner.components?.find((s) => s.name === asset.name),
      Demo = spec?.Demo;
    content = Demo ? <Demo /> : <p>尚无隔离 Demo。</p>;
  } else if (asset.name === 'Flow') {
    const allocation =
      c.arrangement === 'tracks'
        ? {tracks: [1, 'content']}
        : {ratio: c.arrangement === 'ratio' ? [2, 1] : [1, 1]};
    content = (
      <div
        data-live-flow
        data-height={c.height}
        style={{
          width: 1600,
          height: c.height,
          outline: c.bounds ? '3px dashed #41a6e5' : undefined,
        }}
      >
        <Flow direction="column" sizing="fill" gap={20} {...allocation}>
          <Panel skin={c.skin} radius={c.radius ? 22 : undefined} padding={30}>
            <div data-space-main style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              <span style={{fontSize: 24, opacity: 0.6}}>主内容 / 剩余空间</span>
              <strong style={{fontSize: 46, lineHeight: 1.4}}>{c.title}</strong>
              <div style={{display: 'flex', gap: 20, alignItems: 'end', height: 80, minHeight: 80}}>
                {[0.34, 0.62, 0.48, 0.86, 1, 0.73].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      width: 150,
                      height: h * 100 + '%',
                      backgroundColor: theme?.color.accent ?? 'currentColor',
                      opacity: 0.8,
                    }}
                  />
                ))}
              </div>
            </div>
          </Panel>
          <Panel skin={c.skin} radius={c.radius ? 22 : undefined} padding={25}>
            <div data-space-note style={{fontSize: 30, lineHeight: 1.7}}>
              注释的高度由内容决定。
              {c.length === 'long' ? (
                <>
                  <br />
                  内容变长，就多占一行。
                  <br />
                  主区域拿扣除注释与间距后的剩余空间。
                </>
              ) : null}
            </div>
          </Panel>
        </Flow>
      </div>
    );
  } else if (asset.name === 'Panel' || asset.kind === 'skin') {
    content = Panel ? (
      <Panel
        skin={asset.kind === 'skin' ? asset.name : c.skin}
        radius={c.radius ? 22 : undefined}
        width={1400}
        padding={50}
      >
        <div data-live-panel style={{fontSize: 42, lineHeight: 1.8}}>
          <strong style={{fontSize: 56}}>{c.title}</strong>
          <p style={{margin: '28px 0 0'}}>一句引文、一段说明，或者你自己的 JSX。</p>
          {c.length === 'long' ? (
            <p>内容与尺寸来自这一处调用。皮提供默认选择，实例仍可以继续覆盖。</p>
          ) : null}
        </div>
      </Panel>
    ) : (
      <p>当前归属没有 Panel 演示适配器。</p>
    );
  } else if (asset.name === 'ScrollArea') content = <ScrollExperiment lib={owner} c={c} />;
  else if (asset.kind === 'motion') {
    const calculate = owner.motion?.[asset.name];
    content = calculate ? (
      <div
        data-live-motion
        style={{
          fontSize: 82,
          fontWeight: 600,
          ...calculate({
            frame,
            startInFrames: c.start,
            durationInFrames: c.duration,
            ...(asset.name === 'fadeUp'
              ? {distanceInPx: c.distance}
              : {shift: '0px ' + c.distance + 'px'}),
          }),
        }}
      >
        {c.title}
      </div>
    ) : (
      <p>公开动效已发现，尚无展示适配器。</p>
    );
  } else if (asset.name === 'FreeComposition')
    content = (
      <div data-free-jsx style={{width: 1600, height: 650}}>
        <Flow ratio={[2, 1]} sizing="fill" gap={40}>
          <Panel padding={40}>
            <div style={{fontSize: 42, lineHeight: 1.8}}>
              <strong>{c.title}</strong>
              <p>这一段是项目组织的普通 JSX。</p>
              <ul>
                <li>组件可以复用。</li>
                <li>内容与编排仍然开放。</li>
              </ul>
              {c.length === 'long' ? (
                <p>内容增多时，由当前调用选择更合适的组织方式；目录没有替作品规定叙事结构。</p>
              ) : null}
            </div>
          </Panel>
          <div
            data-ordinary-jsx
            style={{fontSize: 36, lineHeight: 1.9, padding: 40, border: '2px dashed currentColor'}}
          >
            这一块没有套件组件。
            <br />
            它仍能参与 Flow 排列。
          </div>
        </Flow>
      </div>
    );
  else content = <p>能力已进入目录，尚无展示适配器。</p>;
  const Background = themeLib.Stage ?? owner.Stage;
  return (
    <Provider {...props}>
      {Background ? <Background /> : null}
      <div
        data-native-body
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1920,
          minHeight: 1080,
          padding: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme?.color.ink,
          fontFamily: theme?.font.family,
        }}
      >
        <div data-natural-demo style={{position: 'relative', maxWidth: 1800}}>
          {content}
        </div>
      </div>
    </Provider>
  );
}
