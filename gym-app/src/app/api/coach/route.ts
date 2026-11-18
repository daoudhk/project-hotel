import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

/**
 * Optional server-side language layer for the coach.
 *
 * The deterministic engine (lib/assistant/coach.ts) decides every fact,
 * number and proposed change. This route only rephrases that draft so it
 * reads naturally. It runs on the server so the API key never reaches the
 * browser. Without credentials it returns 501 and the app uses the draft as is.
 */
export const runtime = "nodejs";

const SYSTEM = `You are the voice of a strength and conditioning coach inside a fitness app.
You receive the athlete's question and a DRAFT answer produced by a deterministic training engine.
Rewrite the draft so it reads naturally and briefly (at most 3 short sentences).
Rules: keep every number, exercise name, level and recommendation exactly as in the draft. Do not add facts, numbers, diagnoses or advice that are not in the draft. Keep any statement about uncertainty or estimates. Plain text only.`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }
  let body: { question?: unknown; draft?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const question = typeof body.question === "string" ? body.question.slice(0, 500) : "";
  const draft = typeof body.draft === "string" ? body.draft.slice(0, 2000) : "";
  if (!question || !draft) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: `Question: ${question}\n\nDRAFT: ${draft}` }],
    });
    if (response.stop_reason === "refusal") return NextResponse.json({ text: draft, rephrased: false });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return NextResponse.json({ text: text || draft, rephrased: !!text });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return NextResponse.json({ text: draft, rephrased: false, error: "rate_limited" });
    if (error instanceof Anthropic.APIError) return NextResponse.json({ text: draft, rephrased: false, error: `api_${error.status}` });
    return NextResponse.json({ text: draft, rephrased: false, error: "network" });
  }
}
