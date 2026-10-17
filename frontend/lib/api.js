// 백엔드 API 호출 모음. 모든 요청에 관리자 토큰을 붙이고, 오류는 {message, details} 형태로 통일합니다.

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const TOKEN_KEY = 'workfit_admin_token';
const NAME_KEY = 'workfit_admin_name';

export function getToken() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getAdminName() {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function saveLogin(token, name) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    /* 저장소를 못 쓰는 환경이면 새로고침 시 다시 로그인 */
  }
}

export function clearLogin() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(NAME_KEY);
  } catch {
    /* 무시 */
  }
}

/** 업로드 파일의 /files/... 경로를 백엔드 전체 주소로 바꿉니다. */
export function fileUrl(file) {
  if (!file || !file.url) return null;
  return API_URL + file.url;
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details || [];
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, '서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해 주세요.');
  }
  return handle(res);
}

async function handle(res) {
  if (res.status === 401) {
    clearLogin();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }
  if (res.status === 204) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, (data && data.message) || '요청을 처리하지 못했습니다.', data && data.details);
  }
  return data;
}

/**
 * 파일 업로드. fetch는 업로드 진행률을 알 수 없어서 XMLHttpRequest를 씁니다.
 * onProgress(0~100)로 진행률을 알려줍니다.
 */
export function uploadFile(file, type, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', API_URL + '/api/admin/files');
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(xhr.status, (data && data.message) || '업로드에 실패했습니다.', data && data.details));
    };
    xhr.onerror = () => reject(new ApiError(0, '업로드 중 연결이 끊어졌습니다.'));
    xhr.send(form);
  });
}

export const api = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  dashboard: () => request('/api/admin/dashboard'),
  categories: () => request('/api/admin/categories'),
  skills: (categoryId) => request('/api/admin/skills' + (categoryId ? `?categoryId=${categoryId}` : '')),

  courses: () => request('/api/admin/courses'),
  course: (id) => request(`/api/admin/courses/${id}`),
  createCourse: (body) => request('/api/admin/courses', { method: 'POST', body }),
  updateCourse: (id, body) => request(`/api/admin/courses/${id}`, { method: 'PUT', body }),
  courseStatus: (id, status) => request(`/api/admin/courses/${id}/status`, { method: 'PATCH', body: { status } }),
  courseContents: (id) => request(`/api/admin/courses/${id}/contents`),
  reorderContents: (id, contentIds) =>
    request(`/api/admin/courses/${id}/contents/order`, { method: 'PUT', body: { contentIds } }),

  createContent: (courseId, title) => request('/api/admin/contents', { method: 'POST', body: { courseId, title } }),
  content: (id) => request(`/api/admin/contents/${id}`),
  saveContent: (id, body) => request(`/api/admin/contents/${id}`, { method: 'PUT', body }),
  publishContent: (id) => request(`/api/admin/contents/${id}/publish`, { method: 'POST' }),
  hideContent: (id) => request(`/api/admin/contents/${id}/hide`, { method: 'POST' }),
  deleteContent: (id) => request(`/api/admin/contents/${id}`, { method: 'DELETE' }),

  resources: () => request('/api/admin/resources'),
  createResource: (body) => request('/api/admin/resources', { method: 'POST', body }),

  tags: () => request('/api/admin/tags'),
  createTag: (body) => request('/api/admin/tags', { method: 'POST', body }),
  addSynonym: (id, synonym) => request(`/api/admin/tags/${id}/synonyms`, { method: 'POST', body: { synonym } }),
};
