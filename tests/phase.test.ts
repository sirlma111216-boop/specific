import { describe, expect, it } from "vitest";
import { canWriteNow, computeEventPhase, emptyRecordText, isPastDue } from "@/lib/events/phase";
import { todayInKST } from "@/lib/utils";

const TODAY = "2026-08-20";
const YESTERDAY = "2026-08-19";
const TOMORROW = "2026-08-21";

describe("활동 상태 계산", () => {
  describe("교사가 따로 손대지 않은 활동(scheduled)", () => {
    it("활동 날짜 이전에는 학생에게 보이지 않는다", () => {
      expect(computeEventPhase("scheduled", TOMORROW, TODAY, false)).toBe("scheduled");
    });

    it("활동 당일에만 작성할 수 있다", () => {
      expect(computeEventPhase("scheduled", TODAY, TODAY, false)).toBe("writable");
    });

    it("날짜가 지나면 마감되어 더 이상 쓸 수 없다", () => {
      expect(computeEventPhase("scheduled", YESTERDAY, TODAY, false)).toBe("closed");
    });

    it("당일에 쓴 기록은 날짜가 지나도 계속 볼 수 있다", () => {
      expect(computeEventPhase("scheduled", YESTERDAY, TODAY, true)).toBe("submitted");
    });
  });

  describe("교사가 직접 제어한 활동", () => {
    it("'지금 공개'하면 날짜 이전에도 쓸 수 있다", () => {
      expect(computeEventPhase("open", TOMORROW, TODAY, false)).toBe("writable");
    });

    it("'다시 열기'하면 날짜가 지났어도 쓸 수 있다", () => {
      expect(computeEventPhase("open", YESTERDAY, TODAY, false)).toBe("writable");
    });

    it("'마감'하면 당일이어도 쓸 수 없다", () => {
      expect(computeEventPhase("closed", TODAY, TODAY, false)).toBe("closed");
    });

    it("마감해도 이미 쓴 기록은 조회된다", () => {
      expect(computeEventPhase("closed", TODAY, TODAY, true)).toBe("submitted");
    });
  });

  describe("자동 마감과 교사 마감 구분", () => {
    it("날짜가 지나 닫힌 경우를 식별한다", () => {
      expect(isPastDue("scheduled", YESTERDAY, TODAY)).toBe(true);
    });

    it("교사가 마감한 경우는 기한 경과가 아니다", () => {
      expect(isPastDue("closed", YESTERDAY, TODAY)).toBe(false);
    });

    it("교사가 다시 연 경우도 기한 경과가 아니다", () => {
      expect(isPastDue("open", YESTERDAY, TODAY)).toBe(false);
    });
  });

  describe("쓰기 가능 판정 (이미 작성했는지와 무관)", () => {
    it("당일에는 쓸 수 있다", () => {
      expect(canWriteNow("scheduled", TODAY, TODAY)).toBe(true);
    });

    it("날짜가 지나면 이미 쓴 학생도 수정할 수 없다", () => {
      // computeEventPhase는 '작성 완료'를 돌려주지만, 쓰기는 막혀야 한다
      expect(computeEventPhase("scheduled", YESTERDAY, TODAY, true)).toBe("submitted");
      expect(canWriteNow("scheduled", YESTERDAY, TODAY)).toBe(false);
    });

    it("교사가 마감하면 이미 쓴 학생도 수정할 수 없다", () => {
      expect(computeEventPhase("closed", TODAY, TODAY, true)).toBe("submitted");
      expect(canWriteNow("closed", TODAY, TODAY)).toBe(false);
    });

    it("활동 날짜 이전에는 쓸 수 없다", () => {
      expect(canWriteNow("scheduled", TOMORROW, TODAY)).toBe(false);
    });

    it("교사가 다시 열면 쓸 수 있다", () => {
      expect(canWriteNow("open", YESTERDAY, TODAY)).toBe(true);
    });
  });

  it("비어 있는 기록 문구가 상태에 맞게 나온다", () => {
    expect(emptyRecordText("closed")).toContain("작성 기간이 지나");
    expect(emptyRecordText("writable")).toContain("아직 작성하지 않았");
  });
});

describe("오늘 날짜(KST)", () => {
  it("UTC 자정 직후에도 한국 날짜로 계산한다", () => {
    // 2026-08-20 00:30 UTC = 한국 시간 09:30 → 같은 날
    expect(todayInKST(new Date("2026-08-20T00:30:00Z"))).toBe("2026-08-20");
  });

  it("UTC로는 전날 밤이어도 한국은 다음 날이다", () => {
    // 2026-08-19 15:30 UTC = 한국 시간 8/20 00:30
    expect(todayInKST(new Date("2026-08-19T15:30:00Z"))).toBe("2026-08-20");
  });
});
