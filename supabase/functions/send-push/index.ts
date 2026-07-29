// send-push — Web Push (VAPID) do TEG+ ERP.
//
// Contrato: POST { user_ids: string[], title: string, body?, url?, icon? }
// Le subscriptions de push_subscriptions (user_id, subscription jsonb) e envia
// via npm:web-push (mesma lib da enviar-push do Portal TEG, que roda em escala
// em producao). Substitui a implementacao manual de aes128gcm anterior, que
// gerava o salt do cabecalho fora do HKDF (RFC 8291) — payload indecifravel
// no browser.
//
// Subscriptions expiradas (404/410) sao removidas.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { enforceRateLimit } from "../_shared/rate-limit.ts";

// Chave publica do par VAPID — precisa corresponder a VITE_VAPID_PUBLIC_KEY
// do frontend (ver .env.example: nao regenerar sem atualizar ambos).
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ||
  "BBxTOl-a41Qz4pjvF078WsTWxNmJKKTyLeKB9YWEjmWmDpaEjrpWKUMmn3ZuakkFjjYiZ47wGT0b221GQOrP8Ks";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Rate limiting: 60 req/min por usuario (fallback IP).
  const rl = await enforceRateLimit(req, supabase, { key: "send-push", limit: 60, windowSec: 60 });
  if (!rl.allowed) return rl.response!;

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json", ...CORS, ...rl.headers },
    });

  try {
    const { user_ids, title, body, url, icon } = await req.json();
    if (!user_ids?.length || !title) {
      return json({ error: "user_ids and title required" }, 400);
    }

    const { data: secrets } = await supabase.rpc("get_secret", { secret_name: "VAPID_PRIVATE_KEY" });
    const vapidPrivateKey = secrets?.[0]?.secret;
    if (!vapidPrivateKey) {
      return json({ error: "VAPID_PRIVATE_KEY not configured" }, 500);
    }

    webpush.setVapidDetails("mailto:ti@teguniao.com.br", VAPID_PUBLIC_KEY, vapidPrivateKey);

    const { data: subs, error: subErr } = await supabase
      .from("push_subscriptions")
      .select("user_id, subscription")
      .in("user_id", user_ids);

    if (subErr) throw subErr;
    if (!subs?.length) {
      return json({ sent: 0, message: "No subscriptions found" });
    }

    const payload = JSON.stringify({
      title,
      body: body || "",
      icon: icon || "/icons/icon-192.png",
      url: url || "/",
    });

    let sent = 0;
    let failed = 0;
    const expired: string[] = [];

    await Promise.all(
      subs.map(async (s: { user_id: string; subscription: webpush.PushSubscription }) => {
        try {
          await webpush.sendNotification(s.subscription, payload, { TTL: 86400 });
          sent++;
        } catch (err) {
          failed++;
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) expired.push(s.user_id);
          else console.error("[send-push]", s.user_id, status, (err as Error).message);
        }
      }),
    );

    if (expired.length) {
      await supabase.from("push_subscriptions").delete().in("user_id", expired);
    }

    return json({ sent, failed, total: subs.length, expired: expired.length });
  } catch (err) {
    console.error("[send-push]", err);
    return json({ error: (err as Error).message }, 500);
  }
});
