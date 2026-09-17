"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert, Badge, Card, Spinner } from "@/components/ui/surface";
import { apiFetch, errorMessage } from "@/lib/client/api";
import type { AccountSummary, ClassSummary } from "@/lib/admin/lookup";
import { formatClassFull } from "@/lib/utils";

type Filter = "all" | "teacher" | "student" | "problem";

interface PendingRow {
  rosterId: string;
  studentNumber: number;
  studentName: string;
  signupStatus: string;
}

export default function AdminAccountsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <AccountsInner />
    </Suspense>
  );
}

function AccountsInner() {
  const search = useSearchParams();
  const [accounts, setAccounts] = useState<AccountSummary[] | null>(null);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(() => {
    const f = search.get("filter");
    const r = search.get("role");
    if (f === "problem") return "problem";
    if (r === "teacher" || r === "student") return r;
    return "all";
  });
  const [q, setQ] = useState(search.get("q") ?? "");
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((n) => n + 1);

  // 열려 있는 행 작업 패널
  const [panel, setPanel] = useState<{ uid: string; kind: "password" | "email" | "assign" } | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [a, c] = await Promise.all([
          apiFetch<{ accounts: AccountSummary[] }>("/api/admin/accounts"),
          apiFetch<{ classes: ClassSummary[] }>("/api/admin/classes"),
        ]);
        if (!alive) return;
        setAccounts(a.accounts);
        setClasses(c.classes);
        setError(null);
      } catch (err) {
        if (alive) setError(errorMessage(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [reloadToken]);

  async function run(fn: () => Promise<string | void>) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const msg = await fn();
      if (msg) setNotice(msg);
      setPanel(null);
      reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const needle = q.trim().toLowerCase();
  const rows = (accounts ?? []).filter((a) => {
    if (filter === "teacher" && a.role !== "teacher") return false;
    if (filter === "student" && a.role !== "student") return false;
    if (filter === "problem" && !a.problem) return false;
    if (!needle) return true;
    return [a.email, a.classLabel ?? "", a.teacherName ?? "", a.studentName ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });

  return (
    <main>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] leading-[1.2] text-ink">계정</h1>
          <p className="mt-2 text-[14px] text-muted">
            교사·학생 계정을 만들고, 비밀번호를 바꾸고, 학급이나 명단에 다시 연결합니다.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating((v) => !v)}>
          {creating ? "닫기" : "계정 만들기"}
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {creating && (
        <CreateAccountCard
          classes={classes}
          busy={busy}
          onDone={(msg) => {
            setCreating(false);
            run(async () => msg);
          }}
          onError={setError}
        />
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", "teacher", "student", "problem"] as Filter[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={
              filter === key
                ? "rounded-sm border border-ink bg-ink px-3 py-1.5 text-[14px] text-white"
                : "rounded-sm border border-hairline bg-canvas px-3 py-1.5 text-[14px] text-body"
            }
          >
            {{ all: "전체", teacher: "교사", student: "학생", problem: "어긋난 계정" }[key]}
          </button>
        ))}
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이메일 · 이름 · 학급 검색"
          className="ml-auto h-9 w-full max-w-[280px] text-[13px]"
          aria-label="검색"
        />
      </div>

      {!accounts && !error && <Spinner />}

      {accounts && (
        <div className="overflow-x-auto rounded-md border border-hairline">
          <table className="w-full min-w-[860px] text-[14px]">
            <thead className="bg-surface-soft text-muted">
              <tr>
                <th className="w-16 px-4 py-3 text-left font-medium">역할</th>
                <th className="px-4 py-3 text-left font-medium">이메일</th>
                <th className="px-4 py-3 text-left font-medium">이름 · 소속</th>
                <th className="px-4 py-3 text-left font-medium">상태</th>
                <th className="w-64 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <AccountRow
                  key={a.uid}
                  a={a}
                  classes={classes}
                  panel={panel?.uid === a.uid ? panel.kind : null}
                  onOpen={(kind) => setPanel((p) => (p?.uid === a.uid && p.kind === kind ? null : { uid: a.uid, kind }))}
                  busy={busy}
                  run={run}
                />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted">
                    해당하는 계정이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[13px] text-muted">{rows.length}개 표시</p>
    </main>
  );
}

function AccountRow({
  a,
  classes,
  panel,
  onOpen,
  busy,
  run,
}: {
  a: AccountSummary;
  classes: ClassSummary[];
  panel: "password" | "email" | "assign" | null;
  onOpen: (kind: "password" | "email" | "assign") => void;
  busy: boolean;
  run: (fn: () => Promise<string | void>) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [rosterOptions, setRosterOptions] = useState<PendingRow[] | null>(null);
  const [classPick, setClassPick] = useState("");

  const who =
    a.role === "teacher"
      ? `${a.teacherName ?? ""}${a.classLabel ? ` · ${a.classLabel}` : ""}`
      : a.role === "student"
        ? `${a.studentNumber ? `${a.studentNumber}번 ` : ""}${a.studentName ?? ""}${a.classLabel ? ` · ${a.classLabel}` : ""}`
        : "관리자";

  async function loadRoster(classId: string) {
    setClassPick(classId);
    setRosterOptions(null);
    if (!classId) return;
    const res = await apiFetch<{ roster: PendingRow[] }>(`/api/admin/classes/${classId}`);
    setRosterOptions(res.roster.filter((r) => r.signupStatus !== "linked" || r.rosterId === a.rosterId));
  }

  return (
    <>
      <tr className="border-t border-hairline">
        <td className="px-4 py-3">
          <Badge tone={a.role === "admin" ? "coral" : a.role === "teacher" ? "info" : "neutral"}>
            {{ admin: "관리자", teacher: "교사", student: "학생" }[a.role]}
          </Badge>
        </td>
        <td className="px-4 py-3 text-ink">
          {a.email}
          {a.isTest && <Badge tone="coral" className="ml-2">테스트</Badge>}
        </td>
        <td className="px-4 py-3 text-body">{who}</td>
        <td className="px-4 py-3">{a.problem ? <span className="text-coral">{a.problem}</span> : <span className="text-muted">정상</span>}</td>
        <td className="px-4 py-3 text-right">
          {a.role !== "admin" && (
            <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-[13px]">
              <button type="button" className="text-muted underline underline-offset-2" onClick={() => onOpen("password")}>
                비밀번호
              </button>
              <button type="button" className="text-muted underline underline-offset-2" onClick={() => onOpen("email")}>
                이메일
              </button>
              <button type="button" className="text-muted underline underline-offset-2" onClick={() => onOpen("assign")}>
                {a.role === "teacher" ? "학급 배정" : "명단 연결"}
              </button>
              {a.role === "student" && a.rosterId && (
                <Link href={`/admin/students/${a.rosterId}`} className="text-link underline underline-offset-2">
                  기록
                </Link>
              )}
              <button
                type="button"
                className="text-coral underline underline-offset-2"
                onClick={() => {
                  const lines = [`${a.email} 계정을 삭제합니다.`, ""];
                  if (a.role === "student") lines.push("· 명단 행은 '미가입'으로 돌아가고 소감·기록은 남습니다. 학생은 다시 가입할 수 있습니다.");
                  else lines.push("· 학급과 학생 자료는 남습니다. 다른 교사를 그 학급에 배정할 수 있습니다.");
                  lines.push("· 되돌릴 수 없습니다.", "", "계속할까요?");
                  if (!window.confirm(lines.join("\n"))) return;
                  run(async () => {
                    await apiFetch(`/api/admin/accounts/${a.uid}`, { method: "DELETE" });
                    return `${a.email} 계정을 삭제했습니다.`;
                  });
                }}
              >
                삭제
              </button>
            </div>
          )}
        </td>
      </tr>

      {panel && (
        <tr className="border-t border-hairline bg-surface-soft">
          <td colSpan={5} className="px-4 py-4">
            {panel === "password" && (
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await apiFetch(`/api/admin/accounts/${a.uid}`, { method: "PATCH", body: JSON.stringify({ password: value }) });
                    setValue("");
                    return `${a.email}의 비밀번호를 바꿨습니다. 새 비밀번호를 본인에게 알려주세요.`;
                  });
                }}
              >
                <Field label="새 비밀번호 (6자 이상)" htmlFor={`pw-${a.uid}`}>
                  <Input id={`pw-${a.uid}`} value={value} onChange={(e) => setValue(e.target.value)} className="h-10 w-64" autoComplete="off" />
                </Field>
                <Button type="submit" size="sm" loading={busy} className="mb-4">
                  바꾸기
                </Button>
              </form>
            )}
            {panel === "email" && (
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await apiFetch(`/api/admin/accounts/${a.uid}`, { method: "PATCH", body: JSON.stringify({ email: value }) });
                    setValue("");
                    return "이메일을 바꿨습니다.";
                  });
                }}
              >
                <Field label="새 이메일" htmlFor={`em-${a.uid}`}>
                  <Input id={`em-${a.uid}`} type="email" value={value} onChange={(e) => setValue(e.target.value)} className="h-10 w-72" />
                </Field>
                <Button type="submit" size="sm" loading={busy} className="mb-4">
                  바꾸기
                </Button>
              </form>
            )}
            {panel === "assign" && a.role === "teacher" && (
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await apiFetch(`/api/admin/accounts/${a.uid}`, {
                      method: "PATCH",
                      body: JSON.stringify({ classId: classPick === "" ? null : classPick }),
                    });
                    return classPick ? "학급 담임으로 연결했습니다." : "학급 연결을 풀었습니다.";
                  });
                }}
              >
                <Field label="담임을 맡을 학급" htmlFor={`cls-${a.uid}`} hint="이미 다른 담임이 있는 학급을 고르면 담임이 이 계정으로 바뀝니다.">
                  <Select id={`cls-${a.uid}`} value={classPick} onChange={(e) => setClassPick(e.target.value)} className="h-10 w-72">
                    <option value="">연결 없음</option>
                    {classes.map((c) => (
                      <option key={c.classId} value={c.classId}>
                        {formatClassFull(c.schoolYear, c.grade, c.classNumber)}
                        {c.isTest ? " (테스트)" : ""} — 담임 {c.teacherName}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button type="submit" size="sm" loading={busy} className="mb-4">
                  적용
                </Button>
              </form>
            )}
            {panel === "assign" && a.role === "student" && (
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!value) return;
                  run(async () => {
                    const res = await apiFetch<{ notes: string[] }>(`/api/admin/accounts/${a.uid}`, {
                      method: "PATCH",
                      body: JSON.stringify({ rosterId: value }),
                    });
                    return res.notes.join(" ");
                  });
                }}
              >
                <Field label="학급" htmlFor={`rc-${a.uid}`}>
                  <Select id={`rc-${a.uid}`} value={classPick} onChange={(e) => loadRoster(e.target.value)} className="h-10 w-64">
                    <option value="">학급 선택</option>
                    {classes.map((c) => (
                      <option key={c.classId} value={c.classId}>
                        {formatClassFull(c.schoolYear, c.grade, c.classNumber)}
                        {c.isTest ? " (테스트)" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="명단 행 (미가입만)" htmlFor={`rr-${a.uid}`}>
                  <Select id={`rr-${a.uid}`} value={value} onChange={(e) => setValue(e.target.value)} disabled={!rosterOptions} className="h-10 w-64">
                    <option value="">{rosterOptions ? "학생 선택" : "먼저 학급을 고르세요"}</option>
                    {(rosterOptions ?? []).map((r) => (
                      <option key={r.rosterId} value={r.rosterId}>
                        {r.studentNumber}번 {r.studentName}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button type="submit" size="sm" loading={busy} disabled={!value} className="mb-4">
                  연결
                </Button>
              </form>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function CreateAccountCard({
  classes,
  busy,
  onDone,
  onError,
}: {
  classes: ClassSummary[];
  busy: boolean;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [role, setRole] = useState<"teacher" | "student">("teacher");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [classId, setClassId] = useState("");
  const [rosterId, setRosterId] = useState("");
  const [rosterOptions, setRosterOptions] = useState<PendingRow[] | null>(null);
  const [saving, setSaving] = useState(false);

  async function pickClass(id: string) {
    setClassId(id);
    setRosterId("");
    setRosterOptions(null);
    if (!id || role !== "student") return;
    const res = await apiFetch<{ roster: PendingRow[] }>(`/api/admin/classes/${id}`);
    setRosterOptions(res.roster.filter((r) => r.signupStatus !== "linked"));
  }

  return (
    <Card className="mb-8">
      <h2 className="mb-4 text-[18px] font-medium text-ink">계정 만들기</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            await apiFetch("/api/admin/accounts", {
              method: "POST",
              body: JSON.stringify({
                role,
                email,
                password,
                teacherName: role === "teacher" ? teacherName : undefined,
                classId: role === "teacher" ? classId || null : undefined,
                rosterId: role === "student" ? rosterId : undefined,
              }),
            });
            onDone(`${email} 계정을 만들었습니다. 비밀번호를 본인에게 알려주세요.`);
          } catch (err) {
            onError(errorMessage(err));
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="grid gap-x-4 sm:grid-cols-3">
          <Field label="역할" htmlFor="c-role">
            <Select
              id="c-role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value as "teacher" | "student");
                setRosterOptions(null);
                setRosterId("");
              }}
            >
              <option value="teacher">교사</option>
              <option value="student">학생</option>
            </Select>
          </Field>
          <Field label="이메일" htmlFor="c-email">
            <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="비밀번호 (6자 이상)" htmlFor="c-pw">
            <Input id="c-pw" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" required />
          </Field>
        </div>
        <div className="grid gap-x-4 sm:grid-cols-3">
          {role === "teacher" && (
            <Field label="교사 이름" htmlFor="c-name">
              <Input id="c-name" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} required />
            </Field>
          )}
          <Field label={role === "teacher" ? "담임 학급 (선택)" : "학급"} htmlFor="c-class">
            <Select id="c-class" value={classId} onChange={(e) => pickClass(e.target.value)}>
              <option value="">{role === "teacher" ? "나중에 배정" : "학급 선택"}</option>
              {classes.map((c) => (
                <option key={c.classId} value={c.classId}>
                  {formatClassFull(c.schoolYear, c.grade, c.classNumber)}
                  {c.isTest ? " (테스트)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          {role === "student" && (
            <Field label="명단 행 (미가입만)" htmlFor="c-roster">
              <Select id="c-roster" value={rosterId} onChange={(e) => setRosterId(e.target.value)} disabled={!rosterOptions} required>
                <option value="">{rosterOptions ? "학생 선택" : "먼저 학급을 고르세요"}</option>
                {(rosterOptions ?? []).map((r) => (
                  <option key={r.rosterId} value={r.rosterId}>
                    {r.studentNumber}번 {r.studentName}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <Button type="submit" size="sm" loading={saving || busy}>
          만들기
        </Button>
      </form>
    </Card>
  );
}
