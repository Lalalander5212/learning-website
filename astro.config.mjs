import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import fs from 'node:fs';
import { TRACKS } from './src/tracks.mjs';

const hasLessons = (id) => {
  const dir = new URL(`./src/content/docs/${id}/`, import.meta.url);
  return fs.existsSync(dir) && fs.readdirSync(dir).some((f) => /\.mdx?$/.test(f));
};

export default defineConfig({
  site: 'https://lalalander5212.github.io',
  base: '/learning-website',
  markdown: { processor: unified({ remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] }) },
  integrations: [
    starlight({
      title: 'Vasco Learn',
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
        ...TRACKS.filter((t) => hasLessons(t.id)).map((t) => ({
          label: t.title,
          items: [{ autogenerate: { directory: t.id } }],
        })),
        { label: '설정', link: '/settings/' },
      ],
    }),
  ],
});
