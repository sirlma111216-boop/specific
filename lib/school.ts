/**
 * 이 앱은 한 학교 안에서만 쓴다. 교사·학생 어느 쪽도 학교명을 입력하지 않는다.
 *
 * 2026-09-16 2학년 6반 담임이 학교명을 "경희여자중학"('교' 빠짐)으로 등록해 그 반
 * 학생 24명이 아무도 가입하지 못한 일이 있었다. 17명의 교사와 400명의 학생이 같은
 * 이름을 한 글자도 틀리지 않고 적어야 하는 구조 자체를 없앴다.
 *
 * 학급 문서(ClassDoc.schoolName)와 대조 키(matchKey)에는 이 값이 그대로 들어가므로
 * 이 상수를 바꾸면 기존 학급과 학생 가입이 어긋난다. 바꿔야 한다면 학급 문서를 함께 옮길 것.
 */
export const SCHOOL_NAME = "경희여자중학교";

/**
 * 담임이 학생 비밀번호를 초기화하면 모두 이 값이 된다.
 * 학생은 이 비밀번호로 들어오자마자 새 비밀번호를 정해야 다른 화면으로 갈 수 있다.
 * 단순한 값을 쓰는 이유: 담임이 학생에게 말로 알려 주기 쉽기 위해서다.
 */
export const STUDENT_RESET_PASSWORD = "Aa123456";

/**
 * 학교에서 학생에게 나눠 준 아이디의 뒷부분.
 *
 * 2026-10 확인 결과 학생 계정 14개가 이 부분을 잘못 친 채 가입돼 있었다
 * (kh.ms.mr, ks.ms.kr, kh.kr.ms, kh.ms 등). 가입은 명단 대조로 통과하지만,
 * 학생은 나중에 원래 아이디로 로그인하지 못하고 관리자도 그 아이디로 찾지 못한다.
 * 개인 메일(gmail·naver 등)로 가입한 학생도 있어 이 주소를 강제하지는 않고,
 * 이 주소를 잘못 친 것으로 보이는 경우만 막는다.
 */
export const SCHOOL_EMAIL_DOMAIN = "kh.ms.kr";

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

/**
 * 학교 아이디의 뒷부분을 잘못 친 것으로 보이면 고친 주소를, 아니면 null 을 돌려준다.
 * 예) "20261211@kh.ms.mr" → "20261211@kh.ms.kr"
 * gmail.com·naver.com 같은 다른 주소는 건드리지 않는다.
 */
export function suggestSchoolEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at <= 0) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!domain || domain === SCHOOL_EMAIL_DOMAIN) return null;

  const looksLikeSchool =
    domain.startsWith("kh.") ||
    domain.endsWith(".ms.kr") ||
    editDistance(domain, SCHOOL_EMAIL_DOMAIN) <= 2;
  return looksLikeSchool ? `${local}@${SCHOOL_EMAIL_DOMAIN}` : null;
}
