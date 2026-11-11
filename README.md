# learning-website

개인 학습 사이트 (ML → DL → LLM → Edge LLM → LLM Systems). Astro + Starlight, GitHub Pages 배포.

https://lalalander5212.github.io/learning-website/

## 로컬
```bash
npm install
npm run dev
```

## 레슨 추가
작성 규칙과 올리는 절차는 [CLAUDE.md](./CLAUDE.md)에 있음. 요약:

`src/content/docs/<track>/NN-slug.mdx`
```yaml
---
title: 제목
description: 한 줄 요약
track: edge-llm      # src/tracks.mjs 의 id (폴더명과 같게)
module: kv-cache     # 트랙에 modules가 있으면 필수
est: 30min
prereq: [llm-internals/01-attention]   # 선택. 먼저 보면 좋은 레슨 id
sidebar: { order: 2 }                  # 파일 번호와 같게
---
```
퀴즈: `<Quiz q="..." options={['a','b']} answer={0} explain="..." />` (answer는 0부터. 보기는 화면에서 섞임)

올리기 전에:
```bash
npm run check   # 레슨 검증
npm run build
```

## 구조
- `src/tracks.mjs`: 트랙과 모듈. `src/lib/lesson-files.mjs`가 이걸로 사이드바를 만듦
- `src/lib/remark-lesson-links.mjs`: 본문의 "NN번 레슨"을 링크로 바꿈
- `scripts/check-lessons.mjs`: 레슨 검증 (CI에서 빌드 전에 실행)
- `src/lib/store.ts`: 진행상황 저장 (localStorage `lw-progress-v2`), 복습 간격, 기기 간 merge
- `src/lib/sync.ts`: 비공개 GitHub Gist sync (설정 페이지에서 토큰 연결)
- `src/lib/lesson.ts`, `review.ts`, `quiz.ts`: 레슨 페이지, 복습 페이지, 퀴즈 동작
- `src/components/overrides/`: Starlight 컴포넌트 override (테마 스위치, 레슨 헤더/하단, 공통 스크립트)
- `src/components/Dashboard.astro`, `Roadmap.astro`, `Review.astro`, `Settings.astro`: 각 페이지

## 단축키
`J`/`K` 다음/이전 레슨, `D` 완료하고 다음, `1`~`4` 퀴즈 답, `H` 대시보드, `R` 복습, `T` 테마, `?` 도움말
