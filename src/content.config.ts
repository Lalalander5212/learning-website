import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        track: z.string().optional(), // 레슨이면 필수
        est: z.string().optional(),   // 예상 소요시간 "30min"
        prereq: z.array(z.string()).optional(), // 먼저 보면 좋은 레슨 id들 (예: llm-internals/01-attention)
      }),
    }),
  }),
};
