import { describe, expect, it, vi } from "vitest";
import { cached, invalidate } from "@/lib/server-cache";

describe("서버 캐시 (Firestore 읽기 절감)", () => {
  it("TTL 안에서는 로더를 한 번만 부른다", async () => {
    const load = vi.fn(async () => 42);
    const key = `t1-${Math.random()}`;
    expect(await cached(key, 1000, load)).toBe(42);
    expect(await cached(key, 1000, load)).toBe(42);
    expect(await cached(key, 1000, load)).toBe(42);
    // 세 번 호출해도 실제 읽기는 한 번뿐 — 학생 여러 명이 같은 활동 목록을 봐도 Firestore 는 한 번만 읽힌다.
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("TTL 이 지나면 다시 읽는다", async () => {
    const load = vi.fn(async () => 1);
    const key = `t2-${Math.random()}`;
    await cached(key, 0, load);
    await cached(key, 0, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("invalidate 하면 다음 읽기는 새로 가져온다", async () => {
    let n = 0;
    const load = vi.fn(async () => ++n);
    const key = `t3-${Math.random()}`;
    expect(await cached(key, 10_000, load)).toBe(1);
    invalidate(key);
    expect(await cached(key, 10_000, load)).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("접두어로 여러 키를 한 번에 비운다", async () => {
    const load = vi.fn(async () => "x");
    await cached("admin:users", 10_000, load);
    await cached("admin:classes", 10_000, load);
    expect(load).toHaveBeenCalledTimes(2);
    invalidate("admin"); // admin:* 전부
    await cached("admin:users", 10_000, load);
    await cached("admin:classes", 10_000, load);
    expect(load).toHaveBeenCalledTimes(4);
  });

  it("서로 다른 키는 각자 캐시된다", async () => {
    const a = vi.fn(async () => "a");
    const b = vi.fn(async () => "b");
    const ka = `k-${Math.random()}`;
    const kb = `k-${Math.random()}`;
    expect(await cached(ka, 1000, a)).toBe("a");
    expect(await cached(kb, 1000, b)).toBe("b");
    expect(await cached(ka, 1000, a)).toBe("a");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
