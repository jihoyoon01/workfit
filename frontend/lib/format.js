// 화면 표시용 변환 함수와 상태값 이름

export const CONTENT_STATUS = {
  DRAFT: { label: '임시저장', tone: 'gray' },
  REVIEW: { label: '검수 중', tone: 'amber' },
  PUBLISHED: { label: '공개', tone: 'green' },
  HIDDEN: { label: '비공개', tone: 'red' },
};

export const LEVELS = { INTRO: '입문', BASIC: '기초', ADVANCED: '심화' };

export const RESOURCE_TYPES = { TEMPLATE: '템플릿', EXAMPLE_DOC: '예시 문서', PROMPT: '프롬프트' };

export const TAG_TYPES = { SITUATION: '업무 상황', ERROR: '오류 메시지', FUNCTION: '함수', TOOL: '툴' };

export const LOG_ACTIONS = {
  CONTENT_PUBLISH: '콘텐츠 공개',
  CONTENT_HIDE: '콘텐츠 비공개',
  CONTENT_DELETE: '콘텐츠 삭제',
  COURSE_PUBLISHED: '과정 공개',
  COURSE_HIDDEN: '과정 비공개',
  COURSE_DRAFT: '과정 임시저장',
};

/** 초 → "2:30" */
export function formatDuration(sec) {
  if (sec === null || sec === undefined || Number.isNaN(Number(sec))) return '-';
  const s = Math.round(Number(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** 초 → "약 12분" */
export function formatTotal(sec) {
  if (!sec) return '0분';
  return `약 ${Math.max(1, Math.round(sec / 60))}분`;
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 가로:세로 비율을 가장 가까운 표준 비율 문자열로 */
export function aspectLabel(width, height) {
  if (!width || !height) return null;
  const r = width / height;
  const known = [
    ['9:16', 9 / 16],
    ['3:4', 3 / 4],
    ['1:1', 1],
    ['4:3', 4 / 3],
    ['16:9', 16 / 9],
  ];
  let best = known[0];
  for (const k of known) if (Math.abs(k[1] - r) < Math.abs(best[1] - r)) best = k;
  return best[0];
}
