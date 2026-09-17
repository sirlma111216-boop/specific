import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * 요청 하나가 Firestore 를 몇 번 읽었는지 센다.
 *
 * Firebase 콘솔 사용량 탭은 몇 시간씩 지연되고 할당량 기간 단위로 뭉쳐 보여서,
 * "지금 이 화면이 읽기를 몇 번 쓰는지"를 확인하기 어렵다. 그래서 요청 단위로 직접 세어
 * 응답 헤더(x-fs-reads)로 돌려준다. 개발자 도구 네트워크 탭에서 화면마다 실제 비용을 볼 수 있다.
 *
 * 큰 읽기(컬렉션 전체·명단·응답 묶음·인증 문서)에만 addReads 를 심는다. 단건 읽기는 1씩이라
 * 굳이 세지 않아도 화면당 총량 판단에는 지장이 없다. 이 계량기는 읽기를 추가로 발생시키지 않는다.
 */
interface Meter {
  n: number;
}

const store = new AsyncLocalStorage<Meter>();

export function runWithReadMeter<T>(fn: (meter: Meter) => T): T {
  const meter: Meter = { n: 0 };
  return store.run(meter, () => fn(meter));
}

/** 이번 요청의 읽기 수에 n 을 더한다. 요청 밖(스크립트 등)에서는 무시된다. */
export function addReads(n: number): void {
  const meter = store.getStore();
  if (meter) meter.n += n;
}
