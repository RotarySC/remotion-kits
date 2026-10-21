import React from 'react';
import {Composition} from 'remotion';
import {NativeDemo} from './demos';
import {ScaleProvider} from './stage';
import {DEFAULT_CONTROLS, type Manifest, type Registry} from './model';
export function createStillRoot({manifest, registry}: {manifest: Manifest; registry: Registry}) {
  const Still: React.FC<{assetId: string; themeSuite: string; themeId: string; demoId: string}> = ({
    assetId,
    themeSuite,
    themeId,
    demoId,
  }) => {
    const asset = manifest.assets.find((a) => a.id === assetId)!;
    return (
      <ScaleProvider scale={1}>
        <NativeDemo
          asset={asset}
          registry={registry}
          themeSuite={themeSuite}
          themeId={themeId}
          demo={demoId}
          c={DEFAULT_CONTROLS}
        />
      </ScaleProvider>
    );
  };
  const duration = Math.max(
    2000,
    ...manifest.assets.flatMap((a) => a.demonstrations?.map((d) => d.from + d.duration) ?? []),
  );
  return () => (
    <Composition
      id="KitGalleryStill"
      component={Still}
      durationInFrames={duration}
      width={1920}
      height={1080}
      fps={30}
      defaultProps={{
        assetId: manifest.assets[0].id,
        themeSuite: manifest.suites[0].name,
        themeId: manifest.suites[0].themeIds[0],
        demoId: manifest.assets[0].demoIds[0],
      }}
    />
  );
}
