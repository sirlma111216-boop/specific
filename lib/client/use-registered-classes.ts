"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import type { RegisteredClass } from "@/lib/roster/registered-classes";

interface Response {
  schoolYear: number;
  classes: RegisteredClass[];
}

export type RegisteredClassesState =
  | { status: "loading"; classes: [] }
  | { status: "ready"; classes: RegisteredClass[] }
  /** 목록을 못 받았을 때. 화면은 직접 입력으로 되돌아가야 한다. */
  | { status: "failed"; classes: [] };

/** 어느 학년도의 결과인지 함께 들고 있어야, 학년도를 바꿨을 때 옛 목록을 보여주지 않는다. */
interface Loaded {
  forYear: string;
  classes: RegisteredClass[] | null; // null = 실패
}

/**
 * 학년도에 등록된 학년·반 목록. 학생 가입 화면과 교사 학급 등록 화면이 같이 쓴다.
 * 학년도 입력이 4자리가 아닐 때는 부르지 않는다.
 * 상태는 응답 콜백에서만 바꾸고, 표시 상태는 렌더 중에 파생한다.
 */
export function useRegisteredClasses(schoolYear: string): RegisteredClassesState {
  const year = schoolYear.trim();
  const valid = /^\d{4}$/.test(year);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    apiFetch<Response>(`/api/auth/registered-classes?schoolYear=${year}`)
      .then((res) => {
        if (alive) setLoaded({ forYear: year, classes: res.classes });
      })
      .catch(() => {
        if (alive) setLoaded({ forYear: year, classes: null });
      });
    return () => {
      alive = false;
    };
  }, [year, valid]);

  if (!valid) return { status: "failed", classes: [] };
  if (!loaded || loaded.forYear !== year) return { status: "loading", classes: [] };
  if (loaded.classes === null) return { status: "failed", classes: [] };
  return { status: "ready", classes: loaded.classes };
}
