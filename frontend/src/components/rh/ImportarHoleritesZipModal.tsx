// ─────────────────────────────────────────────────────────────────────────────
// ImportarHoleritesZipModal.tsx — Import em batch de holerites via ZIP.
//
// Convencao de nome (boa pratica - TOTVS RM, ADP, Folhamatic geram nativo):
//   {matricula_ou_cpf}_{YYYYMM}[_{tipo}].pdf
// Tipos suportados: 13|13o (=13o), ferias, rescisao, adiantamento.
// Sem tipo no nome = mensal.
//
// Manifest opcional (manifest.csv dentro do ZIP) com precedencia sobre o nome:
//   arquivo;identificador;competencia;tipo;valor_liquido;observacao
//
// Fluxo: descompacta no browser (jszip) -> resolve colaborador por matricula
// /fallback CPF -> preview com erros em vermelho -> upload paralelo (5 concorrentes)
// usando a mesma RPC/storage do upload individual.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { Upload, FileText, CheckCircle2, AlertTriangle, X, Loader2 } from 'lucide-react'
import { useUploadHolerite, type TipoHolerite } from '../../hooks/useHolerites'
import { useRHColaboradores } from '../../hooks/useRH'

type Status = 'ok' | 'erro'

interface Linha {
  arquivo: string                   // nome no zip
  file: File | null                 // PDF bin
  matricula?: string                // o que veio antes do "_"
  identificador: string             // matricula ou cpf normalizado usado pra match
  competencia?: string              // YYYY-MM-01
  tipo: TipoHolerite
  valor_liquido?: number
  observacao?: string
  colaborador_id?: string
  colaborador_nome?: string
  status: Status
  motivo?: string
}

const TIPO_LABEL: Record<TipoHolerite, string> = {
  mensal: 'Mensal',
  '13o': '13º',
  ferias: 'Férias',
  rescisao: 'Rescisão',
  adiantamento: 'Adiantamento',
}

function inferirTipoFromNome(seg: string | undefined): TipoHolerite {
  const s = (seg ?? '').toLowerCase().replace(/[\.\-_]/g, '')
  if (s === '13' || s === '13o' || s.includes('decimo') || s.includes('decimoterceiro')) return '13o'
  if (s.includes('feria')) return 'ferias'
  if (s.includes('rescis')) return 'rescisao'
  if (s.includes('adiant')) return 'adiantamento'
  return 'mensal'
}

// "202605" / "2026-05" / "052026" -> "2026-05-01"
function parseCompetencia(s: string | undefined): string | undefined {
  if (!s) return undefined
  const onlyDigits = s.replace(/\D/g, '')
  if (onlyDigits.length === 6) {
    // tenta YYYYMM, fallback MMYYYY
    const a = onlyDigits.slice(0, 4)
    const b = onlyDigits.slice(4, 6)
    if (Number(a) > 1900 && Number(b) >= 1 && Number(b) <= 12) return `${a}-${b}-01`
    const c = onlyDigits.slice(2, 6)
    const d = onlyDigits.slice(0, 2)
    if (Number(c) > 1900 && Number(d) >= 1 && Number(d) <= 12) return `${c}-${d}-01`
  }
  return undefined
}

function normalizeCpf(s: string) {
  return s.replace(/\D/g, '')
}

interface Props {
  isLight: boolean
  onClose: () => void
}

export default function ImportarHoleritesZipModal({ isLight, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: colabs = [] } = useRHColaboradores()
  const upload = useUploadHolerite()
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [parsing, setParsing] = useState(false)
  const [importando, setImportando] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })
  const [resultado, setResultado] = useState<{ enviados: number; falhas: number } | null>(null)

  // Index colaboradores por matricula (lower) e cpf (so digitos)
  const idx = useMemo(() => {
    const byMat = new Map<string, typeof colabs[number]>()
    const byCpf = new Map<string, typeof colabs[number]>()
    for (const c of colabs) {
      if (c.matricula) byMat.set(String(c.matricula).toLowerCase(), c)
      if (c.cpf) byCpf.set(normalizeCpf(c.cpf), c)
    }
    return { byMat, byCpf }
  }, [colabs])

  function resolveColaborador(identificador: string): { id?: string; nome?: string; motivo?: string } {
    const idLower = identificador.toLowerCase()
    const cpf = normalizeCpf(identificador)
    const byMat = idx.byMat.get(idLower)
    if (byMat) return { id: byMat.id, nome: byMat.nome }
    const byCpfMatch = idx.byCpf.get(cpf)
    if (byCpfMatch) return { id: byCpfMatch.id, nome: byCpfMatch.nome }
    return { motivo: 'colaborador não encontrado (matrícula/CPF)' }
  }

  function parseLinhaFromNome(arquivo: string, file: File): Linha {
    const semExt = arquivo.replace(/\.[^.]+$/, '')
    const parts = semExt.split('_')
    const identificador = parts[0] ?? ''
    const competencia = parseCompetencia(parts[1])
    const tipo = inferirTipoFromNome(parts[2])
    const matchColab = resolveColaborador(identificador)
    if (!identificador) return { arquivo, file, identificador, tipo: 'mensal', status: 'erro', motivo: 'nome de arquivo vazio' }
    if (!competencia) return { arquivo, file, identificador, tipo, status: 'erro', motivo: 'competência inválida (use YYYYMM ou YYYY-MM no nome)' }
    if (!matchColab.id) return { arquivo, file, identificador, competencia, tipo, status: 'erro', motivo: matchColab.motivo }
    return {
      arquivo, file, identificador, competencia, tipo,
      colaborador_id: matchColab.id, colaborador_nome: matchColab.nome,
      status: 'ok',
    }
  }

  // Le manifest.csv simples (separador ; ou ,)
  function parseManifest(text: string): Map<string, Partial<Linha>> {
    const map = new Map<string, Partial<Linha>>()
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return map
    const sep = lines[0].includes(';') ? ';' : ','
    const header = lines[0].split(sep).map(h => h.trim().toLowerCase())
    const iArq = header.indexOf('arquivo')
    const iId = header.indexOf('identificador')
    const iComp = header.indexOf('competencia')
    const iTipo = header.indexOf('tipo')
    const iVal = header.indexOf('valor_liquido')
    const iObs = header.indexOf('observacao')
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''))
      const arquivo = iArq >= 0 ? cols[iArq] : ''
      if (!arquivo) continue
      const m: Partial<Linha> = {}
      if (iId >= 0 && cols[iId]) m.identificador = cols[iId]
      if (iComp >= 0 && cols[iComp]) m.competencia = parseCompetencia(cols[iComp]) ?? cols[iComp]
      if (iTipo >= 0 && cols[iTipo]) {
        const t = cols[iTipo].toLowerCase()
        if (['mensal', '13o', 'ferias', 'rescisao', 'adiantamento'].includes(t)) m.tipo = t as TipoHolerite
      }
      if (iVal >= 0 && cols[iVal]) {
        const v = Number(cols[iVal].replace(/\./g, '').replace(',', '.'))
        if (!isNaN(v)) m.valor_liquido = v
      }
      if (iObs >= 0 && cols[iObs]) m.observacao = cols[iObs]
      map.set(arquivo, m)
    }
    return map
  }

  async function handleFile(file: File | null) {
    if (!file) return
    setParsing(true)
    setResultado(null)
    setLinhas([])
    try {
      const zip = await JSZip.loadAsync(file)
      const entries = Object.values(zip.files).filter(e => !e.dir)

      // 1. manifest?
      const manifestEntry = entries.find(e => /(^|\/)manifest\.csv$/i.test(e.name))
      let manifest = new Map<string, Partial<Linha>>()
      if (manifestEntry) {
        const text = await manifestEntry.async('string')
        manifest = parseManifest(text)
      }

      // 2. PDFs
      const pdfs = entries.filter(e => /\.pdf$/i.test(e.name))
      const novas: Linha[] = []
      for (const e of pdfs) {
        const blob = await e.async('blob')
        const justName = e.name.split('/').pop() || e.name
        const f = new File([blob], justName, { type: 'application/pdf' })
        const base = parseLinhaFromNome(justName, f)
        // Sobrepoe com manifest se houver
        const override = manifest.get(justName) || manifest.get(e.name)
        if (override) {
          if (override.identificador) {
            const res = resolveColaborador(override.identificador)
            base.identificador = override.identificador
            base.colaborador_id = res.id
            base.colaborador_nome = res.nome
            base.status = res.id ? 'ok' : 'erro'
            base.motivo = res.id ? undefined : res.motivo
          }
          if (override.competencia) base.competencia = override.competencia
          if (override.tipo) base.tipo = override.tipo
          if (override.valor_liquido != null) base.valor_liquido = override.valor_liquido
          if (override.observacao) base.observacao = override.observacao
        }
        novas.push(base)
      }
      setLinhas(novas)
    } catch (e: any) {
      alert(`Erro ao ler o ZIP: ${e?.message ?? 'desconhecido'}`)
    } finally {
      setParsing(false)
    }
  }

  async function handleImportar() {
    const validas = linhas.filter(l => l.status === 'ok' && l.file && l.competencia && l.colaborador_id)
    if (validas.length === 0) return
    setImportando(true)
    setProgress({ done: 0, total: validas.length })
    let enviados = 0
    let falhas = 0
    const CONCURRENCY = 5
    let i = 0
    async function worker() {
      while (i < validas.length) {
        const idx = i++
        const l = validas[idx]
        try {
          await upload.mutateAsync({
            colaboradorId: l.colaborador_id!,
            competencia: l.competencia!,
            tipo: l.tipo,
            file: l.file!,
            valorLiquido: l.valor_liquido,
            observacao: l.observacao,
          })
          enviados++
        } catch {
          falhas++
        }
        setProgress({ done: enviados + falhas, total: validas.length })
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, validas.length) }, () => worker()))
    setImportando(false)
    setResultado({ enviados, falhas })
  }

  const bg = isLight ? 'bg-white' : 'bg-[#0f172a]'
  const border = isLight ? 'border-slate-200' : 'border-white/[0.06]'
  const txtMain = isLight ? 'text-slate-800' : 'text-slate-100'
  const txtMuted = isLight ? 'text-slate-500' : 'text-slate-400'

  const okCount = linhas.filter(l => l.status === 'ok').length
  const errCount = linhas.filter(l => l.status === 'erro').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`${bg} rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${border}`}>
          <div>
            <h3 className={`text-sm font-bold ${txtMain}`}>Importar holerites em lote (ZIP)</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Nome esperado: <code>matricula_YYYYMM[_tipo].pdf</code> · ex: <code>1234_202605.pdf</code>, <code>1234_202605_ferias.pdf</code>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {!resultado && (
            <div className={`rounded-xl p-3 ${isLight ? 'bg-indigo-50 border border-indigo-200 text-indigo-700' : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300'}`}>
              <p className="text-[11px] leading-relaxed">
                <strong>Convenção:</strong> 1 PDF por holerite, nomeado <code>matricula_YYYYMM.pdf</code> (mensal),
                <code>_13</code> pra 13º, <code>_ferias</code>, <code>_rescisao</code>, <code>_adiantamento</code>. CPF (só dígitos) também é aceito como identificador.
                Pode incluir <code>manifest.csv</code> no ZIP com colunas <code>arquivo;identificador;competencia;tipo;valor_liquido;observacao</code> pra metadados extras.
              </p>
            </div>
          )}

          {linhas.length === 0 && !parsing && !resultado && (
            <div className={`rounded-xl border-2 border-dashed p-12 text-center ${isLight ? 'border-slate-200' : 'border-white/[0.08]'}`}>
              <Upload size={32} className="mx-auto text-slate-400 mb-3" />
              <p className={`text-sm font-semibold ${txtMain}`}>Selecione o arquivo ZIP</p>
              <p className={`text-xs mt-1 ${txtMuted}`}>O sistema vai descompactar e fazer match com os colaboradores</p>
              <input
                ref={fileRef}
                type="file"
                accept=".zip"
                onChange={e => handleFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold"
              >
                <Upload size={14} /> Selecionar .zip
              </button>
            </div>
          )}

          {parsing && (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin text-indigo-500" />
              <span className="ml-3 text-sm text-slate-400">Descompactando e analisando...</span>
            </div>
          )}

          {linhas.length > 0 && !resultado && (
            <>
              <div className="flex items-center gap-3 text-xs">
                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full font-semibold ${isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/15 text-emerald-300'}`}>
                  <CheckCircle2 size={12} /> {okCount} válidos
                </span>
                {errCount > 0 && (
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full font-semibold ${isLight ? 'bg-red-50 text-red-700' : 'bg-red-500/15 text-red-300'}`}>
                    <AlertTriangle size={12} /> {errCount} com erro
                  </span>
                )}
              </div>
              <div className={`rounded-xl border ${border} max-h-[420px] overflow-y-auto`}>
                {linhas.map((l, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 px-3 py-2 border-b last:border-b-0 ${border} ${
                      l.status === 'erro'
                        ? isLight ? 'bg-red-50/50' : 'bg-red-500/[0.04]'
                        : ''
                    }`}
                  >
                    {l.status === 'ok'
                      ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      : <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0 text-xs">
                      <p className={`font-mono truncate ${txtMain}`}>{l.arquivo}</p>
                      {l.status === 'ok' ? (
                        <p className={`text-[11px] mt-0.5 ${txtMuted}`}>
                          {l.colaborador_nome} · {l.competencia?.slice(0, 7)} · {TIPO_LABEL[l.tipo]}
                          {l.valor_liquido != null && ` · ${l.valor_liquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                        </p>
                      ) : (
                        <p className="text-[11px] mt-0.5 text-red-600">{l.motivo}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {resultado && (
            <div className={`rounded-xl p-5 text-center ${isLight ? 'bg-emerald-50 border border-emerald-200' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
              <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-2" />
              <p className={`text-lg font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>
                {resultado.enviados} holerite(s) enviado(s)
              </p>
              {resultado.falhas > 0 && (
                <p className="text-sm text-red-600 mt-1">{resultado.falhas} falha(s) no upload</p>
              )}
            </div>
          )}
        </div>

        <div className={`px-5 py-3 border-t flex items-center justify-between gap-3 ${border} ${isLight ? 'bg-slate-50' : 'bg-[#1e293b]'}`}>
          <div className="text-xs text-slate-500">
            {importando && (
              <span className="flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                Importando {progress.done}/{progress.total}...
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border ${isLight ? 'border-slate-300 text-slate-600 hover:bg-slate-100' : 'border-white/[0.06] text-slate-300 hover:bg-white/[0.04]'}`}
            >
              {resultado ? 'Fechar' : 'Cancelar'}
            </button>
            {linhas.length > 0 && !resultado && (
              <button
                onClick={handleImportar}
                disabled={importando || okCount === 0}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {importando ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                Importar {okCount} válido(s)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
