import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireTeacherWithClass } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import {
  isCompleteOfficerTerm,
  MAX_OFFICER_TERMS,
  type OfficerRole,
  type OfficerScope,
  type OfficerTerm,
  type OfficerTermPeriod,
} from "@/lib/roster/officer";
import { isValidIsoDate } from "@/lib/utils";
import type { RosterDoc } from "@/lib/types";

interface Body {
  rosterId?: string;
  officerTerms?: Array<Partial<OfficerTerm>>;
}

const PERIODS: OfficerTermPeriod[] = ["first", "second", "year"];
const SCOPES: OfficerScope[] = ["class", "school"];
const ROLES: OfficerRole[] = ["president", "vicePresident"];

/**
 * 학생의 자치활동 임원 재임 이력을 저장한다.
 * 빈 배열을 보내면 지운다. 이 정보는 자율·자치활동 특기사항 첫 문장에 쓰인다.
 */
export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireTeacherWithClass(req);
    const body = await readJson<Body>(req);
    const rosterId = (body.rosterId ?? "").trim();
    if (!rosterId) throw badRequest("학생을 선택해주세요.");

    const raw = Array.isArray(body.officerTerms) ? body.officerTerms : [];
    if (raw.length > MAX_OFFICER_TERMS) {
      throw badRequest(`임원 이력은 최대 ${MAX_OFFICER_TERMS}건까지 입력할 수 있습니다.`);
    }

    // 덜 채워진 줄은 저장하지 않고 조용히 버린다. (입력 중인 빈 줄이 흔하다)
    const terms: OfficerTerm[] = [];
    for (const t of raw) {
      if (!isCompleteOfficerTerm(t)) continue;
      if (!PERIODS.includes(t.period)) throw badRequest("임기 구분 값이 올바르지 않습니다.");
      if (!SCOPES.includes(t.scope)) throw badRequest("임원 구분 값이 올바르지 않습니다.");
      if (!ROLES.includes(t.role)) throw badRequest("직책 값이 올바르지 않습니다.");
      if (!isValidIsoDate(t.startDate) || !isValidIsoDate(t.endDate)) {
        throw badRequest("재임 기간 날짜를 올바르게 입력해주세요.");
      }
      if (t.startDate > t.endDate) {
        throw badRequest("재임 시작일이 종료일보다 늦습니다.");
      }
      terms.push({
        period: t.period,
        scope: t.scope,
        role: t.role,
        startDate: t.startDate,
        endDate: t.endDate,
      });
    }

    const db = adminDb();
    const ref = db.collection(COL.roster).doc(rosterId);
    const snap = await ref.get();
    if (!snap.exists) throw notFound("학생을 찾을 수 없습니다.");
    if ((snap.data() as RosterDoc).classId !== ctx.classId) {
      throw notFound("학생을 찾을 수 없습니다.");
    }

    await ref.update({ officerTerms: terms });
    return { officerTerms: terms };
  });
}
