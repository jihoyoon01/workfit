'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, fileUrl, uploadFile } from '@/lib/api';
import { aspectLabel, formatBytes, formatDuration, RESOURCE_TYPES, TAG_TYPES } from '@/lib/format';
import { parseSubtitleText } from '@/lib/subtitles';
import StatusBadge from '@/components/StatusBadge';

const MAX_VIDEO_MB = 200;
const RECOMMENDED_MAX_SEC = 180;

const emptyOption = () => ({ optionText: '', correct: false, feedback: '', rewatchSec: '' });
const emptyPractice = () => ({
  title: '',
  instruction: '',
  exampleFile: null,
  expectedResult: '',
  resultType: 'NUMBER',
  tolerance: '0',
  requiredFunction: '',
  answerFormula: '',
});

/** 서버 응답(ContentDetail) → 화면 상태 */
function fromDetail(d) {
  const quiz = d.quiz || { question: '', explanation: '', options: [] };
  const options = quiz.options.length
    ? quiz.options.map((o) => ({
        optionText: o.optionText || '',
        correct: !!o.correct,
        feedback: o.feedback || '',
        rewatchSec: o.rewatchSec ?? '',
      }))
    : [emptyOption(), emptyOption(), emptyOption(), emptyOption()];
  const p = d.practice;
  return {
    title: d.title || '',
    learningGoal: d.learningGoal || '',
    workUse: d.workUse || '',
    sortOrder: d.sortOrder ?? '',
    video: d.video,
    thumbnail: d.thumbnail,
    durationSec: d.durationSec,
    aspectRatio: d.aspectRatio,
    quiz: { question: quiz.question || '', explanation: quiz.explanation || '', options },
    practiceOn: !!p,
    practice: p
      ? {
          title: p.title || '',
          instruction: p.instruction || '',
          exampleFile: p.exampleFile,
          expectedResult: p.expectedResult || '',
          resultType: p.resultType || 'NUMBER',
          tolerance: p.tolerance === null || p.tolerance === undefined ? '0' : String(p.tolerance),
          requiredFunction: p.requiredFunction || '',
          answerFormula: p.answerFormula || '',
        }
      : emptyPractice(),
    tagIds: d.tagIds || [],
    skillIds: d.skillIds || [],
    resourceIds: d.resourceIds || [],
    subtitles: (d.subtitles || []).map((s) => ({ startSec: String(s.startSec), endSec: String(s.endSec), text: s.text })),
  };
}

/** 화면 상태 → 저장 요청(ContentSaveRequest) */
function toPayload(f) {
  const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
  return {
    title: f.title,
    learningGoal: f.learningGoal || null,
    workUse: f.workUse || null,
    sortOrder: num(f.sortOrder),
    videoFileId: f.video ? f.video.id : null,
    thumbnailFileId: f.thumbnail ? f.thumbnail.id : null,
    durationSec: num(f.durationSec),
    aspectRatio: f.aspectRatio || null,
    quiz: {
      question: f.quiz.question,
      explanation: f.quiz.explanation,
      options: f.quiz.options
        .filter((o) => o.optionText.trim() !== '' || o.correct)
        .map((o) => ({
          optionText: o.optionText,
          correct: o.correct,
          feedback: o.feedback || null,
          rewatchSec: num(o.rewatchSec),
        })),
    },
    practice: f.practiceOn
      ? {
          title: f.practice.title,
          instruction: f.practice.instruction,
          exampleFileId: f.practice.exampleFile ? f.practice.exampleFile.id : null,
          expectedResult: f.practice.expectedResult,
          resultType: f.practice.resultType,
          tolerance: num(f.practice.tolerance) ?? 0,
          requiredFunction: f.practice.requiredFunction || null,
          answerFormula: f.practice.answerFormula || null,
        }
      : null,
    tagIds: f.tagIds,
    skillIds: f.skillIds,
    resourceIds: f.resourceIds,
    subtitles: f.subtitles
      .filter((s) => s.text.trim() !== '')
      .map((s) => ({ startSec: num(s.startSec), endSec: num(s.endSec), text: s.text })),
  };
}

/** 공개 조건 (서버의 ContentService.checkPublishable과 같은 규칙) */
function checklist(f) {
  const filled = f.quiz.options.filter((o) => o.optionText.trim() !== '');
  const correct = f.quiz.options.filter((o) => o.correct && o.optionText.trim() !== '');
  return {
    required: [
      { label: '콘텐츠 제목', ok: f.title.trim() !== '' },
      { label: '숏폼 영상 업로드', ok: !!f.video && Number(f.durationSec) > 0 },
      { label: '퀴즈 문제', ok: f.quiz.question.trim() !== '' },
      { label: '퀴즈 보기 2개 이상', ok: filled.length >= 2 },
      { label: '정답 1개 선택', ok: correct.length === 1 },
      { label: '퀴즈 해설', ok: f.quiz.explanation.trim() !== '' },
    ],
    recommended: [
      { label: '학습 목표', ok: f.learningGoal.trim() !== '' },
      { label: '썸네일', ok: !!f.thumbnail },
      { label: '오답 보기별 피드백', ok: filled.filter((o) => !o.correct).every((o) => o.feedback.trim() !== '') && filled.length > 1 },
      { label: '검색 태그 1개 이상', ok: f.tagIds.length > 0 },
      { label: '스킬 연결', ok: f.skillIds.length > 0 },
    ],
  };
}

export default function ContentEditorPage() {
  const { id } = useParams();
  const router = useRouter();
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null);
  const [course, setCourse] = useState(null);
  const [tags, setTags] = useState([]);
  const [skills, setSkills] = useState([]);
  const [resources, setResources] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [preview, setPreview] = useState(false);
  const [localVideoUrl, setLocalVideoUrl] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await api.content(id);
      const [c, t, r] = await Promise.all([api.course(d.courseId), api.tags(), api.resources()]);
      const s = await api.skills(c.categoryId);
      setDetail(d);
      setForm(fromDetail(d));
      setCourse(c);
      setTags(t);
      setResources(r);
      setSkills(s);
      setDirty(false);
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // 저장하지 않은 변경이 있으면 창을 닫을 때 경고
  useEffect(() => {
    const handler = (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => () => localVideoUrl && URL.revokeObjectURL(localVideoUrl), [localVideoUrl]);

  const update = useCallback((patch) => {
    setForm((f) => ({ ...f, ...(typeof patch === 'function' ? patch(f) : patch) }));
    setDirty(true);
  }, []);

  const checks = useMemo(() => (form ? checklist(form) : null), [form]);

  function showError(err, prefix) {
    setMessage({ type: 'error', text: (prefix ? prefix + ' ' : '') + err.message, details: err.details });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save() {
    setBusy(true);
    try {
      const d = await api.saveContent(id, toPayload(form));
      setDetail(d);
      setForm(fromDetail(d));
      setDirty(false);
      setMessage({ type: 'success', text: '임시저장했습니다.' });
      return true;
    } catch (err) {
      showError(err);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (dirty && !(await save())) return;
    setBusy(true);
    try {
      const d = await api.publishContent(id);
      setDetail(d);
      setForm(fromDetail(d));
      setMessage({ type: 'success', text: '공개했습니다. 사용자 화면의 과정 목록에 노출됩니다.' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function hide() {
    setBusy(true);
    try {
      const d = await api.hideContent(id);
      setDetail(d);
      setMessage({ type: 'success', text: '비공개로 바꿨습니다. 학습 기록은 그대로 남습니다.' });
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('이 콘텐츠를 삭제할까요? 되돌릴 수 없습니다.')) return;
    setBusy(true);
    try {
      await api.deleteContent(id);
      setDirty(false);
      router.push(`/admin/courses/${detail.courseId}`);
    } catch (err) {
      showError(err);
      setBusy(false);
    }
  }

  if (!form || !detail) {
    return message ? <div className="alert error">{message.text}</div> : <p className="muted">불러오는 중…</p>;
  }

  const requiredDone = checks.required.every((c) => c.ok);

  return (
    <>
      <div className="crumbs">
        <Link href="/admin/courses">과정·콘텐츠 관리</Link> ›{' '}
        <Link href={`/admin/courses/${detail.courseId}`}>{detail.courseTitle}</Link> › 콘텐츠 등록
      </div>
      <div className="page-head">
        <div>
          <div className="row">
            <h1>{form.title || '제목 없음'}</h1>
            <StatusBadge status={detail.status} />
            {detail.version > 1 && <span className="badge blue">영상 v{detail.version}</span>}
            {dirty && <span className="badge amber">저장 안 됨</span>}
          </div>
          <p>필수 항목을 채우고 공개하면 사용자 화면에 노출됩니다. 언제든 임시저장할 수 있습니다.</p>
        </div>
        <div className="row">
          {!detail.publishedAt && (
            <button className="btn danger" onClick={remove} disabled={busy}>
              삭제
            </button>
          )}
          <button className="btn" onClick={() => setPreview(true)}>
            미리보기
          </button>
          <button className="btn" onClick={save} disabled={busy || !form.title.trim()}>
            임시저장
          </button>
          {detail.status === 'PUBLISHED' ? (
            <button className="btn danger" onClick={hide} disabled={busy}>
              비공개
            </button>
          ) : (
            <button className="btn primary" onClick={publish} disabled={busy}>
              공개하기
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
        <div className="stack">
          <BasicSection form={form} update={update} />
          <VideoSection
            form={form}
            update={update}
            localVideoUrl={localVideoUrl}
            setLocalVideoUrl={setLocalVideoUrl}
            onError={showError}
          />
          <QuizSection form={form} update={update} />
          <PracticeSection form={form} update={update} onError={showError} />
          <ResourceSection form={form} update={update} resources={resources} />
          <SearchSection form={form} update={update} tags={tags} skills={skills} />
          <SubtitleSection form={form} update={update} />
        </div>

        <aside className="stack sticky">
          <section className="card">
            <div className="card-head">
              <h2>공개 조건</h2>
              {requiredDone ? <span className="badge green">공개 가능</span> : <span className="badge gray">미충족</span>}
            </div>
            <ChecklistView items={checks.required} />
            <h3 style={{ margin: '16px 0 8px' }}>권장 항목</h3>
            <ChecklistView items={checks.recommended} />
          </section>
          <section className="card" style={{ fontSize: 14 }}>
            <h3 style={{ marginBottom: 8 }}>정보</h3>
            <div className="muted">과정: {course ? course.title : '-'}</div>
            <div className="muted">영상 길이: {formatDuration(form.durationSec)}</div>
            <div className="muted">화면 비율: {form.aspectRatio || '-'}</div>
          </section>
        </aside>
      </div>

      {preview && (
        <PreviewModal
          form={form}
          videoSrc={localVideoUrl || fileUrl(form.video)}
          resources={resources.filter((r) => form.resourceIds.includes(r.id))}
          onClose={() => setPreview(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function SectionHead({ no, title, desc, optional }) {
  return (
    <div className="card-head">
      <div>
        <h2>
          <span className="section-no">{no}</span>
          {title}
          {optional && <span className="optional">선택</span>}
        </h2>
        {desc && <p>{desc}</p>}
      </div>
    </div>
  );
}

function ChecklistView({ items }) {
  return (
    <ul className="checklist">
      {items.map((c) => (
        <li key={c.label}>
          <span className={`dot ${c.ok ? 'ok' : 'no'}`}>{c.ok ? '✓' : ''}</span>
          <span style={{ color: c.ok ? 'var(--text)' : 'var(--text-3)' }}>{c.label}</span>
        </li>
      ))}
    </ul>
  );
}

function BasicSection({ form, update }) {
  return (
    <section className="card">
      <SectionHead no={1} title="기본 정보" />
      <div className="fields">
        <label className="field wide">
          <span>콘텐츠 제목</span>
          <input type="text" value={form.title} maxLength={100} onChange={(e) => update({ title: e.target.value })} />
        </label>
        <label className="field wide">
          <span>
            학습 목표 <span className="hint">· AI 피드백의 기준으로도 쓰입니다</span>
          </span>
          <input
            type="text"
            value={form.learningGoal}
            maxLength={500}
            placeholder="예) 조건에 맞는 데이터의 합계를 구할 수 있다"
            onChange={(e) => update({ learningGoal: e.target.value })}
          />
        </label>
        <label className="field wide">
          <span>이번 영상으로 할 수 있는 업무</span>
          <input
            type="text"
            value={form.workUse}
            maxLength={255}
            placeholder="예) 부서별 매출 합계 계산"
            onChange={(e) => update({ workUse: e.target.value })}
          />
        </label>
        <label className="field">
          <span>과정 내 순서</span>
          <input type="number" min={1} value={form.sortOrder} onChange={(e) => update({ sortOrder: e.target.value })} />
        </label>
      </div>
    </section>
  );
}

/** 영상 업로드: 업로드 전에 브라우저에서 길이·비율을 읽고, 진행률을 보여주며 올립니다. */
function VideoSection({ form, update, localVideoUrl, setLocalVideoUrl, onError }) {
  const videoRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [thumbBusy, setThumbBusy] = useState(false);

  function readMetadata(url) {
    return new Promise((resolve, reject) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
      v.onerror = () => reject(new Error('영상 정보를 읽지 못했습니다. mp4(H.264) 파일인지 확인해 주세요.'));
      v.src = url;
    });
  }

  async function onSelectVideo(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.mp4')) {
      onError(new Error('mp4 파일만 올릴 수 있습니다.'));
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      onError(new Error(`영상은 ${MAX_VIDEO_MB}MB 이하만 올릴 수 있습니다.`));
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const meta = await readMetadata(url);
      const ratio = aspectLabel(meta.width, meta.height);
      const w = [];
      if (meta.duration > RECOMMENDED_MAX_SEC) w.push(`영상이 ${formatDuration(meta.duration)}로 3분을 넘습니다. 숏폼은 1~3분을 권장합니다.`);
      if (ratio !== '9:16') w.push(`화면 비율이 ${ratio}입니다. 세로형(9:16) 영상을 권장합니다.`);
      setWarnings(w);
      setLocalVideoUrl(url);
      setProgress(0);
      const uploaded = await uploadFile(file, 'VIDEO', setProgress);
      update({ video: uploaded, durationSec: Math.round(meta.duration), aspectRatio: ratio });
    } catch (err) {
      URL.revokeObjectURL(url);
      setLocalVideoUrl(null);
      onError(err, '영상 업로드 실패:');
    } finally {
      setProgress(null);
    }
  }

  async function onSelectThumbnail(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setThumbBusy(true);
    try {
      update({ thumbnail: await uploadFile(file, 'THUMBNAIL') });
    } catch (err) {
      onError(err, '썸네일 업로드 실패:');
    } finally {
      setThumbBusy(false);
    }
  }

  /** 지금 멈춘 장면을 캔버스로 캡처해 썸네일로 올립니다. (방금 고른 영상 파일에서만 가능) */
  async function captureThumbnail() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setThumbBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      const file = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
      update({ thumbnail: await uploadFile(file, 'THUMBNAIL') });
    } catch (err) {
      onError(err, '썸네일 캡처 실패:');
    } finally {
      setThumbBusy(false);
    }
  }

  const src = localVideoUrl || fileUrl(form.video);

  return (
    <section className="card">
      <SectionHead no={2} title="숏폼 영상·썸네일" desc="mp4, 200MB 이하, 세로형(9:16) 1~3분 권장" />
      <div className="video-box">
        <div className="video-frame">{src ? <video ref={videoRef} src={src} controls playsInline /> : null}</div>
        <div className="stack" style={{ flex: 1, minWidth: 220 }}>
          <label className="dropzone">
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{form.video ? form.video.originalName : '영상 파일을 선택하세요'}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {form.video
                  ? `${formatBytes(form.video.sizeBytes)} · ${formatDuration(form.durationSec)} · ${form.aspectRatio || '-'}`
                  : '선택하면 길이와 화면 비율을 자동으로 읽어 저장합니다.'}
              </div>
            </div>
            <span className="btn small">{form.video ? '영상 교체' : '파일 선택'}</span>
            <input type="file" accept="video/mp4" onChange={onSelectVideo} hidden />
          </label>
          {progress !== null && (
            <div>
              <div className="progress">
                <div style={{ width: `${progress}%` }} />
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                업로드 중 {progress}%
              </div>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="alert info">
              {warnings.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
          )}

          <div className="row">
            {form.thumbnail ? <img className="thumb" src={fileUrl(form.thumbnail)} alt="썸네일" /> : <div className="thumb" />}
            <div className="stack" style={{ gap: 8 }}>
              <label className="btn small">
                {thumbBusy ? '올리는 중…' : '썸네일 이미지 올리기'}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onSelectThumbnail} hidden />
              </label>
              <button className="btn small" onClick={captureThumbnail} disabled={!localVideoUrl || thumbBusy} type="button">
                현재 장면을 썸네일로
              </button>
              {!localVideoUrl && (
                <span className="muted" style={{ fontSize: 12 }}>
                  장면 캡처는 이번에 고른 영상 파일에서만 가능합니다.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuizSection({ form, update }) {
  const q = form.quiz;

  function setQuiz(patch) {
    update((f) => ({ quiz: { ...f.quiz, ...patch } }));
  }

  function setOption(index, patch) {
    update((f) => {
      const options = f.quiz.options.map((o, i) => {
        if (patch.correct === true) {
          // 정답은 하나만
          return i === index ? { ...o, ...patch } : { ...o, correct: false };
        }
        return i === index ? { ...o, ...patch } : o;
      });
      return { quiz: { ...f.quiz, options } };
    });
  }

  function addOption() {
    if (q.options.length >= 6) return;
    setQuiz({ options: [...q.options, emptyOption()] });
  }

  function removeOption(index) {
    if (q.options.length <= 2) return;
    setQuiz({ options: q.options.filter((_, i) => i !== index) });
  }

  return (
    <section className="card">
      <SectionHead
        no={3}
        title="퀴즈"
        desc="영상마다 1문항. 오답 보기마다 피드백을 적어 두면 사용자가 제출하는 즉시 보여 줍니다."
      />
      <div className="stack">
        <label className="field">
          <span>문제</span>
          <input
            type="text"
            value={q.question}
            maxLength={500}
            placeholder="예) 특정 부서의 매출만 합산할 때 가장 알맞은 함수는?"
            onChange={(e) => setQuiz({ question: e.target.value })}
          />
        </label>

        {q.options.map((o, i) => (
          <div className={`option${o.correct ? ' correct' : ''}`} key={i}>
            <div className="option-top">
              <span className="option-no">{i + 1}</span>
              <input
                type="text"
                value={o.optionText}
                maxLength={255}
                placeholder={`보기 ${i + 1}`}
                onChange={(e) => setOption(i, { optionText: e.target.value })}
                style={{ flex: 1 }}
              />
              <label className="row" style={{ gap: 6, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                <input type="radio" name="correct" checked={o.correct} onChange={() => setOption(i, { correct: true })} />
                정답
              </label>
              <button
                className="btn small ghost"
                type="button"
                aria-label={`보기 ${i + 1} 삭제`}
                onClick={() => removeOption(i)}
                disabled={q.options.length <= 2}
              >
                ✕
              </button>
            </div>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <input
                type="text"
                value={o.feedback}
                placeholder={o.correct ? '정답 피드백 (선택)' : '이 보기를 고르면 보여줄 피드백 (예: COUNTIF는 개수를 셉니다)'}
                onChange={(e) => setOption(i, { feedback: e.target.value })}
                style={{ flex: 1, minWidth: 200 }}
              />
              {!o.correct && (
                <input
                  type="number"
                  min={0}
                  value={o.rewatchSec}
                  placeholder="다시 볼 시점(초)"
                  onChange={(e) => setOption(i, { rewatchSec: e.target.value })}
                  style={{ width: 150 }}
                />
              )}
            </div>
          </div>
        ))}
        <div>
          <button className="btn small" type="button" onClick={addOption} disabled={q.options.length >= 6}>
            보기 추가
          </button>
        </div>

        <label className="field">
          <span>해설</span>
          <textarea
            value={q.explanation}
            placeholder="정답·오답과 관계없이 제출 후 보여 줄 해설"
            onChange={(e) => setQuiz({ explanation: e.target.value })}
          />
        </label>
      </div>
    </section>
  );
}

function PracticeSection({ form, update, onError }) {
  const p = form.practice;
  const [uploading, setUploading] = useState(false);

  function setPractice(patch) {
    update((f) => ({ practice: { ...f.practice, ...patch } }));
  }

  async function onSelectFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      setPractice({ exampleFile: await uploadFile(file, 'PRACTICE') });
    } catch (err) {
      onError(err, '예제 파일 업로드 실패:');
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>
            <span className="section-no">4</span>실습<span className="optional">선택</span>
          </h2>
          <p>사용자가 예제 파일로 실습한 뒤 수식과 결과를 입력합니다. 서버가 결과를 비교하고 AI가 설명합니다.</p>
        </div>
        <label className="row" style={{ gap: 6, fontWeight: 700, fontSize: 14 }}>
          <input type="checkbox" checked={form.practiceOn} onChange={(e) => update({ practiceOn: e.target.checked })} />
          실습 넣기
        </label>
      </div>
      {form.practiceOn && (
        <div className="fields">
          <label className="field wide">
            <span>실습 제목</span>
            <input type="text" value={p.title} maxLength={100} placeholder="예) 영업부 매출 합계 구하기" onChange={(e) => setPractice({ title: e.target.value })} />
          </label>
          <label className="field wide">
            <span>수행 방법</span>
            <textarea value={p.instruction} onChange={(e) => setPractice({ instruction: e.target.value })} />
          </label>
          <div className="field wide">
            <span>예제 파일 (xlsx, xls, csv)</span>
            <div className="row">
              <label className="btn small">
                {uploading ? '올리는 중…' : p.exampleFile ? '파일 교체' : '파일 선택'}
                <input type="file" accept=".xlsx,.xls,.csv" onChange={onSelectFile} hidden />
              </label>
              {p.exampleFile && (
                <a href={fileUrl(p.exampleFile)} target="_blank" rel="noreferrer">
                  {p.exampleFile.originalName}
                </a>
              )}
            </div>
          </div>
          <label className="field">
            <span>예시 결과 (정답 결과값)</span>
            <input type="text" value={p.expectedResult} placeholder="예) 4520000" onChange={(e) => setPractice({ expectedResult: e.target.value })} />
          </label>
          <label className="field">
            <span>결과 비교 방식</span>
            <select value={p.resultType} onChange={(e) => setPractice({ resultType: e.target.value })}>
              <option value="NUMBER">숫자 (허용 오차 적용)</option>
              <option value="TEXT">문자 (정확히 일치)</option>
            </select>
          </label>
          <label className="field">
            <span>허용 오차</span>
            <input type="number" min={0} step="any" value={p.tolerance} onChange={(e) => setPractice({ tolerance: e.target.value })} disabled={p.resultType !== 'NUMBER'} />
          </label>
          <label className="field">
            <span>핵심 함수</span>
            <input type="text" value={p.requiredFunction} placeholder="예) SUMIF" onChange={(e) => setPractice({ requiredFunction: e.target.value })} />
          </label>
          <label className="field wide">
            <span>
              정답 수식 <span className="hint">· 두 번째 시도부터 사용자에게 공개</span>
            </span>
            <input type="text" value={p.answerFormula} placeholder='예) =SUMIF(B2:B20,"영업부",C2:C20)' onChange={(e) => setPractice({ answerFormula: e.target.value })} />
          </label>
        </div>
      )}
    </section>
  );
}

function ResourceSection({ form, update, resources }) {
  function toggle(id) {
    update((f) => ({
      resourceIds: f.resourceIds.includes(id) ? f.resourceIds.filter((x) => x !== id) : [...f.resourceIds, id],
    }));
  }
  return (
    <section className="card">
      <SectionHead no={5} title="실무자료 연결" desc="영상 아래에 보여 줄 템플릿·예시 문서·프롬프트" optional />
      {resources.length === 0 ? (
        <div className="muted">
          등록된 자료가 없습니다. <Link href="/admin/resources">실무자료 관리</Link>에서 먼저 등록하세요.
        </div>
      ) : (
        <div className="chips">
          {resources.map((r) => (
            <button type="button" key={r.id} className={`chip${form.resourceIds.includes(r.id) ? ' on' : ''}`} onClick={() => toggle(r.id)}>
              {r.title} <small>{RESOURCE_TYPES[r.resourceType]}</small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function SearchSection({ form, update, tags, skills }) {
  function toggle(key, id) {
    update((f) => ({ [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] }));
  }
  return (
    <section className="card">
      <SectionHead
        no={6}
        title="검색 태그·스킬"
        desc="업무 상황·오류 메시지 태그를 달면 함수 이름을 몰라도 검색됩니다. 스킬은 마이스펙 레이더 차트에 반영됩니다."
      />
      <h3 style={{ marginBottom: 8 }}>검색 태그</h3>
      {tags.length === 0 ? (
        <div className="muted" style={{ marginBottom: 12 }}>
          등록된 태그가 없습니다. <Link href="/admin/tags">검색 태그 관리</Link>에서 추가하세요.
        </div>
      ) : (
        <div className="chips" style={{ marginBottom: 16 }}>
          {tags.map((t) => (
            <button type="button" key={t.id} className={`chip${form.tagIds.includes(t.id) ? ' on' : ''}`} onClick={() => toggle('tagIds', t.id)}>
              {t.name} <small>{TAG_TYPES[t.tagType]}</small>
            </button>
          ))}
        </div>
      )}
      <h3 style={{ marginBottom: 8 }}>스킬</h3>
      {skills.length === 0 ? (
        <div className="muted">이 분야에 등록된 스킬이 없습니다.</div>
      ) : (
        <div className="chips">
          {skills.map((s) => (
            <button type="button" key={s.id} className={`chip${form.skillIds.includes(s.id) ? ' on' : ''}`} onClick={() => toggle('skillIds', s.id)}>
              {s.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** 자막: 직접 입력하거나 SRT/VTT를 붙여 넣으면 구간별로 나눕니다. (영상 속 구간 검색용) */
function SubtitleSection({ form, update }) {
  const [raw, setRaw] = useState('');
  const [note, setNote] = useState('');

  function setRow(index, patch) {
    update((f) => ({ subtitles: f.subtitles.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));
  }

  function addRow() {
    update((f) => {
      const last = f.subtitles[f.subtitles.length - 1];
      const start = last ? Number(last.endSec) || 0 : 0;
      return { subtitles: [...f.subtitles, { startSec: String(start), endSec: String(start + 5), text: '' }] };
    });
  }

  function importText(text) {
    const rows = parseSubtitleText(text);
    if (rows.length === 0) {
      setNote('자막 구간을 찾지 못했습니다. "00:00:01,000 --> 00:00:04,000" 형식인지 확인해 주세요.');
      return;
    }
    update({ subtitles: rows.map((r) => ({ startSec: String(r.startSec), endSec: String(r.endSec), text: r.text })) });
    setNote(`${rows.length}개 구간을 가져왔습니다. 임시저장해야 반영됩니다.`);
    setRaw('');
  }

  function onSelectFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importText(String(reader.result || ''));
    reader.readAsText(file, 'utf-8');
  }

  return (
    <section className="card">
      <SectionHead no={7} title="자막" desc="자막이 있으면 검색어가 나오는 시점부터 영상을 재생할 수 있습니다." optional />
      <div className="stack">
        {form.subtitles.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 110 }}>시작(초)</th>
                  <th style={{ width: 110 }}>끝(초)</th>
                  <th>자막 문장</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {form.subtitles.map((s, i) => (
                  <tr key={i}>
                    <td>
                      <input type="number" min={0} step="0.1" value={s.startSec} onChange={(e) => setRow(i, { startSec: e.target.value })} />
                    </td>
                    <td>
                      <input type="number" min={0} step="0.1" value={s.endSec} onChange={(e) => setRow(i, { endSec: e.target.value })} />
                    </td>
                    <td>
                      <input type="text" value={s.text} maxLength={500} onChange={(e) => setRow(i, { text: e.target.value })} />
                    </td>
                    <td>
                      <button
                        className="btn small ghost"
                        type="button"
                        aria-label="자막 삭제"
                        onClick={() => update((f) => ({ subtitles: f.subtitles.filter((_, j) => j !== i) }))}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="row">
          <button className="btn small" type="button" onClick={addRow}>
            자막 줄 추가
          </button>
          <label className="btn small">
            SRT·VTT 파일 불러오기
            <input type="file" accept=".srt,.vtt,text/vtt" onChange={onSelectFile} hidden />
          </label>
        </div>
        <label className="field">
          <span>자막 붙여 넣기 (SRT·VTT 형식)</span>
          <textarea value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={'1\n00:00:00,000 --> 00:00:04,000\n부서별로 매출을 더하고 싶을 때 SUMIF를 씁니다'} />
        </label>
        <div className="row">
          <button className="btn small" type="button" onClick={() => importText(raw)} disabled={!raw.trim()}>
            붙여 넣은 자막 변환
          </button>
          {note && <span className="muted" style={{ fontSize: 13 }}>{note}</span>}
        </div>
      </div>
    </section>
  );
}

/** 사용자 화면에서 어떻게 보일지 확인하는 미리보기 (퀴즈를 실제로 풀어 볼 수 있음) */
function PreviewModal({ form, videoSrc, resources, onClose }) {
  const [picked, setPicked] = useState(null);
  const options = form.quiz.options.filter((o) => o.optionText.trim() !== '');
  const pickedOption = picked === null ? null : options[picked];

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="사용자 화면 미리보기" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h2>사용자 화면 미리보기</h2>
          <button className="btn small" onClick={onClose}>
            닫기
          </button>
        </div>
        <div className="row" style={{ alignItems: 'flex-start', gap: 20 }}>
          <div className="phone">
            {videoSrc ? <video src={videoSrc} controls playsInline /> : <div className="empty" style={{ color: '#9aa3b5' }}>영상 없음</div>}
            <div className="overlay">
              <div style={{ fontWeight: 800 }}>{form.title}</div>
              {form.workUse && <div style={{ fontSize: 13, opacity: 0.85 }}>이번 영상으로 할 수 있는 업무: {form.workUse}</div>}
            </div>
          </div>
          <div className="stack" style={{ flex: 1, minWidth: 240 }}>
            <div className="quiz-card">
              <div className="badge blue" style={{ alignSelf: 'flex-start' }}>
                퀴즈
              </div>
              <div style={{ fontWeight: 700 }}>{form.quiz.question || '(문제를 입력하세요)'}</div>
              {options.map((o, i) => {
                let cls = 'quiz-choice';
                if (picked !== null && o.correct) cls += ' right';
                else if (picked === i && !o.correct) cls += ' wrong';
                return (
                  <button key={i} className={cls} onClick={() => setPicked(i)} disabled={picked !== null}>
                    {i + 1}. {o.optionText}
                  </button>
                );
              })}
              {pickedOption && (
                <div className={`alert ${pickedOption.correct ? 'success' : 'error'}`}>
                  <strong>{pickedOption.correct ? '정답이에요!' : '아쉬워요.'}</strong>
                  {pickedOption.feedback && <div>{pickedOption.feedback}</div>}
                  {!pickedOption.correct && pickedOption.rewatchSec !== '' && (
                    <div>{formatDuration(pickedOption.rewatchSec)}부터 다시 보기</div>
                  )}
                  {form.quiz.explanation && <div style={{ marginTop: 6, color: 'var(--text-2)' }}>해설: {form.quiz.explanation}</div>}
                </div>
              )}
              {picked !== null && (
                <button className="btn small" onClick={() => setPicked(null)}>
                  다시 풀기
                </button>
              )}
            </div>
            {form.practiceOn && form.practice.title && (
              <div className="quiz-card">
                <div className="badge amber" style={{ alignSelf: 'flex-start' }}>
                  실습 (선택)
                </div>
                <div style={{ fontWeight: 700 }}>{form.practice.title}</div>
                <div className="muted" style={{ fontSize: 14, whiteSpace: 'pre-line' }}>{form.practice.instruction}</div>
              </div>
            )}
            {resources.length > 0 && (
              <div className="quiz-card">
                <div className="badge green" style={{ alignSelf: 'flex-start' }}>
                  실무자료
                </div>
                {resources.map((r) => (
                  <div key={r.id}>
                    {r.title} <span className="muted">· {RESOURCE_TYPES[r.resourceType]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
