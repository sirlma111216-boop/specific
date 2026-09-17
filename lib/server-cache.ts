import "server-only";

/**
 * 서버 인스턴스 안의 짧은 캐시.
 *
 * Firestore 무료 등급은 하루 읽기 5만 건이다. 2026-09-17 관리자 화면(한 번에 770~1,540건)을
 * 여러 번 여는 것만으로 한도를 다 써 학교 전체가 오후 내내 503을 봤다.
 * 같은 서버 인스턴스에서 잠깐 사이에 반복되는 읽기는 여기서 걸러 Firestore에 가지 않게 한다.
 *
 * Vercel 함수 인스턴스는 요청 사이에 살아 있는 동안만 이 Map 을 공유한다. 인스턴스가 여럿이면
 * 각자 캐시를 갖는다 — 그래서 TTL 을 짧게 두고, 관리자가 무언가를 바꾼 직후에는 지운다.
 */
const store = new Map<string, { expiresAt: number; value: unknown }>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) return hit.value as T;
  const value = await load();
  store.set(key, { expiresAt: now + ttlMs, value });
  return value;
}

/** 키 하나 또는 접두어로 시작하는 키 전부를 지운다. */
export function invalidate(prefix: string): void {
  for (const key of store.keys()) {
    if (key === prefix || key.startsWith(prefix + ":")) store.delete(key);
  }
}

/** 관리자 화면이 쓰는 학급·계정·명단 캐시를 통째로 비운다. 이 세 컬렉션을 바꾸는 곳마다 부른다. */
export function invalidateAdminCache(): void {
  invalidate("admin");
}
