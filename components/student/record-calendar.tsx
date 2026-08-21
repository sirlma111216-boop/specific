"use client";

import { useMemo, useState } from "react";
import { cn, formatDateDots } from "@/lib/utils";
import { CATEGORY_LABEL, type StudentEventItem } from "@/lib/types";
import { Badge } from "@/components/ui/surface";
import { AnswerView } from "@/components/student/answer-view";
import { emptyRecordText } from "@/lib/events/phase";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function ym(date: Date) {
  return { year: date.getFullYear(), month: date.getMonth() };
}

function isoOf(year: number, month: number, day: number) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** 활동이 있었던 날짜에 표시를 하고, 날짜를 누르면 그날 내가 쓴 기록을 보여준다. */
export function RecordCalendar({ items }: { items: StudentEventItem[] }) {
  const latest = items[0]?.eventDate;
  const initial = latest ? new Date(`${latest}T00:00:00`) : new Date();
  const [cursor, setCursor] = useState(() => ym(initial));
  const [selectedDate, setSelectedDate] = useState<string | null>(latest ?? null);

  const byDate = useMemo(() => {
    const map = new Map<string, StudentEventItem[]>();
    for (const item of items) {
      const list = map.get(item.eventDate) ?? [];
      list.push(item);
      map.set(item.eventDate, list);
    }
    return map;
  }, [items]);

  const first = new Date(cursor.year, cursor.month, 1);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const leading = first.getDay();
  const cells: Array<number | null> = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function shift(delta: number) {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor(ym(d));
  }

  const selected = selectedDate ? (byDate.get(selectedDate) ?? []) : [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} className="px-3 py-2 text-[14px] text-muted">
          ← 이전
        </button>
        <span className="text-[16px] font-medium text-ink">
          {cursor.year}년 {cursor.month + 1}월
        </span>
        <button type="button" onClick={() => shift(1)} className="px-3 py-2 text-[14px] text-muted">
          다음 →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-2 text-[12px] text-muted">
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const iso = isoOf(cursor.year, cursor.month, day);
          const dayItems = byDate.get(iso) ?? [];
          const has = dayItems.length > 0;
          const written = dayItems.some((d) => d.phase === "submitted");
          return (
            <button
              key={iso}
              type="button"
              disabled={!has}
              onClick={() => setSelectedDate(iso)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-sm text-[14px]",
                has ? "text-ink" : "text-[#c3c6cb]",
                selectedDate === iso && has ? "bg-surface-strong" : "bg-canvas",
              )}
            >
              {day}
              <span
                className={cn(
                  "mt-1 h-1.5 w-1.5 rounded-full",
                  has ? (written ? "bg-forest" : "bg-coral") : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-6 border-t border-hairline pt-6">
        {selectedDate && selected.length > 0 ? (
          <>
            <h3 className="mb-4 text-[18px] text-ink">{formatDateDots(selectedDate)}</h3>
            <div className="space-y-4">
              {selected.map((item) => (
                <div key={item.eventId} className="rounded-md border border-hairline p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={item.category === "autonomous" ? "info" : "neutral"}>
                      {CATEGORY_LABEL[item.category]}
                    </Badge>
                    <span className="text-[15px] font-medium text-ink">{item.title}</span>
                  </div>
                  <div className="mt-3">
                    <AnswerView
                      form={item.form}
                      answers={item.answers}
                      fallback={item.content}
                      emptyText={emptyRecordText(item.phase)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-[14px] text-muted">
            표시된 날짜를 눌러 그날의 기록을 확인하세요.
          </p>
        )}
      </div>
    </div>
  );
}
