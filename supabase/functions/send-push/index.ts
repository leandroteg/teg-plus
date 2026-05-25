import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = "BBxTOl-a41Qz4pjvF078WsTWxNmJKKTyLeKB9YWEjmWmDpaEjrpWKUMmn3ZuakkFjjYiZ47wGT0b221GQOrP8Ks";

// Simple Web Push implementation using crypto APIs
async function importVapidKeys(publicKey: string, privateKey: string) {
  const pubBytes = base64urlToUint8Array(publicKey);
  const privBytes = base64urlToUint8Array(privateKey);

  const cryptoPrivKey = await crypto.subtle.importKey(
    "raw", privBytes, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );

  return { publicKey: pubBytes, privateKey: cryptoPrivKey };
}

function base64urlToUint8Array(base64url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createJWT(vapidKeys: { publicKey: Uint8Array; privateKey: CryptoKey }, audience: string, subject: string) {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  };

  const enc = new TextEncoder();
  const headerB64 = uint8ArrayToBase64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64url(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    vapidKeys.privateKey,
    enc.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format (64 bytes)
  const sigBytes = new Uint8Array(signature);
  let rawSig: Uint8Array;
  if (sigBytes.length === 64) {
    rawSig = sigBytes;
  } else {
    // DER decode
    const r = derIntegerToRaw(sigBytes, 3);
    const sOffset = 3 + sigBytes[3] + 2;
    const s = derIntegerToRaw(sigBytes, sOffset);
    rawSig = new Uint8Array(64);
    rawSig.set(r, 0);
    rawSig.set(s, 32);
  }

  return `${unsignedToken}.${uint8ArrayToBase64url(rawSig)}`;
}

function derIntegerToRaw(der: Uint8Array, offset: number): Uint8Array {
  const len = der[offset + 1];
  const start = offset + 2;
  const bytes = der.slice(start, start + len);
  if (bytes.length === 33 && bytes[0] === 0) return bytes.slice(1);
  if (bytes.length < 32) {
    const padded = new Uint8Array(32);
    padded.set(bytes, 32 - bytes.length);
    return padded;
  }
  return bytes;
}

async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidKeys: { publicKey: Uint8Array; privateKey: CryptoKey },
  vapidSubject: string
) {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const jwt = await createJWT(vapidKeys, audience, vapidSubject);
  const vapidPubB64 = uint8ArrayToBase64url(vapidKeys.publicKey);

  // Generate encryption keys (simplified — using aes128gcm)
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );

  const localPubRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  // Import subscriber's p256dh key
  const subPubBytes = base64urlToUint8Array(subscription.keys.p256dh);
  const subPubKey = await crypto.subtle.importKey(
    "raw", subPubBytes, { name: "ECDH", namedCurve: "P-256" }, false, []
  );

  // Derive shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: subPubKey },
      localKeyPair.privateKey,
      256
    )
  );

  const authSecret = base64urlToUint8Array(subscription.keys.auth);
  const enc = new TextEncoder();

  // HKDF-based key derivation for aes128gcm
  // PRK = HMAC-SHA256(auth_secret, ecdh_secret)
  const hmacKey = await crypto.subtle.importKey(
    "raw", authSecret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, sharedSecret));

  // IKM for final HKDF: HKDF-Expand(PRK, "WebPush: info" || 0x00 || sub_pub || local_pub, 32)
  const infoPrefix = enc.encode("WebPush: info\0");
  const ikm_info = new Uint8Array(infoPrefix.length + subPubBytes.length + localPubRaw.length);
  ikm_info.set(infoPrefix, 0);
  ikm_info.set(subPubBytes, infoPrefix.length);
  ikm_info.set(localPubRaw, infoPrefix.length + subPubBytes.length);

  const prkImport = await crypto.subtle.importKey("raw", prk, "HKDF", false, ["deriveBits"]);
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: ikm_info }, prkImport, 256)
  );

  // Derive CEK and nonce
  const ikmFinal = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);

  const cekInfo = enc.encode("Content-Encoding: aes128gcm\0");
  const cek = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: cekInfo }, ikmFinal, 128)
  );

  const ikmFinal2 = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const nonceInfo = enc.encode("Content-Encoding: nonce\0");
  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: nonceInfo }, ikmFinal2, 96)
  );

  // Encrypt payload with AES-128-GCM
  const payloadBytes = enc.encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 1); // +1 for delimiter
  paddedPayload.set(payloadBytes, 0);
  paddedPayload[payloadBytes.length] = 2; // record delimiter

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPayload)
  );

  // Build aes128gcm header: salt(16) || rs(4) || idlen(1) || keyid(65) || ciphertext
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const rs = 4096;
  const rsBytes = new Uint8Array(4);
  new DataView(rsBytes.buffer).setUint32(0, rs, false);

  const header_block = new Uint8Array(16 + 4 + 1 + localPubRaw.length);
  header_block.set(salt, 0);
  header_block.set(rsBytes, 16);
  header_block[20] = localPubRaw.length;
  header_block.set(localPubRaw, 21);

  const body = new Uint8Array(header_block.length + encrypted.length);
  body.set(header_block, 0);
  body.set(encrypted, header_block.length);

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt}, k=${vapidPubB64}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
    },
    body: body,
  });

  return { status: response.status, ok: response.ok, statusText: response.statusText };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } });
  }

  try {
    const { user_ids, title, body, url, icon } = await req.json();
    if (!user_ids?.length || !title) {
      return new Response(JSON.stringify({ error: "user_ids and title required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Get VAPID private key from vault
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: secrets } = await supabase.rpc("get_secret", { secret_name: "VAPID_PRIVATE_KEY" });
    const vapidPrivateKey = secrets?.[0]?.secret;
    if (!vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "VAPID_PRIVATE_KEY not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const vapidKeys = await importVapidKeys(VAPID_PUBLIC_KEY, vapidPrivateKey);

    // Fetch subscriptions
    const { data: subs, error: subErr } = await supabase
      .from("push_subscriptions")
      .select("user_id, subscription")
      .in("user_id", user_ids);

    if (subErr) throw subErr;
    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0, message: "No subscriptions found" }), { headers: { "Content-Type": "application/json" } });
    }

    const payload = JSON.stringify({
      title,
      body: body || "",
      icon: icon || "/icons/icon-192.png",
      url: url || "/",
    });

    const results = await Promise.allSettled(
      subs.map((s: { user_id: string; subscription: { endpoint: string; keys: { p256dh: string; auth: string } } }) =>
        sendWebPush(s.subscription, payload, vapidKeys, "mailto:noreply@tegplus.com.br")
      )
    );

    const sent = results.filter(r => r.status === "fulfilled" && (r as PromiseFulfilledResult<{ ok: boolean }>).value.ok).length;
    const failed = results.length - sent;

    // Clean up expired subscriptions (410 Gone)
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled" && (r as PromiseFulfilledResult<{ status: number }>).value.status === 410) {
        await supabase.from("push_subscriptions").delete().eq("user_id", subs[i].user_id);
      }
    }

    return new Response(
      JSON.stringify({ sent, failed, total: results.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-push]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
