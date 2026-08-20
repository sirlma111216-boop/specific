"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Alert, Spinner } from "@/components/ui/surface";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { MAX_REFLECTION_LENGTH, REFLECTION_PLACEHOLDER } from "@/lib/events/defaults";
import { CATEGORY_FULL_LABEL, type StudentEventItem } from "@/lib/types";
import { countCharacters, formatDateDots } from "@/lib/utils";

interface TodayResponse {
  today: string;
  pending: StudentEventItem[];
}

/**
 * 오늘 작성할 활동을 하나씩 순서대로 보여준다.
 * 여러 개면 저장 후 '다음 활동 작성하기'로 이어지고, 모두 끝나면 지난 기록으로 이동한다.
 */
export default function StudentTodayPage() {
  const router = useRouter();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [index, setIndex] = useState(0);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedStep, setSavedStep] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<TodayResponse>("/api/student/today");
        if (!alive) return;
        setData(res);
        if (res.pending.length === 0) router.replace("/student/records");
      } catch (err) {
        if (alive) setError(errorMessage(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  const total = data.pending.length;
  const event = data.pending[index];
  if (!event) return <Spinner />;

  const isToday = event.eventDate === data.today;
  const charCount = countCharacters(content);

  async function save() {
    if (!content.trim()) {
      setError("내용을 입력해주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/student/responses", {
        method: "POST",
        body: JSON.stringify({ eventId: event.eventId, content }),
      });
      setSavedStep(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (index + 1 < total) {
      setIndex(index + 1);
      setContent("");
      setSavedStep(false);
      setError(null);
      window.scrollTo({ top: 0 });
    } else {
      router.replace("/student/records");
    }
  }

  return (
    <main>
      {total > 1 && (
        <p className="mb-4 text-[14px] font-medium text-muted">
          {isToday ? "오늘 " : ""}작성할 활동 {index + 1} / {total}
        </p>
      )}

      <h1 className="text-[26px] leading-[1.3] text-ink">{event.title}</h1>
      <p className="mt-2 text-[14px] text-muted">
        {CATEGORY_FULL_LABEL[event.category]} · {formatDateDots(event.eventDate)}
      </p>

      {event.description && (
        <p className="prose-ko mt-5 rounded-md bg-surface-soft px-4 py-3 text-[14px] text-body">
          {event.description}
        </p>
      )}

      <p className="prose-ko mt-4 rounded-md bg-cream px-4 py-3 text-[14px] text-ink">
        {event.guidance}
      </p>

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      {savedStep ? (
        <div className="mt-8">
          <Alert tone="success">기록을 저장했습니다.</Alert>
          <Button onClick={next} className="mt-4 w-full">
            {index + 1 < total ? "다음 활동 작성하기" : "내 기록 보기"}
          </Button>
        </div>
      ) : (
        <div className="mt-6">
          <Textarea
            rows={12}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={REFLECTION_PLACEHOLDER}
            maxLength={MAX_REFLECTION_LENGTH}
            aria-label="활동 소감"
            className="text-[16px]"
          />
          <p className="mt-2 text-right text-[13px] text-muted">
            {charCount} / {MAX_REFLECTION_LENGTH}자
          </p>
          <Button onClick={save} loading={saving} className="mt-4 w-full">
            기록 저장하기
          </Button>
        </div>
      )}
    </main>
  );
}
