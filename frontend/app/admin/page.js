'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDateTime, formatDuration, LOG_ACTIONS } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.dashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (!data) return <p className="muted">불러오는 중…</p>;

  const stats = [
    { label: '전체 회원', value: data.userCount },
    { label: '과정', value: data.courseCount, sub: `공개 ${data.publishedCourseCount}개` },
    { label: '콘텐츠', value: data.contentCount, sub: `공개 ${data.publishedContentCount} · 비공개 ${data.hiddenContentCount}` },
    { label: '임시저장 콘텐츠', value: data.draftContentCount, sub: '공개 전 확인 필요' },
    { label: '실무자료', value: data.resourceCount },
    { label: '검색 태그', value: data.tagCount },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>대시보드</h1>
          <p>등록 현황과 최근 작업을 확인합니다.</p>
        </div>
        <Link className="btn primary" href="/admin/courses">
          콘텐츠 등록하러 가기
        </Link>
      </div>

      <div className="stats">
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <div className="label">{s.label}</div>
            <div className="value">{s.value}</div>
            {s.sub && <div className="sub">{s.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>최근 등록한 콘텐츠</h2>
          </div>
          {data.recentContents.length === 0 ? (
            <div className="empty">아직 등록한 콘텐츠가 없습니다.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>제목</th>
                    <th>상태</th>
                    <th>길이</th>
                    <th>수정 시각</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentContents.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/admin/contents/${c.id}`}>{c.title}</Link>
                      </td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="muted">{formatDuration(c.durationSec)}</td>
                      <td className="muted">{formatDateTime(c.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>최근 관리자 작업</h2>
          </div>
          {data.recentLogs.length === 0 ? (
            <div className="empty">기록이 없습니다.</div>
          ) : (
            <ul className="checklist">
              {data.recentLogs.map((l) => (
                <li key={l.id}>
                  <span className="badge blue">{LOG_ACTIONS[l.action] || l.action}</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    #{l.targetId} · {formatDateTime(l.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
