import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { TRACKS, trackSidebar } from './src/lib/lesson-files.mjs';
import { remarkLessonLinks } from './src/lib/remark-lesson-links.mjs';

const BASE = '/learning-website';

export default defineConfig({
  site: 'https://lalalander5212.github.io',
  base: BASE,
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath, [remarkLessonLinks, { base: BASE }]], // "NN번 레슨" → 링크
      rehypePlugins: [rehypeKatex],
    }),
  },
  integrations: [
    starlight({
      title: 'Vasco Learn',
      expressiveCode: { shiki: { langAlias: { cuda: 'cpp' } } },
      locales: { root: { label: '한국어', lang: 'ko' } },
      pagination: false, // 레슨 하단의 이전/다음은 직접 그림
      customCss: [
        'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css',
        'katex/dist/katex.min.css',
        './src/styles/custom.css',
      ],
      components: {
        MarkdownContent: './src/components/overrides/MarkdownContent.astro',
        Footer: './src/components/overrides/Footer.astro',
        ThemeProvider: './src/components/overrides/ThemeProvider.astro',
        ThemeSelect: './src/components/overrides/ThemeSelect.astro',
      },
      sidebar: [
        { label: '대시보드', link: '/' },
        { label: '복습', link: '/review/' },
        { label: '로드맵', link: '/roadmap/' },
        // 트랙 → 모듈 → 레슨. 레슨 파일을 추가/이동하면 dev 서버를 재시작해야 반영됨
        ...TRACKS.map((t) => trackSidebar(t)).filter(Boolean),
        { label: '설정', link: '/settings/' },
      ],
    }),
  ],
});
