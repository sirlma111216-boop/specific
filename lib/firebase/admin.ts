import "server-only";

import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const ADMIN_APP_NAME = "saenggibu-admin";

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_BASE64 환경변수가 없습니다. Firebase 콘솔에서 서비스 계정 키를 발급받아 base64로 넣어주세요. (SETUP.md 참고)",
    );
  }
  let json: string;
  try {
    // 값이 base64가 아니라 원본 JSON일 수도 있으므로 둘 다 받아준다.
    json = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 값을 해석할 수 없습니다.");
  }
  const parsed = JSON.parse(json) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error(
      "서비스 계정 JSON에 project_id / client_email / private_key가 없습니다.",
    );
  }
  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    // .env 한 줄로 넣는 경우 개행이 \n 문자열로 들어온다.
    privateKey: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

let cached: App | null = null;

function adminApp(): App {
  if (cached) return cached;
  const existing = getApps().find((a) => a.name === ADMIN_APP_NAME);
  cached =
    existing ??
    initializeApp({ credential: cert(loadServiceAccount()) }, ADMIN_APP_NAME);
  return cached;
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}

/** 컬렉션 이름을 한 곳에서 관리한다. */
export const COL = {
  users: "users",
  classes: "classes",
  roster: "studentRoster",
  events: "events",
  responses: "responses",
  notes: "teacherNotes",
  records: "studentRecords",
} as const;

/** app_name/{id} 문서 id 규칙 — 같은 학생·같은 이벤트에 중복 응답이 생기지 않게 한다. */
export function responseId(eventId: string, studentUid: string): string {
  return `${eventId}__${studentUid}`;
}

/** 학생 1명 · 영역 1개당 최종 기록 1건 */
export function recordId(rosterId: string, category: string): string {
  return `${rosterId}__${category}`;
}

/**
 * 교사 보완 기록의 문서 id.
 * 학생 계정(uid)이 아니라 명단(rosterId) 기준이라, 아직 가입하지 않은 학생에게도 쓸 수 있다.
 */
export function noteId(eventId: string, rosterId: string): string {
  return `${eventId}__${rosterId}`;
}
