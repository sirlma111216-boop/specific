import type { Category } from "@/lib/types";

/**
 * 비정규화 카운터 규칙.
 *
 * 학생 목록·활동 목록에서 반 전체 문서를 훑지 않으려고 개수를 미리 세어 둔다.
 * (Firestore 무료 등급은 하루 읽기 5만 회라, 목록 한 번 띄우는 데 수백 건을 읽으면
 *  여러 학급이 같은 날 작업할 때 한도가 금방 찬다.)
 *
 * 세는 기준은 "이 활동에 쓸 기록이 있는가"다.
 * 학생 원문이든 교사 보완본이든 **하나라도** 있으면 1로 센다.
 */

const COUNT_FIELD: Record<Category, "autonomousCount" | "careerCount"> = {
  autonomous: "autonomousCount",
  career: "careerCount",
};

export function rosterCountField(category: Category): "autonomousCount" | "careerCount" {
  return COUNT_FIELD[category];
}

/**
 * 기록 유무가 바뀌었을 때 카운터에 더할 값.
 * 없다가 생기면 +1, 있다가 사라지면 -1, 그 외에는 0.
 */
export function materialDelta(hadBefore: boolean, hasAfter: boolean): -1 | 0 | 1 {
  if (hadBefore === hasAfter) return 0;
  return hasAfter ? 1 : -1;
}

/** 예전 데이터에는 카운터 필드가 없을 수 있다. 음수로 내려가지 않게 막는다. */
export function safeCount(value: number | undefined): number {
  return Math.max(0, value ?? 0);
}
