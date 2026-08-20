"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Alert, Badge, Card } from "@/components/ui/surface";
import { errorMessage } from "@/lib/client/api";
import { clientAuth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

export interface RosterRow {
  studentNumber: string;
  studentName: string;
}

interface PreviewResult {
  students: Array<{ studentNumber: number; studentName: string }>;
  errors: string[];
  scannedRows: number;
}

export function emptyRows(count: number): RosterRow[] {
  return Array.from({ length: count }, (_, i) => ({
    studentNumber: String(i + 1),
    studentName: "",
  }));
}

/**
 * 학생 명단 입력. 직접 입력과 엑셀 업로드 두 방식을 제공한다.
 * 엑셀은 업로드 즉시 저장하지 않고 미리보기를 먼저 보여준다.
 */
export function RosterEditor({
  rows,
  onChange,
}: {
  rows: RosterRow[];
  onChange: (rows: RosterRow[]) => void;
}) {
  const [mode, setMode] = useState<"manual" | "excel">("manual");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function updateRow(index: number, patch: Partial<RosterRow>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const nextNumber =
      rows.reduce((max, r) => Math.max(max, Number(r.studentNumber) || 0), 0) + 1;
    onChange([...rows, { studentNumber: String(nextNumber), studentName: "" }]);
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  async function downloadTemplate() {
    setUploadError(null);
    try {
      const user = clientAuth().currentUser;
      const token = user ? await user.getIdToken() : "";
      const res = await fetch("/api/teacher/roster/template", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("견본 파일을 내려받지 못했습니다.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "학생명단_견본.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setUploadError(errorMessage(err));
    }
  }

  async function onFileSelected(file: File) {
    setBusy(true);
    setUploadError(null);
    setPreview(null);
    try {
      const user = clientAuth().currentUser;
      const token = user ? await user.getIdToken() : "";
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/teacher/roster/preview", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body,
      });
      const data = (await res.json()) as PreviewResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "파일을 읽지 못했습니다.");
      setPreview(data);
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function applyPreview() {
    if (!preview) return;
    onChange(
      preview.students.map((s) => ({
        studentNumber: String(s.studentNumber),
        studentName: s.studentName,
      })),
    );
    setPreview(null);
    setMode("manual");
  }

  const filled = rows.filter((r) => r.studentName.trim() !== "").length;

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <TabButton active={mode === "manual"} onClick={() => setMode("manual")}>
          직접 입력
        </TabButton>
        <TabButton active={mode === "excel"} onClick={() => setMode("excel")}>
          엑셀 파일 업로드
        </TabButton>
        <span className="ml-auto text-[13px] text-muted">입력된 학생 {filled}명</span>
      </div>

      {uploadError && <Alert>{uploadError}</Alert>}

      {mode === "excel" && (
        <Card className="mb-6">
          <p className="prose-ko mb-4 text-[14px] text-body">
            견본 파일을 내려받아 학생 이름을 입력한 뒤 다시 올려주세요. 업로드하면 바로 저장되지
            않고 먼저 미리보기를 보여드립니다.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={downloadTemplate}>
              학생 명단 엑셀 견본 다운로드
            </Button>
            <Button
              type="button"
              size="sm"
              loading={busy}
              onClick={() => fileRef.current?.click()}
            >
              엑셀 파일 선택 (.xlsx)
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFileSelected(file);
              }}
            />
          </div>

          {preview && (
            <div className="mt-6 border-t border-hairline pt-6">
              {preview.errors.length > 0 && (
                <Alert>{preview.errors.slice(0, 12).join("\n")}</Alert>
              )}
              <h3 className="mb-3 text-[18px] font-medium text-ink">
                등록 예정 학생 {preview.students.length}명
              </h3>
              {preview.students.length > 0 && (
                <div className="max-h-64 overflow-y-auto rounded-md border border-hairline">
                  <table className="w-full text-[14px]">
                    <thead className="sticky top-0 bg-surface-soft text-muted">
                      <tr>
                        <th className="w-20 px-4 py-2 text-left font-medium">번호</th>
                        <th className="px-4 py-2 text-left font-medium">이름</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.students.map((s) => (
                        <tr key={s.studentNumber} className="border-t border-hairline">
                          <td className="px-4 py-2 text-muted">{s.studentNumber}</td>
                          <td className="px-4 py-2 text-ink">{s.studentName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4 flex gap-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={applyPreview}
                  disabled={preview.students.length === 0}
                >
                  등록하기
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setPreview(null)}>
                  취소
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="overflow-hidden rounded-md border border-hairline">
        <table className="w-full text-[14px]">
          <thead className="bg-surface-soft text-muted">
            <tr>
              <th className="w-24 px-4 py-3 text-left font-medium">번호</th>
              <th className="px-4 py-3 text-left font-medium">이름</th>
              <th className="w-16 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-hairline">
                <td className="px-3 py-2">
                  <Input
                    inputMode="numeric"
                    value={row.studentNumber}
                    onChange={(e) => updateRow(i, { studentNumber: e.target.value })}
                    className="h-10"
                    aria-label={`${i + 1}번째 줄 번호`}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={row.studentName}
                    onChange={(e) => updateRow(i, { studentName: e.target.value })}
                    className="h-10"
                    aria-label={`${i + 1}번째 줄 이름`}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-[13px] text-muted"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-muted">
                  등록된 학생이 없습니다. 행을 추가하거나 엑셀을 올려주세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={addRow}>
          행 추가
        </Button>
        <Badge tone="muted">빈 줄은 저장 시 자동으로 무시됩니다</Badge>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-sm border px-3 py-2 text-[14px]",
        active ? "border-ink bg-ink text-white" : "border-hairline bg-canvas text-body",
      )}
    >
      {children}
    </button>
  );
}
