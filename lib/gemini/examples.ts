import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 교사가 제공하는 실제 생활기록부 특기사항 예시 파일을 읽는다.
 * 파일이 있으면 그 문체를 프롬프트에 함께 넣고, 일반 규칙과 충돌하면 예시를 우선한다.
 */
/**
 * 앞에 있는 파일이 우선한다.
 * `.local.md`는 .gitignore 대상이라, 실제 학교에서 쓰는 예시를 넣어도
 * 공개 저장소에 올라가지 않는다. 실명이 담긴 예시는 이 파일에 넣을 것.
 */
const CANDIDATE_FILES = [
  "record_examples.local.md",
  "생기부_예시.local.md",
  "record_examples.md",
  "record-examples.md",
  "생기부_예시.md",
  "생기부예시.md",
  "examples.txt",
  "data/record_examples.md",
];

const MAX_CHARS = 6000;

let cached: { text: string; source: string | null } | null = null;

export function loadRecordExamples(): { text: string; source: string | null } {
  if (cached) return cached;
  for (const file of CANDIDATE_FILES) {
    try {
      // 파일명이 여러 후보 중 하나라 경로가 정적으로 정해지지 않는다.
      // 번들러가 프로젝트 전체를 트레이싱하지 않도록 명시적으로 제외한다.
      const path = join(/* turbopackIgnore: true */ process.cwd(), file);
      const raw = readFileSync(path, "utf8").trim();
      if (raw.length > 0) {
        cached = { text: raw.slice(0, MAX_CHARS), source: file };
        return cached;
      }
    } catch {
      // 다음 후보 파일로 넘어간다
    }
  }
  cached = { text: "", source: null };
  return cached;
}

/** 테스트/핫리로드용 */
export function resetExamplesCache() {
  cached = null;
}
