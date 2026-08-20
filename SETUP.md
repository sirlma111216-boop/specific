# 설치 및 설정

처음 한 번만 하면 되는 준비 과정입니다. 순서대로 따라 하시면 됩니다.
Firebase 무료 요금제(Spark)로 충분히 운영할 수 있습니다.

---

## 0. 필요한 것

- Node.js 20 이상 (현재 개발 환경: v24)
- Google 계정 (Firebase 프로젝트용)
- Gemini API 키 ([Google AI Studio](https://aistudio.google.com/apikey)에서 발급)

---

## 1. Firebase 프로젝트 만들기

1. [Firebase 콘솔](https://console.firebase.google.com/)에서 **프로젝트 추가**
2. 프로젝트 이름 입력 (예: `saenggibu-helper`) → 애널리틱스는 꺼도 됩니다.

### 1-1. 웹 앱 등록

1. 프로젝트 개요 화면에서 **`</>` (웹)** 아이콘 클릭
2. 앱 닉네임 입력 후 등록 (호스팅 설정은 체크하지 않아도 됩니다)
3. 표시되는 `firebaseConfig` 값을 복사해 둡니다.

```js
const firebaseConfig = {
  apiKey: "AIza...",             // NEXT_PUBLIC_FIREBASE_API_KEY
  authDomain: "xxx.firebaseapp.com",  // NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  projectId: "xxx",              // NEXT_PUBLIC_FIREBASE_PROJECT_ID
  storageBucket: "xxx.appspot.com",   // NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "123...",   // NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  appId: "1:123:web:abc",        // NEXT_PUBLIC_FIREBASE_APP_ID
};
```

### 1-2. 이메일/비밀번호 로그인 켜기

**빌드 → Authentication → 시작하기 → Sign-in method → 이메일/비밀번호 → 사용 설정**

### 1-3. Firestore 만들기

**빌드 → Firestore Database → 데이터베이스 만들기**

- 위치: `asia-northeast3 (서울)` 권장
- 모드: **프로덕션 모드**로 시작 (규칙은 3단계에서 넣습니다)

### 1-4. 서비스 계정 키 발급 (서버 전용)

**프로젝트 설정(톱니바퀴) → 서비스 계정 → 새 비공개 키 생성** → JSON 파일이 내려받아집니다.

이 파일을 base64 한 줄로 바꿉니다.

PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\경로\키파일.json")) | Set-Clipboard
```

macOS / Linux:

```bash
base64 -w0 키파일.json
```

> ⚠️ 이 JSON은 관리자 권한 키입니다. 저장소에 커밋하거나 다른 사람에게 보내지 마세요.
> 다 쓰고 나면 내려받은 원본 파일은 삭제해도 됩니다.

---

## 2. 환경변수 채우기

프로젝트 루트의 `.env.local` 파일을 열어 값을 채웁니다. (`.env.example`이 서식 견본입니다)

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123...
NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc

FIREBASE_SERVICE_ACCOUNT_BASE64=eyJ0eXBlIjoic2Vydmlj...

GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.6-flash

TEACHER_SIGNUP_CODE=우리학교2026
```

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | 브라우저에 노출되어도 되는 값입니다. Firestore 보안 규칙이 실제 접근을 막습니다. |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | **서버 전용.** 절대 `NEXT_PUBLIC_` 접두사를 붙이지 마세요. |
| `GEMINI_API_KEY` | **서버 전용.** 클라이언트 번들에 들어가지 않습니다. |
| `GEMINI_MODEL` | 비워두면 `gemini-3.6-flash`를 씁니다. |
| `TEACHER_SIGNUP_CODE` | 이 값을 아는 사람만 교사 계정을 만들 수 있습니다. 학생에게 알려주지 마세요. |

`.env.local`은 `.gitignore`에 의해 커밋되지 않습니다.

---

## 3. Firestore 보안 규칙 적용

`firestore.rules` 파일의 내용을 적용해야 합니다. 둘 중 편한 방법을 쓰세요.

### 방법 A — 콘솔에 붙여넣기 (간단)

**Firestore Database → 규칙** 탭을 열고, `firestore.rules` 파일 내용을 통째로 붙여넣은 뒤 **게시**.

### 방법 B — Firebase CLI

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules
```

> 규칙을 적용하지 않으면 학생이 다른 학생의 기록이나 교사의 특기사항에 접근할 수 있습니다.
> **반드시 적용하세요.**

---

## 4. 실행

```bash
npm install
npm run dev
```

http://localhost:3000 접속.

운영용으로 돌릴 때는:

```bash
npm run build
npm start
```

---

## 5. 첫 사용 순서

1. **교사** — `/teacher/signup`에서 `TEACHER_SIGNUP_CODE`로 가입
2. 로그인하면 바로 **우리 반 등록하기** 화면이 뜹니다. 학급 정보 + 학생 명단(직접 입력 또는 엑셀) 입력
3. **자율·진로 활동** 메뉴에서 활동 등록 (영역 / 활동명 / 날짜 / 설명 / 안내문)
4. 학생들에게 안내 — 학년도 / 학교명 / 학년 / 반 / 번호 / 이름을 **교사가 등록한 그대로** 입력해 `/student/signup`에서 가입
5. 활동 날짜가 되면 학생이 로그인하는 즉시 소감 입력 화면이 뜹니다
6. 교사는 **학급 학생 → 학생 이름** 클릭 → 활동 체크 → 목표 글자 수 입력 → 생성 → 수정 → 저장/복사

---

## 6. 생기부 예시 파일 (선택, 권장)

루트의 `record_examples.md`를 선생님이 실제로 쓰시는 특기사항으로 바꾸면,
그 문체(문장 길이 · 종결어미 · 어휘 · 문장 연결 방식)를 따라 초안이 만들어집니다.

- 인식하는 파일명(앞쪽 우선): `record_examples.local.md`, `record_examples.md`, `record-examples.md`, `생기부_예시.md`, `생기부예시.md`, `examples.txt`, `data/record_examples.md`
- **저장소를 공개로 쓴다면** 실제 예시는 `record_examples.local.md`에 넣으세요. `.gitignore`에 걸려 커밋되지 않습니다.
- 예시 파일의 표현이 앱의 일반 문체 규칙과 다르면 **예시 파일 쪽을 우선**합니다.
- 예시에 학생 실명·학교명·기관명·강사명은 넣지 마세요.
- 파일을 고친 뒤에는 서버를 재시작해야 반영됩니다.

---

## 7. 문제 해결

| 증상 | 원인 / 해결 |
|---|---|
| "설정이 필요합니다" 화면 | `NEXT_PUBLIC_FIREBASE_*` 값이 비어 있음 → `.env.local` 채우고 서버 재시작 |
| 로그인은 되는데 "등록되지 않은 계정입니다" | Firestore `users` 문서가 없음. 회원가입 절차로 다시 가입 |
| `FIREBASE_SERVICE_ACCOUNT_BASE64 환경변수가 없습니다` | 1-4 단계 서비스 계정 키 미설정 |
| 학생 가입 시 "명단과 정보가 일치하지 않습니다" | 학년도/학교/학년/반/번호/이름 중 하나가 교사 등록값과 다름. 교사 화면의 학급 정보와 대조 |
| 특기사항 생성 시 429 | Gemini 무료 한도 초과. 20~30초 후 재시도하거나 결제 연결 |
| 특기사항 생성 시 400 "지역 제한" | 서버가 Gemini 미지원 지역에서 나가고 있음. 국내/지원 지역 서버에서 실행하거나 Vertex AI로 전환 필요 |
| 활동 삭제가 안 됨 | 학생 기록이 있는 활동은 삭제할 수 없습니다. 마감 처리하세요 |
| 학생이 "작성 기간이 지났습니다" | 활동 당일에만 작성할 수 있습니다. 결석 등 예외는 활동 관리에서 **다시 열기** |

---

## 8. 배포 시 주의

- **Cloudflare Workers/Pages에는 이 구성 그대로 올리지 마세요.** 엣지의 아웃바운드 지역이 고정되지 않아
  Gemini API가 간헐적으로 400 지역 오류를 냅니다. 이 경우 `lib/gemini/client.ts`를 Vertex AI 호출로 바꿔야 합니다.
- Vercel에 올릴 경우 리전을 서울(`icn1`) 등 지원 지역으로 고정하세요.
- 환경변수는 플랫폼의 **런타임 시크릿**으로 등록합니다.
