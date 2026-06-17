import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

interface Mov {
  data: string;          // YYYY-MM-DD
  valor: number;         // sempre positivo
  tipo: "entrada" | "saida";
  descricao: string;
  hash: string;
}

function ofxToDate(raw: string): string {
  // YYYYMMDD ou YYYYMMDDHHMMSS[...]
  const y = raw.slice(0, 4);
  const m = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  return `${y}-${m}-${d}`;
}

function getTag(block: string, tag: string): string {
  // OFX 1.x SGML: <TAG>valor    (sem </TAG>)
  // OFX 2.x XML: <TAG>valor</TAG>
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i");
  const m = block.match(re);
  return (m?.[1] ?? "").trim();
}

function parseOFX(text: string): Mov[] {
  const movs: Mov[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>/i)[0];
    const trntype = getTag(block, "TRNTYPE").toUpperCase();
    const dtposted = getTag(block, "DTPOSTED");
    const trnamt = parseFloat(getTag(block, "TRNAMT").replace(",", "."));
    const fitid = getTag(block, "FITID");
    const memo = getTag(block, "MEMO") || getTag(block, "NAME") || trntype;
    if (!dtposted || isNaN(trnamt)) continue;
    const isCredito = trnamt > 0 || trntype === "CREDIT" || trntype === "DEP";
    movs.push({
      data: ofxToDate(dtposted),
      valor: Math.abs(trnamt),
      tipo: isCredito ? "entrada" : "saida",
      descricao: memo.slice(0, 200),
      hash: fitid || `${dtposted}-${trnamt}-${memo.slice(0, 30)}`,
    });
  }
  return movs;
}

function parseCSV(text: string): Mov[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const header = lines[0].toLowerCase().split(sep).map(s => s.trim().replace(/^"|"$/g, ""));
  const idxData = header.findIndex(h => /data|date/i.test(h));
  const idxValor = header.findIndex(h => /valor|amount|value/i.test(h));
  const idxDesc = header.findIndex(h => /descri|histor|memo|name/i.test(h));
  const idxTipo = header.findIndex(h => /tipo|type/i.test(h));
  if (idxData < 0 || idxValor < 0) return [];

  const movs: Mov[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(s => s.trim().replace(/^"|"$/g, ""));
    const rawData = cols[idxData];
    const rawValor = cols[idxValor];
    if (!rawData || !rawValor) continue;

    // Aceita DD/MM/YYYY ou YYYY-MM-DD
    let data = rawData;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawData)) {
      const [d, m, y] = rawData.split("/");
      data = `${y}-${m}-${d}`;
    } else if (/^\d{4}-\d{2}-\d{2}/.test(rawData)) {
      data = rawData.slice(0, 10);
    } else continue;

    const valor = parseFloat(rawValor.replace(/\./g, "").replace(",", "."));
    if (isNaN(valor)) continue;

    const descricao = (idxDesc >= 0 ? cols[idxDesc] : "Lancamento").slice(0, 200);
    const tipoRaw = idxTipo >= 0 ? cols[idxTipo].toUpperCase() : "";
    const isCredito = valor > 0 || tipoRaw === "C" || tipoRaw === "CREDIT" || /entrad/i.test(tipoRaw);

    movs.push({
      data,
      valor: Math.abs(valor),
      tipo: isCredito ? "entrada" : "saida",
      descricao,
      hash: `${data}-${valor}-${descricao.slice(0, 30)}`,
    });
  }
  return movs;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  let importId = "";
  try {
    const body = await req.json();
    importId = body.import_id;
    if (!importId) {
      return new Response(JSON.stringify({ error: "import_id required" }), { status: 400, headers: CORS });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Carrega o registro do import
    const { data: imp, error: impErr } = await supabase
      .from("fin_extratos_import")
      .select("id, conta_id, arquivo_url, formato")
      .eq("id", importId)
      .single();
    if (impErr || !imp) throw new Error(`import nao encontrado: ${impErr?.message}`);

    // 2. Extrai bucket+path do arquivo_url
    //    .../storage/v1/object/public/<bucket>/<path>
    const match = imp.arquivo_url.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)$/);
    if (!match) throw new Error("arquivo_url invalido");
    const bucket = match[1];
    const path = decodeURIComponent(match[2]);

    const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(path);
    if (dlErr || !blob) throw new Error(`download falhou: ${dlErr?.message}`);
    const text = await blob.text();

    // 3. Parse
    const movsParsed = imp.formato === "csv" ? parseCSV(text) : parseOFX(text);
    if (movsParsed.length === 0) {
      await supabase.from("fin_extratos_import").update({
        status: "erro", total_registros: 0, importados: 0, importado_em: new Date().toISOString(),
      }).eq("id", importId);
      return new Response(JSON.stringify({ error: "nenhuma transacao reconhecida", parsed: 0 }), { status: 200, headers: CORS });
    }

    // 4. Dedup vs hashes ja existentes pra mesma conta
    const hashes = movsParsed.map(m => m.hash);
    const { data: existentes } = await supabase
      .from("fin_movimentacoes_tesouraria")
      .select("hash_import")
      .eq("conta_id", imp.conta_id)
      .in("hash_import", hashes);
    const jaExiste = new Set((existentes ?? []).map((e: any) => e.hash_import));
    const novos = movsParsed.filter(m => !jaExiste.has(m.hash));

    // 5. Insert em batch
    const rows = novos.map(m => ({
      conta_id: imp.conta_id,
      tipo: m.tipo,
      valor: m.valor,
      data_movimentacao: m.data,
      descricao: m.descricao,
      categoria: m.tipo === "entrada" ? "recebimento_cliente" : "pagamento_fornecedor",
      conciliado: false,
      origem: "import_ofx",
      hash_import: m.hash,
    }));

    if (rows.length > 0) {
      const { error: insErr } = await supabase.from("fin_movimentacoes_tesouraria").insert(rows);
      if (insErr) throw insErr;
    }

    // 6. Marca import como concluido
    await supabase.from("fin_extratos_import").update({
      status: "concluido",
      total_registros: movsParsed.length,
      importados: rows.length,
      duplicados: movsParsed.length - rows.length,
      importado_em: new Date().toISOString(),
    }).eq("id", importId);

    return new Response(JSON.stringify({
      ok: true,
      total: movsParsed.length,
      importados: rows.length,
      duplicados: movsParsed.length - rows.length,
    }), { headers: CORS });

  } catch (err: any) {
    if (importId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await supabase.from("fin_extratos_import").update({
        status: "erro", importado_em: new Date().toISOString(),
      }).eq("id", importId);
    }
    return new Response(JSON.stringify({ error: err?.message ?? "erro desconhecido" }), { status: 500, headers: CORS });
  }
});
