// GMI Cloud inference — OpenAI-compatible chat completions, JSON out.

export interface LlmConfig {
  apiKey: string;
  model: string;
  baseUrl?: string; // default https://api.gmi-serving.com/v1
  fetchImpl?: typeof fetch;
}

export type LlmCall = (system: string, user: string, opts?: { temperature?: number; model?: string }) => Promise<unknown>;

function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Model did not return JSON");
  }
}

export function createLlm(cfg: LlmConfig): LlmCall {
  const f = cfg.fetchImpl ?? fetch;
  const url = (cfg.baseUrl ?? "https://api.gmi-serving.com/v1").replace(/\/$/, "") + "/chat/completions";

  async function once(system: string, user: string, temperature: number, model: string, jsonMode: boolean): Promise<unknown> {
    const res = await f(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: 2500,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: system + "\nReturn only valid JSON. No markdown, no commentary." },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // Some models reject response_format — retry without it.
      if (jsonMode && res.status === 400 && /response_format/i.test(body)) return once(system, user, temperature, model, false);
      throw new Error(`GMI ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    return extractJson(text);
  }

  return async (system, user, opts = {}) => {
    const model = opts.model ?? cfg.model;
    const t = opts.temperature ?? 0.4;
    try {
      return await once(system, user, t, model, true);
    } catch (e) {
      // One retry, slightly cooler.
      try {
        return await once(system, user, Math.max(0, t - 0.2), model, true);
      } catch {
        throw e;
      }
    }
  };
}
