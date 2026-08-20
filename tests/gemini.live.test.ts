import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateStudentRecord } from "@/lib/record-generator/generate";
import { endsWithNounForm, splitSentences } from "@/lib/record-validator/validate";

/**
 * 실제 Gemini를 호출하는 통합 테스트. 호출마다 비용이 들기 때문에 기본으로는 건너뛴다.
 *   RUN_LIVE_GEMINI=1 npx vitest run tests/gemini.live.test.ts
 */
const enabled = process.env.RUN_LIVE_GEMINI === "1";

/** vitest는 .env.local을 자동으로 읽지 않으므로 직접 읽는다. */
function loadEnvLocal() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // .env.local이 없으면 이미 설정된 환경변수를 쓴다
  }
}
loadEnvLocal();

const EVENTS = [
  {
    eventId: "a",
    title: "학교폭력 예방교육",
    description: "학교폭력의 유형과 신고·대처 방법을 배우는 교육",
    eventDate: "2026-03-12",
    studentReflection:
      "학교폭력이 장난으로 시작될 수도 있다는 내용이 기억에 남았다. 앞으로 친구가 힘들어 보이면 먼저 말을 걸어야겠다고 생각했다.",
    hasStudentReflection: true,
    teacherSelectionOrder: 1,
  },
  {
    eventId: "b",
    title: "생명존중교육",
    description: "생명의 소중함과 주변 사람에 대한 관심을 다루는 교육",
    eventDate: "2026-04-03",
    studentReflection:
      "친구가 힘들어할 때 먼저 말을 걸어주는 것이 중요하다고 생각했다. 작은 관심이 큰 도움이 된다는 걸 알게 되었다.",
    hasStudentReflection: true,
    teacherSelectionOrder: 2,
  },
  {
    eventId: "c",
    title: "심폐소생술 교육",
    description: "응급 상황에서의 심폐소생술 절차를 익히는 교육",
    eventDate: "2026-05-20",
    studentReflection: "",
    hasStudentReflection: false,
    teacherSelectionOrder: 3,
  },
];

describe.skipIf(!enabled)("Gemini 실호출", () => {
  it(
    "자율활동 특기사항을 생기부 문체로 생성한다",
    async () => {
      const result = await generateStudentRecord({
        category: "autonomous",
        targetLength: 400,
        selectionMode: "priority",
        events: EVENTS,
        identifiersToRedact: ["김민서", "한빛중학교", "홍길동"],
      });

      console.log("\n[자율]", result.characterCount, "자\n", result.text, "\n");

      // 요구사항 테스트 12 — 1인칭 제거, 교사 관찰자 문체
      for (const w of ["나는", "내가", "나의", "생각했다", "느꼈다"]) {
        expect(result.text).not.toContain(w);
      }
      for (const s of splitSentences(result.text)) {
        expect(endsWithNounForm(s), `종결어미: ${s}`).toBe(true);
      }

      // 개인정보가 전송되지 않았는지
      const sent = JSON.stringify(result.sanitizedPayload);
      expect(sent).not.toContain("김민서");
      expect(sent).not.toContain("한빛중학교");
      expect(sent).not.toContain("홍길동");

      // 활동명 뒤 날짜 표기 (기재요령 관례)
      expect(result.text).toContain("2026.03.12.");
      expect(result.text).toContain("2026.04.03.");

      // 학생 기록이 있는 활동이 반영되었는지
      expect(result.usedEventIds).toContain("a");
      expect(result.usedEventIds).toContain("b");
      expect(result.text).toMatch(/학교폭력|생명/);

      // 목표 400자 ±20% (실호출은 편차가 있으므로 단위 테스트보다 느슨하게 본다)
      expect(result.characterCount).toBeGreaterThan(320);
      expect(result.characterCount).toBeLessThan(480);
    },
    120_000,
  );

  it(
    "학생 기록이 없는 활동은 일반적 의미까지만 서술한다",
    async () => {
      const result = await generateStudentRecord({
        category: "career",
        targetLength: 200,
        selectionMode: "priority",
        events: [
          {
            eventId: "x",
            title: "진로적성검사",
            description: "흥미와 적성을 알아보는 표준화 검사",
            eventDate: "2026-03-20",
            studentReflection: "",
            hasStudentReflection: false,
            teacherSelectionOrder: 1,
          },
          {
            eventId: "y",
            title: "직업인 초청 특강",
            description: "여러 직업인이 자신의 일과 준비 과정을 소개하는 특강",
            eventDate: "2026-06-11",
            studentReflection: "",
            hasStudentReflection: false,
            teacherSelectionOrder: 2,
          },
        ],
        identifiersToRedact: [],
      });

      console.log("\n[진로]", result.characterCount, "자\n", result.text, "\n");

      // 요구사항 테스트 13 — 확인되지 않은 구체적 성취를 만들지 않는다
      for (const w of ["수상", "최우수", "1위", "대표로", "모범이 됨", "회장"]) {
        expect(result.text).not.toContain(w);
      }
      for (const s of splitSentences(result.text)) {
        expect(endsWithNounForm(s), `종결어미: ${s}`).toBe(true);
      }
    },
    120_000,
  );
});
