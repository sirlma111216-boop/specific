import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildRepairPrompt, buildSystemInstruction, buildUserPrompt } from "@/lib/gemini/prompt";
import type { GeminiRequestPayload } from "@/lib/gemini/payload-types";

const PAYLOAD: GeminiRequestPayload = {
  category: "autonomous",
  targetLength: 500,
  selectionMode: "priority",
  events: [
    {
      title: "인권교육",
      description: "",
      eventDate: "2026.10.13.",
      studentReflection: "놀 권리에 대해 알게 됨",
      hasStudentReflection: true,
      teacherSelectionOrder: 1,
    },
  ],
  officerTerms: [],
  personalActivities: [],
};

/*
 * 생성 결과가 활동마다 줄이 띄워져 나온 일이 있었다.
 * 원인: 문체 예시가 활동마다 빈 줄로 나뉘어 있었고, 예시를 일반 규칙보다 우선하라고 시켰다.
 * 아래 테스트는 '한 문단' 지시가 모든 요청에 빠짐없이 들어가는지 지킨다.
 */
describe("한 문단으로 쓰라는 지시", () => {
  it("시스템 지시에 들어 있다", () => {
    expect(buildSystemInstruction("autonomous", "")).toContain("줄바꿈 없이 한 문단");
  });

  it("예시를 넣을 때 줄 나눔은 예시를 따르지 않는다고 못 박는다", () => {
    const withExamples = buildSystemInstruction("autonomous", "가에 참여함.\n\n나에 참여함.");
    expect(withExamples).toContain("줄 나눔은 예외");
  });

  it("생성 요청의 마지막 줄에 다시 들어 있다", () => {
    const lines = buildUserPrompt(PAYLOAD).split("\n");
    expect(lines.at(-1)).toContain("줄바꿈 없이 한 문단");
  });

  it("수정 요청에도 들어 있다", () => {
    const prompt = buildRepairPrompt(PAYLOAD, "가에 참여함.\n\n나에 참여함.", "글자 수를 맞춰라.");
    expect(prompt.split("\n").at(-1)).toContain("줄바꿈 없이 한 문단");
  });
});

describe("기본 문체 예시 파일", () => {
  // 예시가 활동마다 빈 줄로 나뉘어 있으면 모델이 그 모양을 따라 한다.
  it("한 학생의 특기사항은 빈 줄 없이 한 문단이다", () => {
    const text = readFileSync("record_examples.md", "utf8");
    const sections = text.split(/^## /m).slice(1);
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      const body = section.split("\n").slice(1).join("\n").trim();
      expect(body).not.toMatch(/\n\s*\n/);
    }
  });
});
