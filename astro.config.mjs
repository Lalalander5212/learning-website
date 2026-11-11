import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { unified } from '@astrojs/markdown-remark';
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
      customCss: ['katex/dist/katex.min.css', './src/styles/custom.css'],
      components: { MarkdownContent: './src/components/MarkdownContent.astro' },
      sidebar: [
        { label: 'Dashboard', link: '/' },
        ...TRACKS.filter((t) => hasLessons(t.id)).map((t) => ({
          label: t.title,
          items: [{ autogenerate: { directory: t.id } }],
        })),
      ],
    }),
  ],
});
