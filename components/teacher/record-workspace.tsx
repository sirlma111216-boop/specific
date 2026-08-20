"use client";

import { useMemo, useState } from "react";
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
}: {
  rosterId: string;
  category: Category;
  events: TeacherEventWithResponse[];
  savedRecord?: StudentRecordDoc;
}) {
  // 교사가 기록을 고치면 즉시 반영되도록 목록을 로컬 상태로 들고 있는다.
  const [items, setItems] = useState(events);

  // 체크한 순서를 그대로 보존한다. 해제하면 뒤 순번이 자동으로 당겨진다.
  const [selected, setSelected] = useState<string[]>(savedRecord?.selectedEventIds ?? []);
  const [targetLength, setTargetLength] = useState(
    savedRecord?.targetLength || DEFAULT_TARGET_LENGTH,
  );
  const [mode, setMode] = useState<SelectionMode>(savedRecord?.selectionMode ?? "priority");

  const [editing, setEditing] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [showOriginal, setShowOriginal] = useState<string | null>(null);

  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [draft, setDraft] = useState(savedRecord?.editedText ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPayload, setShowPayload] = useState(false);

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
                    onChange={() => toggle(event.eventId)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#181d26]"
                  />
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={checkboxId}
                      className="flex cursor-pointer flex-wrap items-center gap-2"
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

          <p className="mb-4 text-[13px] text-muted">선택한 활동 {selected.length}개</p>

          <Button
            onClick={generate}
            loading={generating}
            disabled={selected.length === 0 || generating}
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
                disabled={selected.length === 0}
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
