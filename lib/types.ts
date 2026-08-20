/** 앱 전체에서 공유하는 도메인 타입. Firestore 문서 모양과 1:1로 맞춘다. */

export type Role = "teacher" | "student";

/** 창의적 체험활동 영역. MVP는 자율·자치활동 / 진로활동 두 가지만 다룬다. */
export type Category = "autonomous" | "career";

export const CATEGORY_LABEL: Record<Category, string> = {
  autonomous: "자율",
  career: "진로",
};

export const CATEGORY_FULL_LABEL: Record<Category, string> = {
  autonomous: "자율·자치활동",
  career: "진로활동",
};

export type SignupStatus = "pending" | "linked";

/** 교사가 직접 제어하는 이벤트 상태. 실제 학생 노출 여부는 날짜와 함께 계산한다. */
export type EventStatus = "scheduled" | "open" | "closed";

/** 학생 화면에서 보이는 계산된 상태 */
export type EventPhase = "scheduled" | "writable" | "submitted" | "closed";

export interface UserDoc {
  uid: string;
  role: Role;
  email: string;
  createdAt: number;
  /** 교사: 담당 학급(현재 MVP는 1인 1학급) / 학생: 소속 학급 */
  classId: string | null;
  /** 학생만 사용 */
  rosterId?: string | null;
  /** 교사만 사용 */
  teacherName?: string;
}

export interface ClassDoc {
  classId: string;
  schoolYear: number;
  schoolName: string;
  grade: string;
  classNumber: string;
  teacherName: string;
  teacherId: string;
  createdAt: number;
  /** 학생 가입 매칭용 정규화 키 (공백/구분자 제거) */
  matchKey: string;
  /**
   * 명단 인원수(비정규화).
   * 목록 화면에서 반 전체 문서를 읽지 않기 위해 들고 있다. 명단 추가·삭제 시 갱신.
   * 예전 데이터에는 없을 수 있으므로 읽는 쪽에서 undefined를 허용한다.
   */
  studentCount?: number;
}

export interface RosterDoc {
  rosterId: string;
  classId: string;
  studentNumber: number;
  studentName: string;
  /** 이름 정규화 값. 공백만 제거하며 유사도 매칭은 하지 않는다. */
  studentNameNorm: string;
  signupStatus: SignupStatus;
  linkedUserId: string | null;
  createdAt: number;
  /**
   * 영역별 "기록이 있는 활동 수"(비정규화). 학생 원문이든 교사 보완본이든 하나라도 있으면 1.
   * 학생 목록에서 반 전체 소감을 읽지 않기 위해 들고 있다.
   * 소감 저장 / 교사 기록 저장·삭제 시에만 갱신된다.
   */
  autonomousCount?: number;
  careerCount?: number;
}

export interface EventDoc {
  eventId: string;
  classId: string;
  category: Category;
  title: string;
  description: string;
  /** 학생 화면 상단에 노출되는 안내문 */
  guidance: string;
  /** YYYY-MM-DD (한국 날짜) */
  eventDate: string;
  status: EventStatus;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  /** 이 활동에 소감을 낸 학생 수(비정규화). 활동 목록에서 반 전체 소감을 읽지 않기 위함. */
  submittedCount?: number;
}

export interface ResponseDoc {
  responseId: string;
  eventId: string;
  classId: string;
  studentUid: string;
  rosterId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 교사가 보완한 활동 기록.
 *
 * 학생이 쓴 원문(responses)은 절대 건드리지 않고 별도 컬렉션에 쌓는다.
 *  · 학생 화면에는 언제나 학생 본인이 쓴 원문만 보인다.
 *  · 교사 화면과 AI 생성에는 교사 보완본이 우선 적용된다.
 * 보안 규칙상 학생은 이 컬렉션을 읽을 수 없다.
 */
export interface TeacherNoteDoc {
  noteId: string;
  classId: string;
  rosterId: string;
  eventId: string;
  teacherId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export type SelectionMode = "priority" | "random";

export interface StudentRecordDoc {
  recordId: string;
  classId: string;
  rosterId: string;
  studentId: string;
  teacherId: string;
  category: Category;
  selectedEventIds: string[];
  /** eventId -> 교사가 체크한 순서(1부터) */
  selectionOrder: Record<string, number>;
  selectionMode: SelectionMode;
  usedEventIds: string[];
  targetLength: number;
  generatedText: string;
  editedText: string;
  generatedCharacterCount: number;
  finalCharacterCount: number;
  createdAt: number;
  updatedAt: number;
}

/* ── 화면 전달용 뷰 모델 ─────────────────────────────────── */

export interface StudentListItem {
  rosterId: string;
  studentNumber: number;
  studentName: string;
  signupStatus: SignupStatus;
  autonomousCount: number;
  careerCount: number;
}

export interface StudentEventItem {
  eventId: string;
  category: Category;
  title: string;
  description: string;
  guidance: string;
  eventDate: string;
  phase: EventPhase;
  /** 학생 본인이 작성한 내용. 다른 학생 것은 어떤 경로로도 담기지 않는다. */
  content: string | null;
  updatedAt: number | null;
}

/** 기록이 어디서 왔는지 */
export type ReflectionSource =
  | "none" // 아무 기록도 없음
  | "student" // 학생이 쓴 그대로
  | "teacher" // 학생 기록 없이 교사가 직접 입력
  | "teacher-edited"; // 학생 원문을 교사가 수정

export interface TeacherEventWithResponse {
  eventId: string;
  category: Category;
  title: string;
  description: string;
  eventDate: string;
  status: EventStatus;
  /** 최종적으로 쓸 기록이 있는가 (교사 보완본 포함) */
  hasReflection: boolean;
  /** 최종 기록. 교사 보완본이 있으면 그것, 없으면 학생 원문 */
  reflection: string;
  /** 학생이 직접 쓴 원문. 없으면 빈 문자열 */
  studentOriginal: string;
  source: ReflectionSource;
}
