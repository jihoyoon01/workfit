// SRT·VTT 자막 텍스트를 [{startSec, endSec, text}] 배열로 바꿉니다.
// 자막 파일 내용을 붙여 넣으면 구간별 행으로 나뉘어, 영상 속 구간 검색(subtitles 테이블)에 쓰입니다.

function toSeconds(stamp) {
  // 00:01:20,500 / 01:20.500 / 1:20 형식 모두 허용
  const clean = stamp.trim().replace(',', '.');
  const parts = clean.split(':').map(Number);
  if (parts.some((p) => Number.isNaN(p))) return null;
  let sec = 0;
  for (const p of parts) sec = sec * 60 + p;
  return Math.round(sec * 100) / 100;
}

export function parseSubtitleText(raw) {
  if (!raw) return [];
  const blocks = raw.replace(/\r/g, '').split(/\n\s*\n/);
  const rows = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const timeIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeIdx < 0) continue;
    const [from, to] = lines[timeIdx].split('-->');
    const startSec = toSeconds(from);
    const endSec = toSeconds((to || '').split(' ').filter(Boolean)[0] || '');
    const text = lines.slice(timeIdx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (startSec === null || endSec === null || !text) continue;
    rows.push({ startSec, endSec, text });
  }
  return rows;
}
