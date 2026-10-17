import { describe, expect, it } from "vitest";
import { suggestSchoolEmail } from "@/lib/school";

describe("학교 아이디 뒷부분 오타 잡기", () => {
  // 2026-10 실제 데이터에서 찾은 오타 그대로다. 이 계정들은 가입은 됐지만
  // 학생이 원래 아이디로 로그인하지 못했다.
  it.each([
    "kh.ms.mr",
    "ks.ms.kr",
    "kh.kr.ms",
    "kh.ma.kr",
    "kh.kr",
    "kh.me.kr",
    "kh.ms",
    "kh.ns.kr",
    "kh.ms.jr",
    "kh.comms.kt",
    "lh.ms.kr",
  ])("@%s 는 @kh.ms.kr 로 고치라고 알린다", (domain) => {
    expect(suggestSchoolEmail(`20261211@${domain}`)).toBe("20261211@kh.ms.kr");
  });

  it.each(["kh.ms.kr", "gmail.com", "naver.com", "hanmail.net", "sen.go.kr", "specific.kr"])(
    "@%s 는 그대로 둔다",
    (domain) => {
      expect(suggestSchoolEmail(`20261211@${domain}`)).toBeNull();
    },
  );

  it("대소문자와 앞뒤 공백은 정리해서 본다", () => {
    expect(suggestSchoolEmail("  20261211@KH.MS.MR ")).toBe("20261211@kh.ms.kr");
    expect(suggestSchoolEmail("20261211@KH.MS.KR")).toBeNull();
  });

  it("아직 다 치지 않은 주소에는 반응하지 않는다", () => {
    expect(suggestSchoolEmail("")).toBeNull();
    expect(suggestSchoolEmail("20261211")).toBeNull();
    expect(suggestSchoolEmail("20261211@")).toBeNull();
  });
});
