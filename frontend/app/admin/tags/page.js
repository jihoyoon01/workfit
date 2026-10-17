'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { TAG_TYPES } from '@/lib/format';

export default function TagsPage() {
  const [tags, setTags] = useState(null);
  const [form, setForm] = useState({ name: '', tagType: 'SITUATION', synonyms: '' });
  const [drafts, setDrafts] = useState({});
  const [message, setMessage] = useState(null);

  function load() {
    api.tags().then(setTags).catch((e) => setMessage({ type: 'error', text: e.message }));
  }

  useEffect(load, []);

  async function submit(e) {
    e.preventDefault();
    try {
      await api.createTag({
        name: form.name,
        tagType: form.tagType,
        synonyms: form.synonyms.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setForm({ name: '', tagType: form.tagType, synonyms: '' });
      setMessage({ type: 'success', text: '태그를 추가했습니다.' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: [err.message, ...(err.details || [])].join(' ') });
    }
  }

  async function addSynonym(tagId) {
    const value = (drafts[tagId] || '').trim();
    if (!value) return;
    try {
      const updated = await api.addSynonym(tagId, value);
      setTags((list) => list.map((t) => (t.id === tagId ? updated : t)));
      setDrafts((d) => ({ ...d, [tagId]: '' }));
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>검색 태그 관리</h1>
          <p>
            업무 상황·오류 메시지로 검색해도 영상이 나오도록 태그와 동의어를 등록합니다. 예: “부서별 합계”로 검색 → “조건별
            합계” 태그 → SUMIF 영상
          </p>
        </div>
      </div>
      {message && (
        <div className={`alert ${message.type}`} style={{ marginBottom: 16 }}>
          {message.text}
        </div>
      )}
      <div className="grid-2">
        <section className="card">
          {!tags ? (
            <p className="muted">불러오는 중…</p>
          ) : tags.length === 0 ? (
            <div className="empty">등록된 태그가 없습니다.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>대표 태그</th>
                    <th>종류</th>
                    <th>동의어 (이 단어로 검색해도 찾아짐)</th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 700 }}>{t.name}</td>
                      <td>
                        <span className="badge blue">{TAG_TYPES[t.tagType]}</span>
                      </td>
                      <td>
                        <div className="chips" style={{ marginBottom: 8 }}>
                          {t.synonyms.length === 0 && <span className="muted">없음</span>}
                          {t.synonyms.map((s) => (
                            <span className="badge gray" key={s}>
                              {s}
                            </span>
                          ))}
                        </div>
                        <div className="row" style={{ gap: 6 }}>
                          <input
                            type="text"
                            value={drafts[t.id] || ''}
                            placeholder="동의어 추가"
                            maxLength={50}
                            onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addSynonym(t.id);
                              }
                            }}
                            style={{ maxWidth: 200, minHeight: 32, padding: '4px 8px' }}
                          />
                          <button className="btn small" onClick={() => addSynonym(t.id)}>
                            추가
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <form className="card stack" onSubmit={submit}>
          <h2>새 태그</h2>
          <label className="field">
            <span>종류</span>
            <select value={form.tagType} onChange={(e) => setForm({ ...form, tagType: e.target.value })}>
              {Object.entries(TAG_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>대표 태그</span>
            <input type="text" value={form.name} maxLength={50} required onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예) 조건별 합계, #N/A" />
          </label>
          <label className="field">
            <span>
              동의어 <span className="hint">· 쉼표로 구분</span>
            </span>
            <input type="text" value={form.synonyms} onChange={(e) => setForm({ ...form, synonyms: e.target.value })} placeholder="예) 부서별 합계, 항목별 합계" />
          </label>
          <button className="btn primary" type="submit">
            태그 추가
          </button>
        </form>
      </div>
    </>
  );
}
