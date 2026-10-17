'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, fileUrl } from '@/lib/api';
import { formatDuration, formatTotal, LEVELS } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import CourseBadge from '@/components/CourseBadge';

export default function CourseDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState(null);
  const [form, setForm] = useState(null);
  const [categories, setCategories] = useState([]);
  const [contents, setContents] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [message, setMessage] = useState(null); // {type, text, details}
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, cats, list] = await Promise.all([api.course(id), api.categories(), api.courseContents(id)]);
      setCourse(c);
      setCategories(cats);
      setContents(list);
      setForm({
        categoryId: String(c.categoryId),
        title: c.title || '',
        summary: c.summary || '',
        learningGoal: c.learningGoal || '',
        level: c.level,
      });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function showError(err) {
    setMessage({ type: 'error', text: err.message, details: err.details });
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await api.updateCourse(id, { ...form, categoryId: Number(form.categoryId) });
      setCourse(updated);
      setMessage({ type: 'success', text: '과정 정보를 저장했습니다.' });
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status) {
    setBusy(true);
    try {
      const updated = await api.courseStatus(id, status);
      setCourse(updated);
      setMessage({ type: 'success', text: status === 'PUBLISHED' ? '과정을 공개했습니다.' : '과정을 비공개로 바꿨습니다.' });
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function move(index, delta) {
    const next = [...contents];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setContents(next);
    try {
      setContents(await api.reorderContents(id, next.map((c) => c.id)));
    } catch (err) {
      showError(err);
      load();
    }
  }

  async function addContent(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      const created = await api.createContent(Number(id), newTitle.trim());
      router.push(`/admin/contents/${created.id}`);
    } catch (err) {
      showError(err);
      setBusy(false);
    }
  }

  if (!course || !form) {
    return message ? <div className="alert error">{message.text}</div> : <p className="muted">불러오는 중…</p>;
  }

  return (
    <>
      <div className="crumbs">
        <Link href="/admin/courses">과정·콘텐츠 관리</Link> › {course.title}
      </div>
      <div className="page-head">
        <div>
          <div className="row">
            <h1>{course.title}</h1>
            <CourseBadge status={course.status} />
          </div>
          <p>
            콘텐츠 {course.contentCount}개 (공개 {course.publishedContentCount}) · {formatTotal(course.totalDurationSec)}
          </p>
        </div>
        <div className="row">
          {course.status === 'PUBLISHED' ? (
            <button className="btn danger" onClick={() => changeStatus('HIDDEN')} disabled={busy}>
              비공개로 전환
            </button>
          ) : (
            <button className="btn primary" onClick={() => changeStatus('PUBLISHED')} disabled={busy}>
              과정 공개하기
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`alert ${message.type}`} style={{ marginBottom: 16 }}>
          {message.text}
          {message.details && message.details.length > 0 && (
            <ul>
              {message.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>콘텐츠 목록</h2>
              <p>위아래 화살표로 학습 순서를 바꿉니다. 사용자에게는 공개된 콘텐츠만 이 순서로 보입니다.</p>
            </div>
          </div>
          {contents.length === 0 ? (
            <div className="empty">아직 콘텐츠가 없습니다. 아래에서 첫 콘텐츠를 추가하세요.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>순서</th>
                    <th></th>
                    <th>제목</th>
                    <th>길이</th>
                    <th>상태</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {contents.map((c, i) => (
                    <tr key={c.id}>
                      <td>
                        <div className="row" style={{ gap: 4 }}>
                          <button className="btn small" aria-label="위로" onClick={() => move(i, -1)} disabled={i === 0}>
                            ↑
                          </button>
                          <button className="btn small" aria-label="아래로" onClick={() => move(i, 1)} disabled={i === contents.length - 1}>
                            ↓
                          </button>
                        </div>
                      </td>
                      <td>
                        {c.thumbnail ? <img className="thumb" src={fileUrl(c.thumbnail)} alt="" /> : <div className="thumb" />}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>
                          {i + 1}. {c.title}
                        </div>
                        {!c.hasVideo && <div className="muted" style={{ fontSize: 12 }}>영상 미등록</div>}
                      </td>
                      <td className="muted">{formatDuration(c.durationSec)}</td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td>
                        <Link className="btn small" href={`/admin/contents/${c.id}`}>
                          편집
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <form className="row" style={{ marginTop: 16 }} onSubmit={addContent}>
            <input
              type="text"
              placeholder="새 콘텐츠 제목 (예: SUMIF 함수로 조건별 합계 구하기)"
              value={newTitle}
              maxLength={100}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{ flex: 1, minWidth: 220 }}
            />
            <button className="btn primary" type="submit" disabled={busy || !newTitle.trim()}>
              콘텐츠 추가
            </button>
          </form>
        </section>

        <form className="card stack" onSubmit={save}>
          <h2>과정 정보</h2>
          <label className="field">
            <span>분야</span>
            <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>과정명</span>
            <input type="text" value={form.title} maxLength={100} onChange={(e) => set('title', e.target.value)} required />
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
          <label className="field">
            <span>과정 소개</span>
            <textarea value={form.summary} maxLength={500} onChange={(e) => set('summary', e.target.value)} />
          </label>
          <label className="field">
            <span>학습 목표</span>
            <textarea value={form.learningGoal} maxLength={500} onChange={(e) => set('learningGoal', e.target.value)} />
          </label>
          <button className="btn" type="submit" disabled={busy}>
            과정 정보 저장
          </button>
        </form>
      </div>
    </>
  );
}
