import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ─────────────────────────────────────────────────────────────────────────────
// loc-boleto-para-cp — leva o boleto da fatura de Locação para a Conta a Pagar.
//
// O boleto fica em `locacao-faturas`, que é PRIVADO (a Locação abre por URL
// assinada). Já `fin_documentos.arquivo_url` guarda URL pública. Por isso não dá
// para só copiar o caminho: o link quebraria na tela do Financeiro. Aqui o
// arquivo é copiado para `financeiro-docs`, que é o bucket que o Financeiro já
// usa, e registrado em fin_documentos.
//
// Sem isso, quem paga não vê o boleto — foi assim que 21 títulos de água/energia
// ficaram com o favorecido errado sem ninguém perceber: o beneficiário está
// impresso no boleto, mas o boleto não chegava ao Financeiro.
//
// Idempotente: pula CP que já tem documento do mesmo arquivo.
// Sem corpo, processa todas as CPs de locação pendentes (uso retroativo).
// ─────────────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const ORIGEM = "locacao-faturas";
const DESTINO = "financeiro-docs";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let faturaIds: string[] | null = null;
    try {
      const body = await req.json();
      if (Array.isArray(body?.fatura_ids) && body.fatura_ids.length > 0) {
        faturaIds = body.fatura_ids;
      }
    } catch { /* sem corpo = passada retroativa */ }

    // CPs de locação que têm boleto na origem
    let q = supabase
      .from("fin_contas_pagar")
      .select("id, loc_fatura_id, fornecedor_nome, fatura:loc_faturas!loc_fatura_id(id, tipo, competencia, boleto_url)")
      .not("loc_fatura_id", "is", null);
    if (faturaIds) q = q.in("loc_fatura_id", faturaIds);

    const { data: cps, error: cpErr } = await q;
    if (cpErr) throw cpErr;

    const alvos = (cps ?? []).filter((c: any) => c.fatura?.boleto_url);
    const resultados: Array<Record<string, unknown>> = [];
    let copiados = 0, pulados = 0;

    for (const cp of alvos as any[]) {
      const origem: string = cp.fatura.boleto_url;
      // Caminho legado já em http: só referencia, nada a copiar.
      if (/^https?:\/\//.test(origem)) {
        pulados++;
        resultados.push({ cp_id: cp.id, motivo: "url_legada" });
        continue;
      }

      const nomeArquivo = `Boleto ${cp.fatura.tipo} - ${cp.fornecedor_nome}`.slice(0, 90) + ".pdf";

      const { data: jaTem } = await supabase
        .from("fin_documentos")
        .select("id")
        .eq("entity_type", "cp")
        .eq("entity_id", cp.id)
        .eq("tipo", "boleto")
        .limit(1);
      if (jaTem && jaTem.length > 0) {
        pulados++;
        resultados.push({ cp_id: cp.id, motivo: "ja_anexado" });
        continue;
      }

      const { data: blob, error: dlErr } = await supabase.storage.from(ORIGEM).download(origem);
      if (dlErr || !blob) {
        pulados++;
        resultados.push({ cp_id: cp.id, motivo: `download_falhou: ${dlErr?.message ?? "sem arquivo"}` });
        continue;
      }

      const destinoPath = `cp/${cp.id}/boleto-locacao-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from(DESTINO).upload(destinoPath, blob, {
        contentType: blob.type || "application/pdf",
        upsert: false,
      });
      if (upErr) {
        pulados++;
        resultados.push({ cp_id: cp.id, motivo: `upload_falhou: ${upErr.message}` });
        continue;
      }

      const { data: urlData } = supabase.storage.from(DESTINO).getPublicUrl(destinoPath);

      const { error: docErr } = await supabase.from("fin_documentos").insert({
        entity_type: "cp",
        entity_id: cp.id,
        tipo: "boleto",
        nome_arquivo: nomeArquivo,
        arquivo_url: urlData.publicUrl,
        mime_type: blob.type || "application/pdf",
        tamanho_bytes: blob.size ?? null,
      });
      if (docErr) {
        pulados++;
        resultados.push({ cp_id: cp.id, motivo: `registro_falhou: ${docErr.message}` });
        continue;
      }

      copiados++;
      resultados.push({ cp_id: cp.id, arquivo: nomeArquivo });
    }

    return new Response(
      JSON.stringify({ ok: true, analisados: alvos.length, copiados, pulados, resultados }),
      { headers: CORS },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? "erro desconhecido" }),
      { status: 500, headers: CORS },
    );
  }
});
