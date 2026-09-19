"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Alert, Card, Spinner } from "@/components/ui/surface";
import {
  StudentPicker,
  type PickedStudent,
  type TreeGrade,
} from "@/components/admin/student-picker";
import { apiFetch, errorMessage } from "@/lib/client/api";
import {
  MAX_ACTIVITY_CONTENT_LENGTH,
  MAX_ACTIVITY_TITLE_LENGTH,
  type PersonalActivityItem,
} from "@/lib/activities/personal";
import { countCharacters, todayInKST } from "@/lib/utils";

interface TreeResponse {
  grades: TreeGrade[];
}

/**
 * 활동 입력 — 도서관 행사·학생회 활동처럼 학급 일정 밖에서 이루어진 활동을
 * 담당 선생님이 학생별로 남기는 화면.
 *
 * 지금까지는 담당 교사가 문서로 정리해 담임에게 보내고 담임이 옮겨 적었다.
 * 그 과정에서 학생이 빠지거나 문구가 달라져 정정이 생겼으므로, 여기서 한 번만 적고
 * 담임은 학생 화면에서 '기록 불러오기'로 가져다 쓴다.
 */
export default function AdminEntriesPage() {
  const [grades, setGrades] = useState<TreeGrade[] | null>(null);
  const [picked, setPicked] = useState<Map<string, PickedStudent>>(new Map());

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [startDate, setStartDate] = useState(todayInKST());
  const [isPeriod, setIsPeriod] = useState(false);
  const [endDate, setEndDate] = useState(todayInKST());

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * 한 명만 고른 상태에서 그 학생의 기록을 보고 고친다.
   * 누구 기록인지 함께 들고 있어야, 학생을 바꿨을 때 이전 학생 것이 잠깐 보이지 않는다.
   */
  const [activities, setActivities] = useState<{
    rosterId: string;
    items: PersonalActivityItem[];
  } | null>(null);
  const [editing, setEditing] = useState<PersonalActivityItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const only = picked.size === 1 ? [...picked.values()][0] : null;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<TreeResponse>("/api/admin/roster-tree");
        if (alive) setGrades(res.grades);
      } catch (err) {
        if (alive) setError(errorMessage(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 한 명만 골랐을 때만 그 학생의 기록을 불러온다. (여러 명일 때는 누구 기록인지 알 수 없다)
  const onlyRosterId = only?.rosterId ?? null;
  useEffect(() => {
    if (!onlyRosterId) return;
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<{ items: PersonalActivityItem[] }>(
          `/api/admin/personal-activities?rosterId=${encodeURIComponent(onlyRosterId)}`,
        );
        if (alive) setActivities({ rosterId: onlyRosterId, items: res.items });
      } catch (err) {
        if (alive) setError(errorMessage(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [onlyRosterId]);

  function toggle(student: PickedStudent, checked: boolean) {
    setNotice(null);
    setPicked((prev) => {
      const next = new Map(prev);
      if (checked) next.set(student.rosterId, student);
      else next.delete(student.rosterId);
      return next;
    });
  }

  async function reloadActivities(rosterId: string) {
    const res = await apiFetch<{ items: PersonalActivityItem[] }>(
      `/api/admin/personal-activities?rosterId=${encodeURIComponent(rosterId)}`,
    );
    setActivities({ rosterId, items: res.items });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch<{ saved: number }>("/api/admin/personal-activities", {
        method: "POST",
        body: JSON.stringify({
          rosterIds: [...picked.keys()],
          title,
          content,
          startDate,
          endDate: isPeriod ? endDate : startDate,
        }),
      });
      setNotice(`${res.saved}명에게 기록을 저장했습니다. 담임 선생님 화면에서 불러올 수 있습니다.`);
      setTitle("");
      setContent("");
      if (only) await reloadActivities(only.rosterId);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusyId(editing.activityId);
    setError(null);
    try {
      await apiFetch(`/api/admin/personal-activities/${editing.activityId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editing.title,
          content: editing.content,
          startDate: editing.startDate,
          endDate: editing.endDate,
        }),
      });
      setEditing(null);
      if (only) await reloadActivities(only.rosterId);
      setNotice("기록을 고쳤습니다.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: PersonalActivityItem) {
    if (!window.confirm(`'${item.title}' 기록을 지울까요?\n되돌릴 수 없습니다.`)) return;
    setBusyId(item.activityId);
    setError(null);
    try {
      await apiFetch(`/api/admin/personal-activities/${item.activityId}`, { method: "DELETE" });
      if (only) await reloadActivities(only.rosterId);
      setNotice("기록을 지웠습니다.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const canSave =
    picked.size > 0 && title.trim().length > 0 && content.trim().length > 0 && Boolean(startDate);
  // 고른 학생이 바뀌면 이전 학생의 목록·편집 칸은 그리지 않는다.
  const list = only && activities?.rosterId === only.rosterId ? activities.items : null;
  const editingHere = editing && list?.some((a) => a.activityId === editing.activityId) ? editing : null;

  return (
    <main>
      <div className="mb-8">
        <h1 className="text-[32px] leading-[1.2] text-ink">활동 입력</h1>
        <p className="prose-ko mt-2 max-w-[720px] text-[14px] text-muted">
          도서관 행사, 학생회 활동처럼 <strong className="text-ink">학급 일정 밖에서</strong> 이루어진
          활동을 학생별로 남깁니다. 왼쪽에서 참여한 학생을 모두 고르고, 오른쪽에 일자·활동명·내용을
          적어 저장하면 담임 선생님이 학생 화면에서 <strong className="text-ink">기록 불러오기</strong>로
          가져다 특기사항에 반영합니다. 특기사항 문장이 아니라 간단한 사실만 적으면 됩니다.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        <Card className="p-5">
          <h2 className="mb-3 text-[18px] font-medium text-ink">학생 고르기</h2>
          {grades === null ? (
            <Spinner />
          ) : (
            <StudentPicker
              grades={grades}
              picked={picked}
              onToggle={toggle}
              onClear={() => setPicked(new Map())}
            />
          )}
        </Card>

        <div>
          <Card className="p-5">
            <h2 className="mb-4 text-[18px] font-medium text-ink">활동 기록</h2>

            <Field label="일자" htmlFor="entry-start">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="entry-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!isPeriod || e.target.value > endDate) setEndDate(e.target.value);
                  }}
                  className="w-auto"
                />
                {isPeriod && (
                  <>
                    <span className="text-[14px] text-muted">~</span>
                    <Input
                      type="date"
                      aria-label="종료일"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-auto"
                    />
                  </>
                )}
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
                  <input
                    type="checkbox"
                    checked={isPeriod}
                    onChange={(e) => {
                      setIsPeriod(e.target.checked);
                      if (e.target.checked && endDate < startDate) setEndDate(startDate);
                    }}
                    className="h-4 w-4 accent-[#181d26]"
                  />
                  기간으로 입력
                </label>
              </div>
            </Field>

            <Field label="활동명" htmlFor="entry-title" hint="예: 도서관 독서골든벨, 학생회 캠페인">
              <Input
                id="entry-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={MAX_ACTIVITY_TITLE_LENGTH}
                placeholder="활동명"
              />
            </Field>

            <Field
              label="활동 내용"
              htmlFor="entry-content"
              hint="무엇을 했는지 사실만 간단히. 문장은 생성할 때 다듬어집니다."
            >
              <Textarea
                id="entry-content"
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={MAX_ACTIVITY_CONTENT_LENGTH}
                placeholder="예: 도서부원으로 매주 목요일 점심시간 도서 대출을 도움"
              />
              <p className="mt-1 text-right text-[13px] text-muted">
                {countCharacters(content)} / {MAX_ACTIVITY_CONTENT_LENGTH}자
              </p>
            </Field>

            <Button onClick={save} loading={saving} disabled={!canSave} className="w-full">
              선택한 {picked.size}명에게 저장
            </Button>
          </Card>

          {only && (
            <Card className="mt-4 p-5">
              <h2 className="mb-1 text-[18px] font-medium text-ink">
                {only.classLabel} {only.studentNumber}번 {only.studentName}의 기록
              </h2>
              <p className="mb-4 text-[13px] text-muted">
                내가 입력한 기록만 고치거나 지울 수 있습니다. 학생을 한 명만 고르면 이 목록이 보입니다.
              </p>

              {list === null ? (
                <Spinner />
              ) : list.length === 0 ? (
                <p className="py-6 text-center text-[14px] text-muted">아직 남긴 기록이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {list.map((a) => {
                    const ed = editingHere?.activityId === a.activityId ? editingHere : null;
                    return ed ? (
                      <div key={a.activityId} className="rounded-md border border-ink p-3">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Input
                            type="date"
                            aria-label="시작일"
                            value={ed.startDate}
                            onChange={(e) =>
                              setEditing({
                                ...ed,
                                startDate: e.target.value,
                                endDate: ed.endDate < e.target.value ? e.target.value : ed.endDate,
                              })
                            }
                            className="h-9 w-auto text-[13px]"
                          />
                          <span className="text-[13px] text-muted">~</span>
                          <Input
                            type="date"
                            aria-label="종료일"
                            value={ed.endDate}
                            min={ed.startDate}
                            onChange={(e) => setEditing({ ...ed, endDate: e.target.value })}
                            className="h-9 w-auto text-[13px]"
                          />
                        </div>
                        <Input
                          aria-label="활동명"
                          value={ed.title}
                          maxLength={MAX_ACTIVITY_TITLE_LENGTH}
                          onChange={(e) => setEditing({ ...ed, title: e.target.value })}
                          className="mb-2 h-9 text-[13px]"
                        />
                        <Textarea
                          aria-label="활동 내용"
                          rows={3}
                          value={ed.content}
                          maxLength={MAX_ACTIVITY_CONTENT_LENGTH}
                          onChange={(e) => setEditing({ ...ed, content: e.target.value })}
                          className="text-[13px]"
                        />
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            loading={busyId === a.activityId}
                            onClick={saveEdit}
                            disabled={!ed.title.trim() || !ed.content.trim()}
                          >
                            저장
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
                            취소
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div key={a.activityId} className="rounded-md border border-hairline p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] text-muted">{a.period}</span>
                          <span className="text-[15px] font-medium text-ink">{a.title}</span>
                          {a.mine && (
                            <span className="ml-auto flex gap-3 text-[13px]">
                              <button
                                type="button"
                                onClick={() => setEditing(a)}
                                className="text-link underline underline-offset-2"
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                disabled={busyId === a.activityId}
                                onClick={() => remove(a)}
                                className="text-coral underline underline-offset-2 disabled:opacity-50"
                              >
                                삭제
                              </button>
                            </span>
                          )}
                        </div>
                        <p className="prose-ko mt-1 text-[14px] text-body">{a.content}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
