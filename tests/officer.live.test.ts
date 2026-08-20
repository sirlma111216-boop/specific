import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateStudentRecord } from "@/lib/record-generator/generate";
import { endsWithNounForm, splitSentences } from "@/lib/record-validator/validate";

const enabled = process.env.RUN_LIVE_GEMINI === "1";

function loadEnvLocal() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // 이미 설정된 환경변수를 쓴다
  }
}
loadEnvLocal();

const OFFICER = "1학기 학급회장(2026.03.01.-2026.08.18.)";

describe.skipIf(!enabled)("임원 문장 실호출", () => {
  it(
    "임원 표기로 시작하는 특기사항을 만든다",
    async () => {
      const result = await generateStudentRecord({
        category: "autonomous",
        targetLength: 400,
        selectionMode: "priority",
        officerTerms: [OFFICER],
        events: [
          {
            eventId: "a",
            title: "학급임원선거",
            description: "학급 임원을 선출하는 활동",
            eventDate: "2026-08-19",
            studentReflection: "학급이 더 민주적이 되면 좋겠다고 생각했다.",
            hasStudentReflection: true,
            teacherSelectionOrder: 1,
          },
          {
            eventId: "b",
            title: "학교폭력예방교육",
            description: "학교폭력의 유형과 대처 방법",
            eventDate: "2026-08-21",
            studentReflection: "가해자들도 피해자의 입장에서 생각해봤으면 좋겠다.",
            hasStudentReflection: true,
            teacherSelectionOrder: 2,
          },
        ],
        identifiersToRedact: ["김민서"],
      });

      console.log(`\n[임원] ${result.characterCount}자\n${result.text}\n`);

      expect(result.text).toContain(OFFICER);
      // 임원 내용이 맨 앞에 와야 한다
      expect(splitSentences(result.text)[0]).toContain(OFFICER);
      // 활동 날짜 표기도 유지
      expect(result.text).toContain("2026.08.19.");
      for (const s of splitSentences(result.text)) {
        expect(endsWithNounForm(s), `종결어미: ${s}`).toBe(true);
      }
      // 글자 수는 실호출마다 몇 자씩 흔들린다(±5% 경계를 살짝 넘기기도 한다).
      // 그건 앱이 교사에게 안내하는 정상 동작이므로, 여기서는 임원 관련 지적만 없으면 된다.
      expect(result.remainingIssues.map((i) => i.code)).not.toContain("officer_missing");
      expect(result.remainingIssues.map((i) => i.code)).not.toContain("fabricated_detail");
    },
    120_000,
  );

  it(
    "임원이 아니면 임원 이야기를 만들지 않는다",
    async () => {
      const result = await generateStudentRecord({
        category: "autonomous",
        targetLength: 200,
        selectionMode: "priority",
        officerTerms: [],
        events: [
          {
            eventId: "a",
            title: "학급임원선거",
            description: "학급 임원을 선출하는 활동",
            eventDate: "2026-08-19",
            studentReflection: "학급이 더 민주적이 되면 좋겠다고 생각했다.",
            hasStudentReflection: true,
            teacherSelectionOrder: 1,
          },
        ],
        identifiersToRedact: [],
      });

      console.log(`\n[비임원] ${result.characterCount}자\n${result.text}\n`);

      for (const w of ["학급회장", "학급부회장", "회장으로", "부회장으로"]) {
        expect(result.text).not.toContain(w);
      }
    },
    120_000,
  );
});
