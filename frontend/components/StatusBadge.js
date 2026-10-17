import { CONTENT_STATUS } from '@/lib/format';

export default function StatusBadge({ status }) {
  const s = CONTENT_STATUS[status] || { label: status, tone: 'gray' };
  return <span className={`badge ${s.tone}`}>{s.label}</span>;
}
