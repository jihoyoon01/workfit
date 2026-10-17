'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatDateTime, formatTotal, LEVELS } from '@/lib/format';
import CourseBadge from '@/components/CourseBadge';

const EMPTY = { categoryId: '', title: '', summary: '', learningGoal: '', level: 'BASIC' };

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState(null);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.courses(), api.categories()])
      .then(([cs, cats]) => {
        setCourses(cs);
        setCategories(cats);
      })
      .catch((e) => setError(e.message));
  }, []);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = await api.createCourse({ ...form, categoryId: Number(form.categoryId) });
      router.push(`/admin/courses/${created.id}`);
    } catch (err) {
      setError([err.message, ...(err.details || [])].join(' '));
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>과정·콘텐츠 관리</h1>
          <p>과정을 만들고, 과정 안에 숏폼 콘텐츠를 순서대로 등록합니다.</p>
        </div>
        <button className="btn primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? '닫기' : '새 과정 만들기'}
        </button>
      </div>

      {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}

      {showForm && (
        <form className="card stack" style={{ marginBottom: 20 }} onSubmit={create}>
          <h2>새 과정</h2>
          <div className="fields">
            <label className="field">
              <span>분야</span>
              <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} required>
                <option value="">선택</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.categoryType === 'JOB' ? '직무' : '공통 실무'})
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>난이도</span>
              <select value={form.level} onChange={(e) => set('level', e.target.value)}>
                {Object.entries(LEVELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="field wide">
              <span>과정명</span>
              <input type="text" value={form.title} maxLength={100} onChange={(e) => set('title', e.target.value)} required placeholder="예) 신입 직장인을 위한 엑셀 기초" />
            </label>
            <label className="field wide">
              <span>과정 소개</span>
              <textarea value={form.summary} maxLength={500} onChange={(e) => set('summary', e.target.value)} />
            </label>
            <label className="field wide">
              <span>
                학습 목표 <span className="hint">· 과정을 공개하려면 필요합니다</span>
              </span>
              <input type="text" value={form.learningGoal} maxLength={500} onChange={(e) => set('learningGoal', e.target.value)} placeholder="예) 부서별 매출 합계 같은 기본 집계를 직접 할 수 있다" />
            </label>
          </div>
          <div className="row">
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? '만드는 중…' : '과정 만들기'}
            </button>
          </div>
        </form>
      )}

      <section className="card">
        {!courses ? (
          <p className="muted">불러오는 중…</p>
        ) : courses.length === 0 ? (
          <div className="empty">아직 과정이 없습니다. 오른쪽 위 버튼으로 첫 과정을 만들어 보세요.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>과정명</th>
                  <th>분야</th>
                  <th>난이도</th>
                  <th>콘텐츠</th>
                  <th>예상 시간</th>
                  <th>상태</th>
                  <th>만든 시각</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/admin/courses/${c.id}`} style={{ fontWeight: 700 }}>
                        {c.title}
                      </Link>
                    </td>
                    <td>{c.categoryName}</td>
                    <td>{LEVELS[c.level]}</td>
                    <td>
                      {c.contentCount}개 <span className="muted">(공개 {c.publishedContentCount})</span>
                    </td>
                    <td className="muted">{formatTotal(c.totalDurationSec)}</td>
                    <td>
                      <CourseBadge status={c.status} />
                    </td>
                    <td className="muted">{formatDateTime(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
