"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { CATEGORY_LABEL, type Category } from "@/lib/types";
import { formatClassFull, formatDateDots } from "@/lib/utils";

interface PrintData {
  klass: { schoolYear: number; grade: string; classNumber: string; teacherName: string };
  student: { studentNumber: number; studentName: string };
  rows: Array<{
    eventId: string;
    category: Category;
    eventDate: string;
    title: string;
    entries: Array<{ label: string; answer: string }>;
    writtenAt: number;
  }>;
  printedAt: number;
}

function stamp(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}. ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * 학생 누가기록 출력. 학교 보관용 근거 자료라 학생이 직접 쓴 내용만 표로 찍는다.
 * 교사 헤더·푸터 없이 종이에 맞춰 그리고, 자료가 오면 바로 인쇄 창을 연다.
 */
export default function StudentPrintPage() {
  const params = useParams<{ rosterId: string }>();
  const { loading, profile } = useAuth();
  const [data, setData] = useState<PrintData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !profile) return;
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<PrintData>(`/api/teacher/students/${params.rosterId}/print`);
        if (!alive) return;
        setData(res);
        // 렌더가 끝난 다음 프레임에 인쇄 창을 연다.
        requestAnimationFrame(() => setTimeout(() => window.print(), 300));
      } catch (err) {
        if (alive) setError(errorMessage(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [loading, profile, params.rosterId]);

  if (!loading && !profile) {
    return <p className="p-8 text-[14px] text-muted">로그인이 필요합니다. 교사 화면에서 다시 열어주세요.</p>;
  }
  if (error) return <p className="p-8 text-[14px] text-coral">{error}</p>;
  if (!data) return <p className="p-8 text-[14px] text-muted">자료를 불러오는 중…</p>;

  const { klass, student, rows } = data;
  const cellCount = rows.reduce((n, r) => n + r.entries.length, 0);

  return (
    <main className="mx-auto max-w-[900px] px-8 py-10 print:max-w-none print:px-0 print:py-0">
      <style>{`
        @page { size: A4; margin: 15mm; }
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
        }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between gap-4 rounded-md bg-surface-soft px-4 py-3 text-[13px] text-muted">
        <span>인쇄 창이 열리지 않으면 오른쪽 버튼을 누르세요. 브라우저 인쇄 설정에서 &quot;배경 그래픽&quot;을 켜면 표가 더 선명합니다.</span>
        <button
          type="button"
          onClick={() => window.print()}
          className="shrink-0 rounded-sm border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-white"
        >
          인쇄
        </button>
      </div>

      <h1 className="text-[22px] font-medium leading-[1.3] text-ink">학생 활동 누가기록</h1>
      <p className="mt-1 text-[12px] text-muted">자율·자치활동 및 진로활동 — 학생 작성 원문</p>

      <table className="mt-5 w-full border-collapse text-[13px]">
        <tbody>
          <tr>
            <th className="w-[110px] border border-[#999] bg-[#f3f4f6] px-3 py-2 text-left font-medium text-ink">학급</th>
            <td className="border border-[#999] px-3 py-2 text-body">
              {formatClassFull(klass.schoolYear, klass.grade, klass.classNumber)}
            </td>
            <th className="w-[110px] border border-[#999] bg-[#f3f4f6] px-3 py-2 text-left font-medium text-ink">담임</th>
            <td className="border border-[#999] px-3 py-2 text-body">{klass.teacherName}</td>
          </tr>
          <tr>
            <th className="border border-[#999] bg-[#f3f4f6] px-3 py-2 text-left font-medium text-ink">번호 · 이름</th>
            <td className="border border-[#999] px-3 py-2 text-body">
              {student.studentNumber}번 {student.studentName}
            </td>
            <th className="border border-[#999] bg-[#f3f4f6] px-3 py-2 text-left font-medium text-ink">출력</th>
            <td className="border border-[#999] px-3 py-2 text-body">{stamp(data.printedAt)}</td>
          </tr>
        </tbody>
      </table>

      {rows.length === 0 ? (
        <p className="mt-8 text-[14px] text-muted">학생이 작성한 기록이 없습니다.</p>
      ) : (
        <table className="mt-6 w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#f3f4f6]">
              <th className="w-[56px] border border-[#999] px-2 py-2 text-left font-medium text-ink">영역</th>
              <th className="w-[96px] border border-[#999] px-2 py-2 text-left font-medium text-ink">일자</th>
              <th className="w-[150px] border border-[#999] px-2 py-2 text-left font-medium text-ink">교육명</th>
              <th className="w-[28%] border border-[#999] px-2 py-2 text-left font-medium text-ink">문항</th>
              <th className="border border-[#999] px-2 py-2 text-left font-medium text-ink">학생 기록</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
              r.entries.map((en, i) => (
                <tr key={`${r.eventId}-${i}`} className="align-top">
                  {i === 0 && (
                    <>
                      <td rowSpan={r.entries.length} className="border border-[#999] px-2 py-2 text-body">
                        {CATEGORY_LABEL[r.category]}
                      </td>
                      <td rowSpan={r.entries.length} className="border border-[#999] px-2 py-2 whitespace-nowrap text-body">
                        {formatDateDots(r.eventDate)}
                      </td>
                      <td rowSpan={r.entries.length} className="prose-ko border border-[#999] px-2 py-2 text-body">
                        {r.title}
                      </td>
                    </>
                  )}
                  <td className="prose-ko border border-[#999] px-2 py-2 text-muted">{en.label}</td>
                  <td className="prose-ko border border-[#999] px-2 py-2 whitespace-pre-wrap text-body">{en.answer}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      )}

      <p className="mt-4 text-[11px] text-muted">
        활동 {rows.length}건 · 기록 {cellCount}항목. 이 문서는 학생이 서비스에 직접 입력한 내용을 그대로 옮긴
        것으로, 교사가 보완한 기록과 특기사항 초안은 포함하지 않습니다.
      </p>
    </main>
  );
}
