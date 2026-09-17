"use client";

import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Category } from "@/lib/types";

/**
 * 활동 기본 정보 입력. 등록과 편집이 같은 칸을 쓴다.
 *
 * 영역 선택지에 '테스트'를 자율/진로와 나란히 둔다. 테스트 활동도 특기사항 생성까지
 * 시연하려면 자율인지 진로인지는 정해져야 하므로, 저장은 category + isTest 두 값으로 한다.
 */
export interface EventBasics {
  category: Category;
  isTest: boolean;
  title: string;
  eventDate: string;
  description: string;
  guidance: string;
}

type Kind = "autonomous" | "career" | "test-autonomous" | "test-career";

const KIND_LABEL: Record<Kind, string> = {
  autonomous: "자율",
  career: "진로",
  "test-autonomous": "테스트 (자율) — 테스트 계정에게만 보임",
  "test-career": "테스트 (진로) — 테스트 계정에게만 보임",
};

function toKind(b: Pick<EventBasics, "category" | "isTest">): Kind {
  return b.isTest ? (`test-${b.category}` as Kind) : b.category;
}

function fromKind(kind: Kind): Pick<EventBasics, "category" | "isTest"> {
  const isTest = kind.startsWith("test-");
  const category = (isTest ? kind.slice(5) : kind) as Category;
  return { category, isTest };
}

export function EventBasicsForm({
  value,
  onChange,
  idPrefix,
  showGuidance = true,
}: {
  value: EventBasics;
  onChange: (next: EventBasics) => void;
  /** 한 화면에 여러 폼이 있을 때 id 충돌을 막는다 */
  idPrefix: string;
  showGuidance?: boolean;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <>
      <div className="grid gap-x-4 sm:grid-cols-3">
        <Field label="활동 영역" htmlFor={id("kind")}>
          <Select
            id={id("kind")}
            value={toKind(value)}
            onChange={(e) => onChange({ ...value, ...fromKind(e.target.value as Kind) })}
          >
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="활동명" htmlFor={id("title")} hint="예: 학교폭력 예방교육">
          <Input
            id={id("title")}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            required
          />
        </Field>
        <Field label="활동 날짜" htmlFor={id("date")}>
          <Input
            id={id("date")}
            type="date"
            value={value.eventDate}
            onChange={(e) => onChange({ ...value, eventDate: e.target.value })}
            required
          />
        </Field>
      </div>
      <Field
        label="활동 설명"
        htmlFor={id("description")}
        hint="학생이 어떤 교육이었는지 알 수 있도록 간단히 적어주세요."
      >
        <Textarea
          id={id("description")}
          rows={3}
          value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
        />
      </Field>
      {showGuidance && (
        <Field label="학생 안내문" htmlFor={id("guidance")} hint="필요하면 수정할 수 있습니다.">
          <Textarea
            id={id("guidance")}
            rows={4}
            value={value.guidance}
            onChange={(e) => onChange({ ...value, guidance: e.target.value })}
          />
        </Field>
      )}
    </>
  );
}
