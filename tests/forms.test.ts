import { describe, expect, it } from "vitest";
import {
  defaultForm,
  flattenAnswers,
  isSingleFreeText,
  pickKnownAnswers,
  resolveForm,
  validateAnswers,
  validateForm,
  type FormQuestion,
} from "@/lib/forms/schema";

const FORM: FormQuestion[] = [
  { id: "q1", type: "single", label: "가장 인상 깊었던 부분은?", required: true, options: ["사례 영상", "모둠 토의", "강의"] },
  { id: "q2", type: "multiple", label: "새로 알게 된 것을 모두 고르세요", required: false, options: ["신고 방법", "방관자의 역할", "처벌 기준"] },
  { id: "q3", type: "long", label: "앞으로 실천하고 싶은 점", required: true, options: [] },
  { id: "q4", type: "short", label: "한 줄 요약", required: false, options: [] },
];

describe("기본 양식", () => {
  it("질문을 만들지 않으면 자유 서술 한 칸", () => {
    expect(resolveForm(undefined)).toEqual(defaultForm());
    expect(resolveForm([])).toEqual(defaultForm());
    expect(isSingleFreeText(defaultForm())).toBe(true);
  });
});

describe("답변 평문화", () => {
  it("자유 서술 한 칸이면 답변만 그대로 쓴다", () => {
    // 지금까지의 AI 입력과 똑같이 유지되어야 한다
    const text = flattenAnswers(defaultForm(), { reflection: "장난도 폭력이 될 수 있다는 걸 알았다." });
    expect(text).toBe("장난도 폭력이 될 수 있다는 걸 알았다.");
  });

  it("질문이 여러 개면 질문을 함께 붙인다", () => {
    const text = flattenAnswers(FORM, {
      q1: "모둠 토의",
      q2: ["신고 방법", "방관자의 역할"],
      q3: "친구가 힘들어 보이면 먼저 말을 걸겠다.",
      q4: "",
    });
    expect(text).toBe(
      "[가장 인상 깊었던 부분은?] 모둠 토의\n" +
        "[새로 알게 된 것을 모두 고르세요] 신고 방법, 방관자의 역할\n" +
        "[앞으로 실천하고 싶은 점] 친구가 힘들어 보이면 먼저 말을 걸겠다.",
    );
  });

  it("빈 답변은 넣지 않는다", () => {
    const text = flattenAnswers(FORM, { q1: "강의", q2: [], q3: "  ", q4: "" });
    expect(text).toBe("[가장 인상 깊었던 부분은?] 강의");
  });
});

describe("답변 검증", () => {
  it("필수 항목이 비면 잡아낸다", () => {
    const r = validateAnswers(FORM, { q1: "", q3: "" });
    expect(r.ok).toBe(false);
    expect(r.errors.q1).toBeDefined();
    expect(r.errors.q3).toBeDefined();
    expect(r.errors.q2).toBeUndefined();
  });

  it("선택지에 없는 값은 거부한다", () => {
    const r = validateAnswers(FORM, { q1: "없는 항목", q3: "내용" });
    expect(r.errors.q1).toContain("선택할 수 없는");
  });

  it("단일 선택에 여러 개를 보내면 거부한다", () => {
    const r = validateAnswers(FORM, { q1: ["사례 영상", "강의"], q3: "내용" });
    expect(r.errors.q1).toContain("하나만");
  });

  it("정상 응답은 통과", () => {
    const r = validateAnswers(FORM, { q1: "강의", q2: ["신고 방법"], q3: "실천하겠다", q4: "요약" });
    expect(r.ok).toBe(true);
  });

  it("너무 긴 답변은 거부한다", () => {
    const r = validateAnswers(FORM, { q1: "강의", q3: "가".repeat(2001) });
    expect(r.errors.q3).toContain("2000자");
  });
});

describe("답변 정리", () => {
  it("양식에 없는 질문은 버린다", () => {
    const picked = pickKnownAnswers(FORM, { q1: "강의", q3: "내용", 몰래: "심어둔 값" } as never);
    expect(Object.keys(picked).sort()).toEqual(["q1", "q3"]);
  });

  it("객관식에서 허용되지 않은 선택지는 걸러낸다", () => {
    const picked = pickKnownAnswers(FORM, { q2: ["신고 방법", "없는 항목"] });
    expect(picked.q2).toEqual(["신고 방법"]);
  });

  it("단일 선택은 문자열 하나로 정리한다", () => {
    const picked = pickKnownAnswers(FORM, { q1: ["강의", "사례 영상"] });
    expect(picked.q1).toBe("강의");
  });
});

describe("양식 검증", () => {
  it("정상 양식은 통과", () => {
    expect(validateForm(FORM)).toEqual([]);
  });

  it("질문 내용이 비면 잡는다", () => {
    const bad = [{ ...FORM[2], label: "  " }];
    expect(validateForm(bad).join()).toContain("질문 내용");
  });

  it("객관식 선택지가 2개 미만이면 잡는다", () => {
    const bad = [{ ...FORM[0], options: ["하나만"] }];
    expect(validateForm(bad).join()).toContain("2개 이상");
  });

  it("선택지 중복을 잡는다", () => {
    const bad = [{ ...FORM[0], options: ["같음", "같음"] }];
    expect(validateForm(bad).join()).toContain("중복");
  });

  it("질문 id 중복을 잡는다", () => {
    const bad = [FORM[0], { ...FORM[2], id: "q1" }];
    expect(validateForm(bad).join()).toContain("중복");
  });
});
