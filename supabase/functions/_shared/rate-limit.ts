import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

interface RateLimitOptions {
  key: string;        // nome logico da funcao, ex: "parse-extrato"
  limit: number;      // maximo de requisicoes na janela
  windowSec: number;  // tamanho da janela em segundos
}

// Extrai o user_id do JWT (sem verificar assinatura — so identificacao para o bucket).
// Cai para o IP quando nao ha token utilizavel.
function requesterId(req: Request): string {
  const auth = req.headers.get("authorization");
  const token = auth?.replace(/^Bearer\s+/i, "");
  if (token) {
    const parts = token.split(".");
    if (parts.length === 3) {
      try {
        const pad = "=".repeat((4 - (parts[1].length % 4)) % 4);
        const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/") + pad);
        const sub = JSON.parse(json)?.sub;
        if (sub) return `user:${sub}`;
      } catch { /* token nao-JWT: usa IP */ }
    }
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("cf-connecting-ip")
    || "unknown";
  return `ip:${ip}`;
}

export interface RateLimitResult {
  allowed: boolean;
  response?: Response;   // resposta 429 pronta quando allowed=false
  headers: Record<string, string>; // X-RateLimit-* para anexar na resposta de sucesso
}

// enforceRateLimit: consulta o limiter em Postgres e devolve o veredito.
// Fail-open: se o RPC falhar, permite a requisicao (nao derruba o servico por erro do limiter).
export async function enforceRateLimit(
  req: Request,
  supabase: SupabaseClient,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const bucket = `${opts.key}:${requesterId(req)}`;

  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_bucket: bucket,
    p_limit: opts.limit,
    p_window_s: opts.windowSec,
  });

  if (error) {
    console.error("[rate-limit] RPC falhou, permitindo (fail-open):", error.message);
    return { allowed: true, headers: {} };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const remaining = row?.remaining ?? 0;
  const retryAfter = row?.retry_after_s ?? opts.windowSec;

  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(opts.limit),
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
  };

  if (row?.allowed) {
    return { allowed: true, headers };
  }

  const response = new Response(
    JSON.stringify({
      error: "Rate limit excedido. Tente novamente em breve.",
      retry_after_s: retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        ...headers,
      },
    },
  );

  return { allowed: false, response, headers };
}
