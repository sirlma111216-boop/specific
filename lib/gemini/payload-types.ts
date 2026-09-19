import type { Category, SelectionMode } from "@/lib/types";

/**
 * Gemini로 나가는 payload에 절대 존재해서는 안 되는 키.
 * 타입 단계에서 막아서, 실수로 필드를 추가하면 컴파일이 깨지도록 한다.
 */
export type ForbiddenPersonalKey =
  | "name"
  | "studentName"
  | "studentNameNorm"
  | "email"
  | "uid"
  | "studentId"
  | "studentUid"
  | "studentNumber"
  | "rosterId"
  | "classId"
  | "teacherId"
  | "teacherName"
  | "schoolName"
  | "grade"
  | "classNumber";

type NoPersonalInfo<T> = T & { [K in ForbiddenPersonalKey]?: never };

/** 활동 1건. 학생을 특정할 수 있는 정보는 어떤 필드에도 담지 않는다. */
export type GeminiEventPayload = NoPersonalInfo<{
  title: string;
  description: string;
  eventDate: string;
  studentReflection: string;
  hasStudentReflection: boolean;
  teacherSelectionOrder: number;
}>;

/**
 * 자치활동 임원 1건.
 * term 은 이미 기재요령 형식으로 완성된 문자열이라 학생을 특정하지 않는다.
 * leadership 은 담임이 적은 한 줄 근거 메모이며, 결과에 그대로 옮기지 않고 다시 쓴다.
 */
export type GeminiOfficerPayload = NoPersonalInfo<{
  term: string;
  leadership: string;
}>;

/** 담당 교사가 따로 남긴 개인 활동 1건 (도서관 행사·학생회 활동 등) */
export type GeminiPersonalActivityPayload = NoPersonalInfo<{
  title: string;
  /** 기재요령 표기. 하루면 "2026.03.05.", 기간이면 "2026.03.05.-2026.03.07." */
  activityDate: string;
  content: string;
}>;

export type GeminiRequestPayload = NoPersonalInfo<{
  category: Category;
  targetLength: number;
  selectionMode: SelectionMode;
  events: GeminiEventPayload[];
  officerTerms: GeminiOfficerPayload[];
  /** 담임이 '기록 불러오기'로 가져와 체크한 개인 활동. 교사가 확인한 사실이다. */
  personalActivities: GeminiPersonalActivityPayload[];
}>;
