import { describe, expect, it } from "vitest";
import { materialDelta, rosterCountField, safeCount } from "@/lib/events/counters";

describe("기록 수 카운터", () => {
  describe("증감 계산", () => {
    it("없다가 생기면 +1", () => {
      expect(materialDelta(false, true)).toBe(1);
    });

    it("있다가 사라지면 -1", () => {
      expect(materialDelta(true, false)).toBe(-1);
    });

    it("이미 있는데 또 저장하면 그대로", () => {
      // 학생이 같은 날 소감을 고쳐 다시 저장하는 경우
      expect(materialDelta(true, true)).toBe(0);
    });

    it("없던 것을 비우면 그대로", () => {
      expect(materialDelta(false, false)).toBe(0);
    });
  });

  describe("실제 시나리오", () => {
    it("학생이 쓴 뒤 교사가 수정해도 1건으로 유지된다", () => {
      // 학생 작성: 없음 → 있음
      expect(materialDelta(false, true)).toBe(1);
      // 교사 수정: 학생 원문이 이미 있으므로 변화 없음
      expect(materialDelta(true, true)).toBe(0);
    });

    it("교사가 먼저 입력한 뒤 지우면 0으로 돌아온다", () => {
      expect(materialDelta(false, true)).toBe(1);
      // 학생 원문이 없으므로 교사 기록을 지우면 기록 없음
      expect(materialDelta(true, false)).toBe(-1);
    });

    it("학생 원문이 있으면 교사 기록을 지워도 줄지 않는다", () => {
      // hadBefore = 원문 or 교사기록 = true, hasAfter = 원문만 = true
      expect(materialDelta(true, true)).toBe(0);
    });
  });

  describe("영역별 필드", () => {
    it("영역에 맞는 필드명을 준다", () => {
      expect(rosterCountField("autonomous")).toBe("autonomousCount");
      expect(rosterCountField("career")).toBe("careerCount");
    });
  });

  describe("예전 데이터 호환", () => {
    it("필드가 없으면 0으로 본다", () => {
      expect(safeCount(undefined)).toBe(0);
    });

    it("음수로 내려가지 않는다", () => {
      expect(safeCount(-3)).toBe(0);
    });

    it("정상 값은 그대로", () => {
      expect(safeCount(7)).toBe(7);
    });
  });
});
