import { requireAdmin } from "@/lib/auth/server";
import { route } from "@/lib/route-helpers";
import { loadAllClasses, loadAllRoster, loadAllUsers, sortClassSummaries, summarizeClass } from "@/lib/admin/lookup";
import type { RosterDoc } from "@/lib/types";

/** 학급 목록. 담임 계정 연결 상태와 가입 인원까지 함께 내려준다. */
export async function GET(req: Request) {
  return route(async () => {
    await requireAdmin(req);
    const [users, classes, roster] = await Promise.all([
      loadAllUsers(),
      loadAllClasses(),
      loadAllRoster(),
    ]);
    const rosterByClass = new Map<string, RosterDoc[]>();
    for (const r of roster.values()) {
      const list = rosterByClass.get(r.classId) ?? [];
      list.push(r);
      rosterByClass.set(r.classId, list);
    }
    const list = sortClassSummaries(
      Array.from(classes.values()).map((c) => summarizeClass(c, users, rosterByClass.get(c.classId) ?? [])),
    );
    return { classes: list };
  });
}
