# WorkFit — 관리자 콘텐츠 업로드 모듈

직장인·예비 직장인을 위한 숏폼 실무 교육 플랫폼 **WorkFit**의 관리자 모듈입니다.
관리자가 과정을 만들고, 숏폼 영상·퀴즈·실습·실무자료·검색 태그·자막을 등록한 뒤 공개 조건을 검사해 공개합니다.

| 구분 | 기술 |
| --- | --- |
| 프론트엔드 | Next.js 14 (App Router), React 18, JavaScript |
| 백엔드 | FastAPI (Python 3.10 이상), SQLAlchemy 2.0, PyMySQL |
| DB | MySQL 8.0 |
| 파일 저장 | 로컬 폴더 (`backend/uploads`) |

## 폴더 구조

```
workfit/
├─ db/
│  ├─ schema.sql      테이블 29개 생성 (DB 명세서와 동일)
│  └─ seed.sql        등급·분야·스킬·관리자 계정·SUMIF 예시 콘텐츠
├─ backend/           FastAPI API 서버 (포트 8080)
│  ├─ requirements.txt  필요한 파이썬 패키지
│  ├─ .env.example      DB 비밀번호 등 설정 예시 (.env로 복사해서 사용)
│  └─ app/
│     ├─ main.py        앱 시작점 (CORS, 라우터 등록, 초기 비밀번호 설정)
│     ├─ auth.py        관리자 로그인, 토큰 확인
│     ├─ files.py       파일 업로드 저장, 영상 구간(Range) 제공
│     ├─ models.py      DB 테이블 모델 (schema.sql과 1:1)
│     ├─ schemas.py     요청·응답 형식 (camelCase JSON)
│     ├─ errors.py      오류 응답 형식 {message, details}
│     └─ routers/       과정·콘텐츠·실무자료·태그·대시보드 API
└─ frontend/          Next.js 관리자 화면 (포트 3000)
   ├─ app/login            로그인
   ├─ app/admin            대시보드
   ├─ app/admin/courses    과정 목록·과정 상세(콘텐츠 순서)
   ├─ app/admin/contents   콘텐츠 등록 (핵심 화면)
   ├─ app/admin/resources  실무자료 관리
   └─ app/admin/tags       검색 태그·동의어 관리
```

## 실행 방법 (Windows 기준)

필요한 프로그램: **MySQL 8.0 이상**, **Python 3.10 이상**, **Node.js 18.18 이상**

### 1) DB 만들기
MySQL Workbench에서 `db/schema.sql` → `db/seed.sql` 순서로 열어 실행합니다(⚡ 버튼).
명령 프롬프트를 쓴다면 아래처럼 실행합니다.
```
mysql -u root -p --default-character-set=utf8mb4 < db/schema.sql
mysql -u root -p --default-character-set=utf8mb4 < db/seed.sql
```
> `schema.sql`은 기존 workfit 테이블을 지우고 다시 만듭니다. 데이터가 쌓인 뒤에는 다시 실행하지 마세요.

### 2) 백엔드 실행
```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```
`.env`를 열어 `DB_PASSWORD=1234`를 본인 MySQL 비밀번호로 바꾼 뒤 서버를 켭니다.
```
uvicorn app.main:app --reload --port 8080
```
- `Application startup complete`가 보이면 성공입니다.
- 처음 실행할 때 seed의 관리자 계정 비밀번호가 `admin1234`로 설정됩니다.
- http://localhost:8080/docs 에서 모든 API를 확인하고 직접 호출해 볼 수 있습니다(FastAPI 자동 문서).

### 3) 프론트엔드 실행
```
cd frontend
npm install
npm run dev
```
브라우저에서 http://localhost:3000 을 열고 **admin@workfit.dev / admin1234**로 로그인합니다.

## 주요 기능

| 화면 | 기능 |
| --- | --- |
| 로그인 | 관리자(ADMIN) 계정만 로그인, BCrypt 비밀번호 확인 |
| 대시보드 | 회원·과정·콘텐츠·자료·태그 수, 최근 콘텐츠, 최근 관리자 작업 기록 |
| 과정 관리 | 과정 생성·수정, 공개 조건 검사 후 공개/비공개, 콘텐츠 순서 변경 |
| 콘텐츠 등록 | 영상 업로드(진행률·길이·비율 자동 인식), 썸네일 업로드·장면 캡처, 퀴즈(보기별 오답 피드백·다시 볼 시점), 선택 실습(예제 파일·정답 결과·허용 오차), 실무자료 연결, 검색 태그·스킬, 자막(SRT/VTT 가져오기), 공개 조건 체크리스트, 사용자 화면 미리보기, 임시저장·공개·비공개·삭제 |
| 실무자료 관리 | 템플릿·예시 문서(파일) / 프롬프트(본문) 등록 |
| 검색 태그 관리 | 업무 상황·오류 메시지·함수 태그와 동의어 등록 |

공개 조건(서버 검사, DB 명세서 8-1): 제목, 영상과 길이, 퀴즈 문제·보기 2개 이상·정답 정확히 1개·해설.

## 알려진 제한
- 로그인 토큰은 서버 메모리에 저장하므로 백엔드를 재시작하면 다시 로그인해야 합니다. (실서비스에서는 JWT 또는 Redis로 교체)
- seed.sql의 예시 콘텐츠는 실제 영상 파일이 없어 재생되지 않습니다. 영상을 새로 올리면 정상 재생됩니다.
- 퀴즈 보기별 피드백은 지금은 관리자가 직접 입력합니다. AI 초안 생성 버튼은 다음 단계에서 추가합니다(feedback_source = AI_DRAFT 자리 마련됨).

## AI 사용 내역
과제 안내에 따라 AI를 사용한 부분을 밝힙니다. (팀에서 실제 사용 범위에 맞게 수정하세요.)

| 부분 | 사용한 AI | AI가 한 일 | 팀원이 한 일 |
| --- | --- | --- | --- |
| DB 설계·SQL (`db/`) | Claude (Anthropic) | 2주차 기획서를 바탕으로 테이블·컬럼·제약 조건 초안과 SQL 작성 | 요구사항 정리, 용어·우선순위 검토, 실행 확인 |
| 백엔드 (`backend/`) | Claude (Anthropic) | FastAPI 모델·API·공개 조건 검사·파일 업로드 코드 초안 작성 | 기술 스택(FastAPI) 결정, 실행·디버깅, 화면 캡처 |
| 프론트엔드 (`frontend/`) | Claude (Anthropic) | 관리자 화면 7개와 API 연동 코드 초안 작성 | 화면 구성 검토, 실행·디버깅 |
