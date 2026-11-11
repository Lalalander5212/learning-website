# learning-website

개인 학습 사이트. Astro + Starlight, `main`에 push하면 GitHub Actions가 GitHub Pages로 배포한다.
https://lalalander5212.github.io/learning-website/

이 파일이 레슨 작성 규칙의 원본이다. 규칙을 바꾸면 여기와 `scripts/check-lessons.mjs`를 같이 고친다.

## 명령어

```bash
npm ci             # 처음 한 번
npm run check      # 레슨 검증 (frontmatter, 트랙/모듈, 퀴즈, 수식, 레슨 참조)
npm run build      # 전체 빌드. MDX 오류는 여기서도 잡힘
npm run dev        # 로컬 미리보기. 레슨 파일을 추가/이동하면 재시작해야 사이드바에 보임
```

## 레슨을 올리는 절차

1. `src/tracks.mjs`에서 트랙 id와 모듈 id를 확인한다. 기억으로 쓰지 않는다.
2. 아래 규칙대로 `src/content/docs/<track>/NN-slug.mdx`를 쓴다.
3. 레슨에 넣은 Python/C 코드는 직접 실행해 보고, 본문 숫자와 출력이 맞는지 확인한다. 실행하지 못한 코드(예: GPU가 필요한 CUDA)는 사용자에게 그렇다고 말한다.
4. `npm run check` → 오류 0개, 새 레슨에서 나온 경고 0개가 될 때까지 고친다.
5. `npm run build`가 통과하는지 확인한다.
6. commit하고 push한다.
   - 레슨/콘텐츠만 바꿨으면 `main`에 바로 commit, push한다. 메시지 예: `Add lessons 24-26: linear regression, logistic regression, loss`
   - 사이트 코드(`src/components`, `src/lib`, `src/styles`, `astro.config.mjs`, `scripts`, 이 파일)를 바꿨으면 브랜치를 만들고 PR을 연다.
7. 배포 확인: `gh api repos/Lalalander5212/learning-website/actions/runs?per_page=1 --jq '.workflow_runs[0] | "\(.status) \(.conclusion) \(.html_url)"'` 로 deploy 워크플로가 `completed success`인지 본다. 실패하면 로그를 보고 고친다.
8. 사용자에게 올린 레슨 목록(트랙, 번호, 제목)과 사이트 URL을 알려준다.

## 레슨 파일

- 경로: `src/content/docs/<track>/NN-slug.mdx`. `NN`은 트랙 안에서 이어지는 두 자리 번호, slug는 영어 소문자와 하이픈.
- **한 번 올린 레슨의 파일명과 번호는 바꾸지 않는다.** 레슨 id(`<track>/NN-slug`)가 진행상황과 복습 기록의 키다. 새 레슨은 다음 번호로 추가한다.
- 레슨 하나 = 20~40분 분량. 길면 여러 레슨으로 쪼갠다. 한 레슨에 한 주제.

```mdx
---
title: "Cache 구조: tag / index / offset"
description: "한 줄 요약"
track: arch-foundations      # 폴더명과 같아야 함. src/tracks.mjs의 id
module: cache                # 그 트랙의 modules[].id. modules가 있는 트랙이면 필수
est: 35min
prereq: [arch-foundations/07-memory-hierarchy-amat]   # 선택. 먼저 보면 좋은 레슨 id
sidebar:
  order: 8                   # 파일 번호 NN과 같은 정수
---
import Quiz from '../../../components/Quiz.astro';
import { Aside } from '@astrojs/starlight/components';
```

### 트랙과 모듈

원본은 `src/tracks.mjs`. 트랙: `arch-foundations`, `ml-basics`, `deep-learning`, `llm-internals`, `edge-llm`, `llm-systems`.

- 새 모듈이 필요하면 `src/tracks.mjs`의 해당 트랙 `modules`에 `{ id, title }`를 추가한다. 순서대로 사이드바와 로드맵에 보인다.
- 모듈이 없던 트랙에 처음 레슨을 올릴 때는 레슨 3~6개 단위로 모듈을 먼저 정한다.
- 같은 모듈의 레슨은 번호가 연속이어야 한 묶음으로 보인다.
- Part/트랙 끝의 종합 문제 레슨은 `module: review`.

## 본문 구조

섹션 순서. 내용에 맞지 않는 섹션은 빼도 되지만 **왜 필요한가, 체크 퀴즈, 서술형**은 항상 넣는다.

1. `## 왜 필요한가`: 동기 2~4줄. 이게 없으면 무슨 문제가 생기는지.
2. `## 직관`: 비유나 ASCII 다이어그램.
3. 정식 설명: 정의, 수식, 유도를 생략 없이. 용어를 정의할 때는 한국어와 영어를 같이 쓴다.
   `**Hit time (히트 시간)**: 한국어 정의. *English definition.*`
4. `## Worked example`: 실제 숫자로 단계별 계산.
5. `## 코드`: 바로 돌려볼 수 있는 짧은 예제. 웬만하면 Python.
6. `## 흔한 오해`: `<Aside type="caution" title="...?">`로.
7. `## Efficient ML 연결`: MIT 6.5940, edge LLM, LLM serving에서 어디에 쓰이는지.
8. `## 체크 퀴즈`
9. `## 서술형`
10. `## 더 읽을거리`: 실제로 있는 링크만.

글: 한국어 설명 + 기술 용어는 영어 그대로(cache miss, gradient). 문체는 기존 레슨처럼 "~다" 평서문.

### MDX에서 조심할 것

- 코드블록과 수식 밖에서 `{` `}` `<`는 그대로 쓰지 않는다. `\{` `\}`로 이스케이프하거나 코드/수식에 넣는다. `{...}`는 JS로 실행된다.
- 수식은 KaTeX. 인라인 `$x$`, 블록 `$$ ... $$`.
- ASCII 다이어그램과 실행 결과는 ` ```text ` 블록에.
- 코드블록 언어: `python`, `c`, `cpp`, `cuda`, `text`, `bash` 등 (`scripts/check-lessons.mjs`의 `CODE_LANGS`).
- 팁/주의는 `<Aside type="note|tip|caution|danger" title="...">`.

### 다른 레슨 참조

같은 트랙의 레슨은 본문에 **`NN번 레슨`**이라고 두 자리로 쓴다. 빌드할 때 자동으로 링크가 된다.

- 되는 형태: `16번 레슨`, `10~12번 레슨`, `08, 09번 레슨`
- 안 되는 형태: `7번 레슨`(한 자리), `(08, 09)`(뒤에 "번 레슨" 없음), 제목·코드·퀴즈 문자열 안
- 다른 트랙의 레슨은 일반 링크로: `[KV cache](/learning-website/llm-internals/03-kv-cache/)`

## 체크 퀴즈

```mdx
<Quiz
  q="질문"
  options={['보기 A', '보기 B', '보기 C', '보기 D']}
  answer={2}
  explain="왜 정답인지. 가장 많이 고를 오답이 왜 틀렸는지."
/>
```

- 레슨당 3~5개, 보기 4개. `answer`는 0부터 세는 인덱스.
- **보기는 사이트에서 매번 섞여서 나온다.** `q`, `options`, `explain` 어디에서도 보기를 번호나 위치로 가리키지 않는다. "정답은 2번", "위 보기 모두", "첫 번째 보기" 금지. 내용으로 가리킨다("4 MB는 32-bit일 때의 값이다").
- 순서 자체가 의미인 문제만 `shuffle={false}`를 준다.
- **worked example의 숫자를 그대로 쓰지 않는다.** 숫자나 조건을 바꿔서 다시 계산해야 풀리게 낸다. 본문과 같은 숫자면 복습 때 답을 외워서 풀게 된다.
- 계산 문제의 오답 보기는 흔한 실수에서 나온 값으로 만든다(단위 빼먹음, 항 하나 누락, 반대로 나눔). `explain`에서 그 실수를 짚는다.
- 정답 위치(`answer`)가 한 인덱스에 몰리지 않게 쓴다.
- 문자열 prop 안에서는 KaTeX가 안 된다. 수식은 `1 / (1 - f)`, `10^9`처럼 plain text로.
- `q`와 `explain` 안에는 큰따옴표를 쓰지 않는다. `options`의 보기에 작은따옴표가 필요하면 그 보기만 큰따옴표로 감싼다.
- **이미 올린 레슨의 퀴즈는 순서를 바꾸거나 중간에 끼워 넣지 않는다.** 복습 기록 키가 `레슨id#퀴즈순번`이다. 추가는 맨 뒤에, 내용 수정은 제자리에서.

## 서술형

레슨마다 1문제 이상. 여러 단계를 이어서 풀어야 하는 문제로, 풀이는 접어 둔다.

```mdx
## 서술형

### 문제. 제목

조건과 질문. (a), (b), (c)로 나눠도 좋다.

<details>
<summary>풀이 보기</summary>

**(a)** 단계별 풀이. 수식과 표를 써도 된다.

</details>
```

- `<summary>` 줄 다음과 `</details>` 앞에 빈 줄을 둔다 (23번 레슨 `arch-foundations/23-part-a-review.mdx`와 같은 형식).
- 답의 숫자는 직접 계산해서 확인한다.

## 구조

- `src/tracks.mjs`: 트랙과 모듈 정의
- `src/lib/lesson-files.mjs`: 레슨 파일 읽기, 사이드바 생성 (Node 전용. 빌드 설정과 검증 스크립트가 같이 씀)
- `src/lib/remark-lesson-links.mjs`: `NN번 레슨` 자동 링크
- `scripts/check-lessons.mjs`: 레슨 검증. CI에서 빌드 전에 돈다
- `src/components/Quiz.astro`, `src/lib/quiz.ts`: 퀴즈 (보기 셔플, 채점)
- `src/lib/store.ts`, `sync.ts`: 진행상황 저장(localStorage)과 Gist sync
- `src/lib/lesson.ts`, `review.ts`: 레슨 페이지, 복습 페이지 동작
- `src/components/overrides/`: Starlight 컴포넌트 override (레슨 헤더/하단, 사이드바 표시, 테마)

## 알려진 상태

- `arch-foundations` 01~22번 레슨에는 서술형이 없고, 일부 퀴즈가 worked example과 같은 숫자를 쓴다. `npm run check`의 `essay`, `answer-bias` 경고가 그것이다. 이 레슨들을 고칠 때는 위의 퀴즈 순서 규칙을 지킨다.
