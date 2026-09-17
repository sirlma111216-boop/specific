import type { EventDoc } from "@/lib/types";

/**
 * 활동이 이 사용자에게 보이는가.
 *
 * 연수용 테스트 활동은 테스트 계정에게만, 실제 활동은 실제 계정에게만 보인다.
 * 두 세계는 서로 섞이지 않는다 — 연수 중 만든 활동이 실제 학생 화면에 뜨거나,
 * 실제 활동이 연수 화면에 섞여 들어오면 안 된다.
 * 활동을 읽는 모든 서버 라우트가 이 함수로 거른다.
 */
export function eventVisibleTo(event: Pick<EventDoc, "isTest">, viewerIsTest: boolean): boolean {
  return Boolean(event.isTest) === viewerIsTest;
}
