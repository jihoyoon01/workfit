export default function CourseBadge({ status }) {
  if (status === 'PUBLISHED') return <span className="badge green">공개</span>;
  if (status === 'HIDDEN') return <span className="badge red">비공개</span>;
  return <span className="badge gray">임시저장</span>;
}
