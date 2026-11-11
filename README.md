# learning-website

개인 학습 사이트 (ML → DL → LLM → Edge LLM → LLM Systems). Astro + Starlight, GitHub Pages 배포.

https://lalalander5212.github.io/learning-website/

## 로컬
```bash
npm install
npm run dev
```

## 레슨 추가
`src/content/docs/<track>/NN-slug.mdx`
```yaml
---
title: 제목
track: edge-llm      # src/tracks.mjs 의 id
est: 30min
sidebar: { order: 2 }
---
```
퀴즈: `<Quiz q="..." options={['a','b']} answer={0} explain="..." />`

진행상황은 브라우저 localStorage에 저장됨 (대시보드에서 Export/Import 가능).
