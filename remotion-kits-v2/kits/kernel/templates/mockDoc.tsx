import React from 'react';
import {useTheme} from '../theme/context';

/**
 * 演示用的**长文档** —— `ScrollArea` 的夹具。
 *
 * 它同时演示了一条约定：**行号沟属于内容，不属于组件**。
 * 所以它跟着正文一起滚（把行号做成组件的一部分、钉在左边，是另一种设计，这里不取）。
 *
 * ⚠️ 这些是**夹具**，不是套件的能力：真实片子里内容由调用方给。
 * 内容故意长到**超过视口**，否则 `ScrollArea` 没有东西可滚（等于没验到）。
 */
export const MOCK_DOC_LINES: readonly string[] = [
  '# TC-02 · 3D 体素山 + 瀑布 + 穿云 · 提示词 v1',
  '',
  '> 版本：v1（2026-08-08）',
  '> 使用：粘贴到工作区任务，模型在工作区中生成完整项目',
  '',
  '---',
  '',
  '【任务】',
  '请创建一个可运行的 3D 体素（Voxel）风格自然景观场景：山 + 瀑布 + 穿云效果，',
  '用 Three.js 实现，浏览器打开即可观看，风格类似 Minecraft 体素块拼接。',
  '',
  '【场景要求】',
  '1. 山体：体素构成的山脉，含主峰与若干次峰，山体轮廓有自然的峰谷起伏，',
  '   坡度过渡自然',
  '2. 瀑布：一道或数道瀑布，从山体高处倾泻而下，水流沿山体表面顺势而下，',
  '   落向山脚',
  '3. 穿云：云雾缭绕于山腰，部分山峰穿出云层，山体与云层有前后遮挡关系',
  '4. 环境：山脚可点缀植被，整体光影氛围自然（可含晨昏色调）',
  '',
  '【技术要求】',
  '- Three.js：工作区完整项目，可直接构建运行',
  '- 画面流畅：体素数量合理，旋转视角帧率稳定（≥30fps）',
  '- 页面打开即进入场景，无需操作即可看到全貌',
  '',
  '【交付要求】',
  '- 项目结构完整，说明运行方式（安装与启动命令）',
  '- 如已实际运行，请说明运行结果',
  '',
  '---',
  '',
  '## 设计说明（对应考察点，不计入提示词）',
];

/** 行号沟 + 正文 —— 两栏一起滚 */
export const MockDoc: React.FC = () => {
  const theme = useTheme();

  return (
    <div
      style={{
        padding: '40px 64px 48px 24px',
        fontFamily: theme.font.mono,
        fontSize: 24,
        lineHeight: 1.6,
      }}
    >
      {MOCK_DOC_LINES.map((line, i) => (
        <div key={i} style={{display: 'flex', gap: 16}}>
          <span
            style={{
              flexShrink: 0,
              width: 54,
              color: theme.color.accent,
              opacity: 0.85,
            }}
          >
            {String(i + 1).padStart(3, '0')}
          </span>
          {/* `pre` 让续行的缩进真的显示出来（原稿里就是空格的） */}
          <span style={{color: theme.color.ink, opacity: 0.82, whiteSpace: 'pre'}}>
            {line}
          </span>
        </div>
      ))}
    </div>
  );
};

/** 钉在滚动区上方的标题栏 —— 「窗口 chrome」那一层 */
export const MockTitleBar: React.FC = () => {
  const theme = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        backgroundColor: theme.color.accent,
        color: theme.color.bg,
        fontFamily: theme.font.mono,
        fontSize: 20,
      }}
    >
      <span>{'// PROMPT — TC-02 v1 · 967 CHARS'}</span>
      <span style={{display: 'flex', gap: 9}}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: theme.color.bg,
              opacity: 0.75,
            }}
          />
        ))}
      </span>
    </div>
  );
};