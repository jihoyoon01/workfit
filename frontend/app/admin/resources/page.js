'use client';

import { useEffect, useState } from 'react';
import { api, fileUrl, uploadFile } from '@/lib/api';
import { RESOURCE_TYPES } from '@/lib/format';

const EMPTY = { title: '', resourceType: 'TEMPLATE', description: '', file: null, promptText: '', categoryId: '', status: 'PUBLISHED' };

export default function ResourcesPage() {
  const [list, setList] = useState(null);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  function load() {
    Promise.all([api.resources(), api.categories()])
      .then(([r, c]) => {
        setList(r);
        setCategories(c);
      })
      .catch((e) => setMessage({ type: 'error', text: e.message }));
  }

  useEffect(load, []);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSelectFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      set('file', await uploadFile(file, 'RESOURCE'));
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setUploading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    try {
      await api.createResource({
        title: form.title,
        resourceType: form.resourceType,
        description: form.description || null,
        fileId: form.file ? form.file.id : null,
        promptText: form.resourceType === 'PROMPT' ? form.promptText : null,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        status: form.status,
      });
      setForm(EMPTY);
      setMessage({ type: 'success', text: '자료를 등록했습니다. 콘텐츠 등록 화면에서 연결할 수 있습니다.' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: [err.message, ...(err.details || [])].join(' ') });
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>실무자료 관리</h1>
          <p>영상 아래에 붙일 업무 템플릿·예시 문서·AI 프롬프트를 등록합니다.</p>
        </div>
      </div>
      {message && (
        <div className={`alert ${message.type}`} style={{ marginBottom: 16 }}>
          {message.text}
        </div>
      )}
      <div className="grid-2">
        <section className="card">
          {!list ? (
            <p className="muted">불러오는 중…</p>
          ) : list.length === 0 ? (
            <div className="empty">등록된 자료가 없습니다.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>제목</th>
                    <th>종류</th>
                    <th>파일·본문</th>
                    <th>상태</th>
                    <th>다운로드</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{r.title}</div>
                        {r.description && <div className="muted" style={{ fontSize: 13 }}>{r.description}</div>}
                      </td>
                      <td>{RESOURCE_TYPES[r.resourceType]}</td>
                      <td>
                        {r.file ? (
                          <a href={fileUrl(r.file)} target="_blank" rel="noreferrer">
                            {r.file.originalName}
                          </a>
                        ) : (
                          <span className="muted">{(r.promptText || '').slice(0, 40)}…</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${r.status === 'PUBLISHED' ? 'green' : 'gray'}`}>{r.status === 'PUBLISHED' ? '공개' : r.status === 'HIDDEN' ? '비공개' : '임시저장'}</span>
                      </td>
                      <td className="muted">{r.downloadCount}회</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <form className="card stack" onSubmit={submit}>
          <h2>새 자료 등록</h2>
          <label className="field">
            <span>종류</span>
            <select value={form.resourceType} onChange={(e) => set('resourceType', e.target.value)}>
              {Object.entries(RESOURCE_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>제목</span>
            <input type="text" value={form.title} maxLength={100} onChange={(e) => set('title', e.target.value)} required placeholder="예) 매출 집계 템플릿" />
          </label>
          <label className="field">
            <span>어떤 업무에 쓰나요?</span>
            <input type="text" value={form.description} maxLength={500} onChange={(e) => set('description', e.target.value)} />
          </label>
          {form.resourceType === 'PROMPT' ? (
            <label className="field">
              <span>프롬프트 본문</span>
              <textarea value={form.promptText} onChange={(e) => set('promptText', e.target.value)} required />
            </label>
          ) : (
            <div className="field">
              <span>파일 (xlsx, docx, pptx, pdf 등 20MB 이하)</span>
              <div className="row">
                <label className="btn small">
                  {uploading ? '올리는 중…' : form.file ? '파일 교체' : '파일 선택'}
                  <input type="file" onChange={onSelectFile} hidden />
                </label>
                {form.file && <span className="muted">{form.file.originalName}</span>}
              </div>
            </div>
          )}
          <label className="field">
            <span>분야</span>
            <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">전체</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>상태</span>
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="PUBLISHED">공개</option>
              <option value="DRAFT">임시저장</option>
            </select>
          </label>
          <button className="btn primary" type="submit" disabled={uploading}>
            자료 등록
          </button>
        </form>
      </div>
    </>
  );
}
