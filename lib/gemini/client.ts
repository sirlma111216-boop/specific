import "server-only";

/**
 * Gemini 호출은 반드시 서버에서만 일어난다. API Key는 클라이언트로 나가지 않는다.
 *
 * 엔드포인트 선택 근거(gemini-ai-integration 스킬):
 * 이 앱은 학교 내 서버 또는 지역이 고정된 호스팅에서 도는 Next.js 서버 라우트이므로
 * AI Studio 엔드포인트(generativelanguage)를 쓴다. Cloudflare Workers/Pages처럼
 * 아웃바운드 지역을 제어할 수 없는 엣지에 올릴 때는 Vertex AI로 바꿔야 한다.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.6-flash";

export interface GenerateOptions {
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
}

export class GeminiError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
  }
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/** 사용자에게 보여줄 한국어 메시지로 변환. 원인 파악을 위해 상태코드는 남긴다. */
function toKoreanError(status: number, body: string): GeminiError {
  const lower = body.toLowerCase();
  if (status === 400 && lower.includes("user location is not supported")) {
    return new GeminiError(
      "현재 서버 위치에서는 Gemini API를 사용할 수 없습니다. (400 지역 제한) 서버 배포 위치를 바꾸거나 Vertex AI로 전환해야 합니다.",
      502,
    );
  }
  if (status === 429) {
    return new GeminiError(
      "AI 사용량 한도에 걸렸습니다. 잠시 후 다시 시도해주세요. (429)",
      429,
    );
  }
  if (status === 404) {
    return new GeminiError(
      `설정된 AI 모델(${geminiModel()})을 찾을 수 없습니다. GEMINI_MODEL 값을 확인해주세요. (404)`,
      502,
    );
  }
  if (status === 403) {
    return new GeminiError("AI API 키 권한이 없습니다. GEMINI_API_KEY를 확인해주세요. (403)", 502);
  }
  return new GeminiError(`AI 생성에 실패했습니다. (HTTP ${status}) ${body.slice(0, 200)}`, 502);
}

export async function generateText(options: GenerateOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiError(
      "GEMINI_API_KEY가 설정되지 않았습니다. .env.local을 확인해주세요.",
      500,
    );
  }
  const model = geminiModel();

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: options.systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: options.userPrompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.85,
      maxOutputTokens: options.maxOutputTokens ?? 4096,
      // Gemini 3 계열은 thinking 모델이라 출력 토큰을 사고에 먼저 쓴다.
      ...(model.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
    },
  };

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new GeminiError(
      `AI 서버에 연결하지 못했습니다. 네트워크를 확인해주세요. (${err instanceof Error ? err.message : String(err)})`,
    );
  }

  const raw = await res.text();
  if (!res.ok) throw toKoreanError(res.status, raw);

  let parsed: GeminiResponse;
  try {
    parsed = JSON.parse(raw) as GeminiResponse;
  } catch {
    throw new GeminiError("AI 응답을 해석할 수 없습니다.");
  }

  if (parsed.promptFeedback?.blockReason) {
    throw new GeminiError(
      `AI가 요청을 거부했습니다. (${parsed.promptFeedback.blockReason}) 활동 설명이나 학생 기록에 부적절한 내용이 없는지 확인해주세요.`,
    );
  }

  const candidate = parsed.candidates?.[0];
  // thought:true 파트는 사고 과정이므로 결과에서 제외한다.
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => p.thought !== true && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("")
    .trim();

  if (!text) {
    if (candidate?.finishReason === "MAX_TOKENS") {
      throw new GeminiError("AI 응답이 길이 제한에 걸렸습니다. 목표 글자 수를 줄이고 다시 시도해주세요.");
    }
    throw new GeminiError(
      `AI가 빈 응답을 반환했습니다. 다시 시도해주세요. (finishReason: ${candidate?.finishReason ?? "unknown"})`,
    );
  }
  return text;
}
