import "server-only";

import { adminDb, COL } from "@/lib/firebase/admin";
import { cached, invalidate } from "@/lib/server-cache";
import type { EventDoc } from "@/lib/types";

/**
 * 활동(events) 컬렉션 전체.
 *
 * 활동은 학교 전체 공통이라 모든 학생·교사·관리자 화면이 이 목록을 똑같이 읽는다.
 * 캐시가 없으면 학생 한 명이 화면을 열 때마다 활동 문서 수만큼 읽기가 나가고,
 * 400명이 쓰면 그것만으로 무료 한도(하루 5만)를 갉아먹는다.
 *
 * 활동은 관리자만 바꾸므로(등록·수정·복사·삭제) 그때만 캐시를 비우면 된다.
 * 그 사이 최대 TTL 만큼 학생 화면에 새 활동이 늦게 뜰 수 있으나, 수십 초 수준이라
 * 학교 상황에서 문제되지 않는다.
 */
const EVENTS_TTL_MS = 60 * 1000;
const CACHE_KEY = "events:all";

export function loadAllEvents(): Promise<EventDoc[]> {
  return cached(CACHE_KEY, EVENTS_TTL_MS, async () => {
    const snap = await adminDb().collection(COL.events).get();
    return snap.docs.map((d) => d.data() as EventDoc);
  });
}

/** 활동을 바꾼 뒤 부른다. 다음 읽기는 Firestore 에서 새로 가져온다. */
export function invalidateEvents(): void {
  invalidate(CACHE_KEY);
}
