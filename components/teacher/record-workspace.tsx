"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Alert, Badge, Card } from "@/components/ui/surface";
import { apiFetch, errorMessage } from "@/lib/client/api";
import {
  DEFAULT_TARGET_LENGTH,
  MAX_REFLECTION_LENGTH,
  MAX_TARGET_LENGTH,
  MIN_TARGET_LENGTH,
} from "@/lib/events/defaults";
import type { GeminiRequestPayload } from "@/lib/gemini/payload-types";
import type {
  Category,
  ReflectionSource,
  SelectionMode,
  StudentRecordDoc,
  TeacherEventWithResponse,
} from "@/lib/types";
import { CATEGORY_FULL_LABEL } from "@/lib/types";
import { cn, countCharacters, formatDateShort } from "@/lib/utils";
import { OfficerEditor } from "@/components/teacher/officer-editor";
import type { OfficerTerm } from "@/lib/roster/officer";
import type { PersonalActivityItem } from "@/lib/activities/personal";

interface GenerateResponse {
  text: string;
  characterCount: number;
  targetLength: number;
  usedEventIds: string[];
  usedEventTitles: string[];
  remainingIssues: Array<{ code: string; message: string }>;
  repairAttempts: number;
  sentToAI: GeminiRequestPayload;
}

/** 1~20은 ①②③…, 그 이상은 (21) 형태로 표시한다. */
export function circledNumber(n: number): string {
  return n >= 1 && n <= 20 ? String.fromCharCode(0x2460 + n - 1) : `(${n})`;
}

const SOURCE_BADGE: Record<ReflectionSource, { label: string; tone: "success" | "muted" | "info" }> =
  {
    student: { label: "학생 기록", tone: "success" },
    "teacher-edited": { label: "교사 수정", tone: "info" },
    teacher: { label: "교사 입력", tone: "info" },
    none: { label: "기록 없음", tone: "muted" },
  };

/** 교사가 기록을 고쳤을 때 화면 상태를 다시 계산한다. */
function applyNote(item: TeacherEventWithResponse, content: string): TeacherEventWithResponse {
  const trimmed = content.trim();
  const reflection = trimmed || item.studentOriginal;
  const source: ReflectionSource = trimmed
    ? item.studentOriginal
      ? "teacher-edited"
      : "teacher"
    : item.studentOriginal
      ? "student"
      : "none";
  return { ...item, reflection, hasReflection: reflection.length > 0, source };
}

export function RecordWorkspace({
  rosterId,
  category,
  events,
  savedRecord,
  officerTerms,
}: {
  rosterId: string;
  category: Category;
  events: TeacherEventWithResponse[];
  savedRecord?: StudentRecordDoc;
  officerTerms: OfficerTerm[];
}) {
  // 교사가 기록을 고치면 즉시 반영되도록 목록을 로컬 상태로 들고 있는다.
  const [items, setItems] = useState(events);

  // 체크한 순서를 그대로 보존한다. 해제하면 뒤 순번이 자동으로 당겨진다.
  // 관리자가 활동을 지웠을 수 있으므로, 지금 남아 있는 활동만 복원한다.
  // (없는 id가 남으면 화면에는 안 보이는데 생성 요청에서 오류가 난다)
  // 저장 뒤에 결석으로 표시한 활동도 체크할 수 없으므로 복원하지 않는다.
  const [selected, setSelected] = useState<string[]>(() => {
    const selectable = new Set(events.filter((e) => !e.absent).map((e) => e.eventId));
    return (savedRecord?.selectedEventIds ?? []).filter((id) => selectable.has(id));
  });
  const [targetLength, setTargetLength] = useState(
    savedRecord?.targetLength || DEFAULT_TARGET_LENGTH,
  );
  const [mode, setMode] = useState<SelectionMode>(savedRecord?.selectionMode ?? "priority");

  const [editing, setEditing] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [showOriginal, setShowOriginal] = useState<string | null>(null);
  const [savingAbsence, setSavingAbsence] = useState<string | null>(null);

  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [draft, setDraft] = useState(savedRecord?.editedText ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPayload, setShowPayload] = useState(false);

  // 담당 교사가 따로 남긴 개인 활동. 화면을 열 때마다 읽지 않고 '기록 불러오기'를 눌렀을 때만 읽는다.
  const [personal, setPersonal] = useState<PersonalActivityItem[] | null>(null);
  const [loadingPersonal, setLoadingPersonal] = useState(false);
  const [selectedPersonal, setSelectedPersonal] = useState<string[]>(
    () => savedRecord?.selectedPersonalIds ?? [],
  );

  const orderOf = useMemo(() => {
    const map = new Map<string, number>();
    selected.forEach((id, i) => map.set(id, i + 1));
    return map;
  }, [selected]);

  function toggle(eventId: string) {
    setSelected((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId],
    );
  }

  function startEditing(item: TeacherEventWithResponse) {
    setEditing(item.eventId);
    setDraftText(item.reflection);
    setError(null);
  }

  async function saveNote(eventId: string) {
    setSavingNote(true);
    setError(null);
    try {
      await apiFetch("/api/teacher/notes", {
        method: "POST",
        body: JSON.stringify({ rosterId, eventId, content: draftText }),
      });
      setItems((prev) =>
        prev.map((it) => (it.eventId === eventId ? applyNote(it, draftText) : it)),
      );
      setEditing(null);
      setDraftText("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingNote(false);
    }
  }

  const loadPersonal = useCallback(async () => {
    setLoadingPersonal(true);
    setError(null);
    try {
      const res = await apiFetch<{ items: PersonalActivityItem[] }>(
        `/api/teacher/personal-activities?rosterId=${encodeURIComponent(rosterId)}`,
      );
      setPersonal(res.items);
      // 지워진 기록이 체크된 채로 남아 생성에서 오류가 나지 않게 한다.
      const alive = new Set(res.items.map((a) => a.activityId));
      setSelectedPersonal((prev) => prev.filter((id) => alive.has(id)));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingPersonal(false);
    }
  }, [rosterId]);

  // 지난번에 체크해 저장해 둔 개인 활동이 있으면, 버튼을 누르지 않아도 그대로 살려 둔다.
  // (체크만 남고 목록이 비어 있으면 담임이 무엇을 골랐는지 알 수 없다)
  const savedPersonalCount = savedRecord?.selectedPersonalIds?.length ?? 0;
  useEffect(() => {
    if (category !== "autonomous" || savedPersonalCount === 0) return;
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<{ items: PersonalActivityItem[] }>(
          `/api/teacher/personal-activities?rosterId=${encodeURIComponent(rosterId)}`,
        );
        if (!alive) return;
        setPersonal(res.items);
        const ids = new Set(res.items.map((a) => a.activityId));
        setSelectedPersonal((prev) => prev.filter((id) => ids.has(id)));
      } catch (err) {
        if (alive) setError(errorMessage(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [category, rosterId, savedPersonalCount]);

  function togglePersonal(activityId: string) {
    setSelectedPersonal((prev) =>
      prev.includes(activityId) ? prev.filter((id) => id !== activityId) : [...prev, activityId],
    );
  }

  async function toggleAbsent(item: TeacherEventWithResponse) {
    const absent = !item.absent;
    setSavingAbsence(item.eventId);
    setError(null);
    try {
      await apiFetch("/api/teacher/absence", {
        method: "POST",
        body: JSON.stringify({ rosterId, eventId: item.eventId, absent }),
      });
      setItems((prev) =>
        prev.map((it) => (it.eventId === item.eventId ? { ...it, absent } : it)),
      );
      // 결석한 활동은 특기사항에 넣지 않는다. 이미 체크돼 있었다면 함께 푼다.
      if (absent) setSelected((prev) => prev.filter((id) => id !== item.eventId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingAbsence(null);
    }
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const selectionOrder: Record<string, number> = {};
      selected.forEach((id, i) => {
        selectionOrder[id] = i + 1;
      });
      const data = await apiFetch<GenerateResponse>("/api/generate-record", {
        method: "POST",
        body: JSON.stringify({
          rosterId,
          category,
          selectedEventIds: selected,
          selectedPersonalIds: selectedPersonal,
          selectionOrder,
          selectionMode: mode,
          targetLength,
        }),
      });
      setResult(data);
      setDraft(data.text);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const selectionOrder: Record<string, number> = {};
      selected.forEach((id, i) => {
        selectionOrder[id] = i + 1;
      });
      await apiFetch("/api/teacher/records", {
        method: "POST",
        body: JSON.stringify({
          rosterId,
          category,
          selectedEventIds: selected,
          selectedPersonalIds: selectedPersonal,
          selectionOrder,
          selectionMode: mode,
          usedEventIds: result?.usedEventIds ?? savedRecord?.usedEventIds ?? [],
          targetLength,
          generatedText: result?.text ?? savedRecord?.generatedText ?? "",
          editedText: draft,
        }),
      });
      setNotice("저장했습니다.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setNotice("복사했습니다.");
    } catch {
      setError("복사에 실패했습니다. 텍스트를 직접 선택해 복사해주세요.");
    }
  }

  const draftCount = countCharacters(draft);
  const filledCount = items.filter((e) => e.hasReflection).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      {/* 활동 목록 */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[20px] text-ink">{CATEGORY_FULL_LABEL[category]}</h2>
          <span className="text-[13px] text-muted">
            전체 {items.length}개 · 기록 있음 {filledCount}개
          </span>
        </div>
        <p className="mb-4 text-[13px] text-muted">
          학생이 쓴 내용을 다듬거나, 기록이 없는 활동에 직접 적을 수 있습니다. 고친 내용은 학생
          화면에 보이지 않고, 학생이 쓴 원문도 그대로 남습니다.
        </p>

        <div className="space-y-2">
          {items.map((event) => {
            const order = orderOf.get(event.eventId);
            const checked = order !== undefined;
            const badge = SOURCE_BADGE[event.source];
            const isEditing = editing === event.eventId;
            const checkboxId = `ev-${event.eventId}`;

            return (
              <div
                key={event.eventId}
                className={cn(
                  "rounded-md border p-4 transition-colors",
                  checked ? "border-ink bg-surface-soft" : "border-hairline bg-canvas",
                )}
              >
                <div className="flex items-start gap-3">
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={checked}
                    disabled={event.absent}
                    onChange={() => toggle(event.eventId)}
                    title={event.absent ? "결석한 활동은 선택할 수 없습니다." : undefined}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#181d26] disabled:cursor-not-allowed disabled:opacity-40"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        htmlFor={checkboxId}
                        className={cn(
                          "flex flex-wrap items-center gap-2",
                          event.absent ? "cursor-not-allowed" : "cursor-pointer",
                        )}
                      >
                        {checked && (
                          <span className="text-[16px] leading-none text-ink">
                            {circledNumber(order)}
                          </span>
                        )}
                        <span className="text-[13px] text-muted">
                          {formatDateShort(event.eventDate)}
                        </span>
                        <span className="text-[15px] font-medium text-ink">{event.title}</span>
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </label>

                      {/* 체크박스 label 밖에 둬야 눌러도 체크가 같이 바뀌지 않는다 */}
                      <button
                        type="button"
                        title={
                          event.absent
                            ? "누르면 결석 표시를 풉니다."
                            : "이 활동에 결석했다면 눌러주세요. 체크할 수 없게 됩니다."
                        }
                        disabled={savingAbsence === event.eventId}
                        onClick={() => toggleAbsent(event)}
                        className="cursor-pointer rounded-sm disabled:cursor-wait disabled:opacity-60"
                      >
                        <Badge tone={event.absent ? "danger" : "muted"}>
                          {event.absent ? "결석" : "결석확인"}
                        </Badge>
                      </button>
                    </div>

                    {isEditing ? (
                      <div className="mt-3">
                        <Textarea
                          rows={5}
                          value={draftText}
                          onChange={(e) => setDraftText(e.target.value)}
                          maxLength={MAX_REFLECTION_LENGTH}
                          placeholder="이 활동에서 관찰한 내용을 적어주세요. 비우고 저장하면 학생이 쓴 원문으로 되돌아갑니다."
                          aria-label={`${event.title} 기록 수정`}
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            loading={savingNote}
                            onClick={() => saveNote(event.eventId)}
                          >
                            기록 저장
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditing(null);
                              setDraftText("");
                            }}
                          >
                            취소
                          </Button>
                          <span className="ml-auto text-[13px] text-muted">
                            {countCharacters(draftText)} / {MAX_REFLECTION_LENGTH}자
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p
                          className={cn(
                            "prose-ko mt-2 text-[14px]",
                            event.hasReflection ? "text-body" : "text-muted",
                          )}
                        >
                          {event.hasReflection ? event.reflection : "기록 없음"}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => startEditing(event)}
                            className="text-[13px] text-link underline underline-offset-2"
                          >
                            {event.hasReflection ? "기록 수정" : "기록 입력"}
                          </button>

                          {event.source === "teacher-edited" && (
                            <button
                              type="button"
                              onClick={() =>
                                setShowOriginal(
                                  showOriginal === event.eventId ? null : event.eventId,
                                )
                              }
                              className="text-[13px] text-muted underline underline-offset-2"
                            >
                              {showOriginal === event.eventId
                                ? "학생 원문 숨기기"
                                : "학생 원문 보기"}
                            </button>
                          )}
                        </div>

                        {showOriginal === event.eventId && (
                          <div className="mt-2 rounded-sm border border-hairline bg-canvas p-3">
                            <p className="mb-1 text-[12px] text-muted">학생이 쓴 원문</p>
                            <p className="prose-ko text-[14px] text-body">
                              {event.studentOriginal}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <Card className="py-12 text-center text-muted">
              등록된 {CATEGORY_FULL_LABEL[category]} 활동이 없습니다.
            </Card>
          )}
        </div>
      </section>

      {/* 생성 패널 */}
      <section className="lg:sticky lg:top-6 lg:self-start">
        {/* 임원 재임·개인 활동은 자치활동이므로 자율 영역에서만 다룬다 */}
        {category === "autonomous" && (
          <>
            <OfficerEditor rosterId={rosterId} initial={officerTerms} />
            <PersonalActivityPicker
              items={personal}
              loading={loadingPersonal}
              selected={selectedPersonal}
              onLoad={loadPersonal}
              onToggle={togglePersonal}
            />
          </>
        )}

        <Card className="p-5">
          <h2 className="mb-5 text-[18px] font-medium text-ink">특기사항 생성</h2>

          <Field label="목표 글자 수" htmlFor={`target-${category}`} hint="공백 포함 문자 수">
            <Input
              id={`target-${category}`}
              inputMode="numeric"
              value={targetLength}
              onChange={(e) => setTargetLength(Number(e.target.value.replace(/\D/g, "")) || 0)}
              min={MIN_TARGET_LENGTH}
              max={MAX_TARGET_LENGTH}
            />
          </Field>

          <fieldset className="mb-5">
            <legend className="mb-2 text-[14px] font-medium text-ink">활동 반영 방식</legend>
            <div className="space-y-2">
              <ModeOption
                name={`mode-${category}`}
                value="priority"
                current={mode}
                onSelect={setMode}
                label="교사가 체크한 순서 우선"
                desc="기록이 있는 활동 → 체크한 순서"
              />
              <ModeOption
                name={`mode-${category}`}
                value="random"
                current={mode}
                onSelect={setMode}
                label="무작위 선택"
                desc="기록이 있는 활동 중에서 먼저 무작위로 고름"
              />
            </div>
          </fieldset>

          <p className="mb-4 text-[13px] text-muted">
            선택한 활동 {selected.length}개
            {selectedPersonal.length > 0 && ` · 개인 활동 ${selectedPersonal.length}건`}
          </p>

          <Button
            onClick={generate}
            loading={generating}
            disabled={(selected.length === 0 && selectedPersonal.length === 0) || generating}
            className="w-full"
          >
            {result ? "다시 생성" : "특기사항 생성"}
          </Button>

          {error && (
            <div className="mt-4">
              <Alert>{error}</Alert>
            </div>
          )}
          {notice && (
            <div className="mt-4">
              <Alert tone="success">{notice}</Alert>
            </div>
          )}
        </Card>

        {(result || draft) && (
          <Card className="mt-4 p-5">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-[16px] font-medium text-ink">생성된 특기사항</h3>
              <span
                className={cn(
                  "text-[13px]",
                  Math.abs(draftCount - targetLength) > targetLength * 0.05
                    ? "text-coral"
                    : "text-muted",
                )}
              >
                {draftCount} / {targetLength}자
              </span>
            </div>

            <Textarea
              rows={12}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="특기사항 편집"
            />

            {result && result.remainingIssues.length > 0 && (
              <div className="mt-4">
                <Alert tone="info">
                  {`자동 검증에서 아직 남은 사항입니다. 확인 후 직접 수정해주세요.\n` +
                    result.remainingIssues.map((i) => `· ${i.message}`).join("\n")}
                </Alert>
              </div>
            )}

            {result && (
              <div className="mt-4">
                <h4 className="mb-2 text-[14px] font-medium text-ink">이번 생성에 반영된 활동</h4>
                <ul className="space-y-1">
                  {result.usedEventTitles.map((title, i) => (
                    <li key={`${title}-${i}`} className="text-[14px] text-body">
                      · {title}
                    </li>
                  ))}
                </ul>
                {result.repairAttempts > 0 && (
                  <p className="mt-2 text-[13px] text-muted">
                    서버 검증 후 {result.repairAttempts}회 수정 생성했습니다.
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="sm" onClick={save} loading={saving} disabled={!draft.trim()}>
                저장
              </Button>
              <Button size="sm" variant="secondary" onClick={copy} disabled={!draft.trim()}>
                복사
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={generate}
                loading={generating}
                disabled={selected.length === 0 && selectedPersonal.length === 0}
              >
                다시 생성
              </Button>
            </div>

            {result && (
              <div className="mt-5 border-t border-hairline pt-4">
                <button
                  type="button"
                  onClick={() => setShowPayload((v) => !v)}
                  className="text-[13px] text-link underline underline-offset-2"
                >
                  {showPayload ? "AI에 보낸 자료 숨기기" : "AI에 실제로 보낸 자료 확인"}
                </button>
                {showPayload && (
                  <>
                    <p className="mt-2 text-[13px] text-muted">
                      학생 이름·이메일·학번·학교·반·교사명은 전송 전에 제거됩니다.
                    </p>
                    <pre className="mt-2 max-h-64 overflow-auto rounded-sm bg-surface-soft p-3 text-[12px] leading-[1.6] text-body">
                      {JSON.stringify(result.sentToAI, null, 2)}
                    </pre>
                  </>
                )}
              </div>
            )}
          </Card>
        )}

        {savedRecord && (
          <p className="mt-3 text-[13px] text-muted">
            마지막 저장: {new Date(savedRecord.updatedAt).toLocaleString("ko-KR")} ·{" "}
            {savedRecord.finalCharacterCount}자
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * 담당 교사가 따로 남긴 개인 활동 불러오기.
 *
 * 도서관 행사·학생회 활동처럼 학급 일정에 없던 활동이다. 담임은 체크만 하고,
 * 기록 자체는 고치지 못한다 — 원본은 활동을 맡은 선생님의 것이고, 담임은 이 기록으로
 * 만들어진 특기사항을 직접 다듬을 책임이 있기 때문이다.
 * 체크한 활동은 임원 다음, 학생이 쓴 활동보다 앞에 들어간다.
 */
function PersonalActivityPicker({
  items,
  loading,
  selected,
  onLoad,
  onToggle,
}: {
  items: PersonalActivityItem[] | null;
  loading: boolean;
  selected: string[];
  onLoad: () => void;
  onToggle: (activityId: string) => void;
}) {
  return (
    <Card className="mb-4 p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[16px] font-medium text-ink">개인 활동 기록</h2>
        {selected.length > 0 && <Badge tone="info">{selected.length}건 선택</Badge>}
      </div>
      <p className="mb-3 text-[13px] leading-[1.6] text-muted">
        도서관·학생회 등 담당 선생님이 이 학생에게 따로 남긴 활동입니다. 체크하면 특기사항에
        들어갑니다.
      </p>

      <Button size="sm" variant="secondary" loading={loading} onClick={onLoad}>
        {items === null ? "기록 불러오기" : "다시 불러오기"}
      </Button>

      {items !== null && (
        <div className="mt-3 space-y-1">
          {items.length === 0 ? (
            <p className="rounded-sm bg-surface-soft px-3 py-2 text-[13px] text-muted">
              따로 기록된 개인 활동이 없습니다.
            </p>
          ) : (
            items.map((a) => {
              const id = `pa-${a.activityId}`;
              return (
                <label
                  key={a.activityId}
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1.5 text-[14px]"
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={selected.includes(a.activityId)}
                    onChange={() => onToggle(a.activityId)}
                    className="h-4 w-4 shrink-0 accent-[#181d26]"
                  />
                  <span className="shrink-0 text-[13px] text-muted">{a.period}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{a.title}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </Card>
  );
}

function ModeOption({
  name,
  value,
  current,
  onSelect,
  label,
  desc,
}: {
  name: string;
  value: SelectionMode;
  current: SelectionMode;
  onSelect: (v: SelectionMode) => void;
  label: string;
  desc: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="radio"
        name={name}
        checked={current === value}
        onChange={() => onSelect(value)}
        className="mt-1 h-4 w-4 shrink-0 accent-[#181d26]"
      />
      <span>
        <span className="block text-[14px] text-ink">{label}</span>
        <span className="block text-[13px] text-muted">{desc}</span>
      </span>
    </label>
  );
}
