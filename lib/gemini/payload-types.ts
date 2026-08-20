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

export type GeminiRequestPayload = NoPersonalInfo<{
  category: Category;
  targetLength: number;
  selectionMode: SelectionMode;
  events: GeminiEventPayload[];
  /**
   * 자치활동 임원 재임 표기. 이미 기재요령 형식으로 완성된 문자열만 넣는다.
   * 예: "1학기 학급회장(2026.03.01.-2026.08.18.)"
   * 학급·학년·전교는 학생을 특정하지 않으므로 그대로 보내도 된다.
   */
  officerTerms: string[];
}>;
