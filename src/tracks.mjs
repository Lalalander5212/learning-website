// 트랙 순서/이름. 새 트랙 추가하면 여기 + src/content/docs/<id>/ 폴더 만들기
// modules: 트랙 안의 묶음. 레슨 frontmatter의 `module: <id>`로 연결하고, 여기 적힌 순서대로 보임.
// modules가 있는 트랙의 레슨은 module이 필수 (scripts/check-lessons.mjs가 검사)
export const TRACKS = [
  {
    id: 'arch-foundations',
    title: '성능과 컴퓨터 구조',
    modules: [
      { id: 'perf', title: '성능 기초' },
      { id: 'pipeline', title: 'Pipelining' },
      { id: 'cache', title: 'Cache와 locality' },
      { id: 'vm', title: 'Virtual memory' },
      { id: 'parallel', title: '병렬 처리' },
      { id: 'roofline', title: 'Roofline' },
      { id: 'review', title: '종합' },
    ],
  },
  {
    id: 'ml-basics',
    title: 'ML Basics',
    modules: [
      { id: 'regression', title: '회귀와 loss' },
      { id: 'optimization', title: '최적화' },
      { id: 'backprop', title: 'Backpropagation' },
      { id: 'generalization', title: '일반화' },
      { id: 'review', title: '종합' },
    ],
  },
  { id: 'deep-learning', title: 'Deep Learning' },
  { id: 'llm-internals', title: 'LLM Internals' },
  { id: 'edge-llm', title: 'Edge LLM' },
  { id: 'llm-systems', title: 'LLM Systems' },
];
