import { useState, useEffect, useRef } from 'react'
import {
  ClipboardList, Plus, CheckCircle2, Clock, X, Search,
  Save, Loader2, ChevronDown, ChevronRight, PackagePlus, Upload,
  Inbox,
} from 'lucide-react'
import {
  useInventarios, useInventario,
  useAbrirInventario, useSalvarContagem, useConcluirInventario,
  useBases, useAdicionarItemInventario, useInventarioItemSearch,
  useImportarInventarioCSV, useImportarInventarioPorDescricao,
} from '../../hooks/useEstoque'
import * as XLSX from 'xlsx'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import type { EstInventario, EstItem, TipoInventario } from '../../types/estoque'

const STATUS_CONFIG = {
  aberto:       { label: 'Aberto',       bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  em_contagem:  { label: 'Em Contagem',  bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
  concluido:    { label: 'Conclu\u00eddo',    bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  cancelado:    { label: 'Cancelado',    bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400'   },
}

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function Inventario() {
  const { isLightSidebar: isLight } = useTheme()
  const { perfil } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tipo, setTipo] = useState<TipoInventario>('ciclico')
  const [baseId, setBaseId] = useState('')
  const [curvaFiltro, setCurvaFiltro] = useState('')
  const [responsavel, setResponsavel] = useState('')

  // Pre-preenche responsavel com o nome do usuario logado quando abrir o modal
  useEffect(() => {
    if (showForm && !responsavel && perfil?.nome) setResponsavel(perfil.nome)
  }, [showForm, perfil?.nome, responsavel])

  const { data: inventarios = [], isLoading } = useInventarios()
  const { data: bases = [] } = useBases()
  const abrirInventario = useAbrirInventario()
  const concluir = useConcluirInventario()
  const [importTargetId, setImportTargetId] = useState<string | null>(null)
  const [showPickerImport, setShowPickerImport] = useState(false)

  // Inventários abertos/em contagem (elegíveis pra receber import)
  const inventariosElegiveis = inventarios.filter(
    inv => inv.status === 'aberto' || inv.status === 'em_contagem',
  )

  function handleImportClick() {
    if (inventariosElegiveis.length === 0) {
      alert('Crie um inventário primeiro (status Aberto ou Em Contagem) e tente novamente.')
      return
    }
    if (inventariosElegiveis.length === 1) {
      setImportTargetId(inventariosElegiveis[0].id)
      return
    }
    setShowPickerImport(true)
  }

  async function handleAbrir() {
    await abrirInventario.mutateAsync({
      tipo,
      base_id: baseId || undefined,
      curva_filtro: curvaFiltro ? curvaFiltro as 'A' | 'B' | 'C' : undefined,
      responsavel,
    })
    setShowForm(false)
    setBaseId('')
    setCurvaFiltro('')
    setResponsavel('')
  }

  const card = isLight
    ? 'bg-white border-slate-200 shadow-sm'
    : 'bg-white/[0.03] border-white/[0.06]'

  const inputCls = isLight
    ? 'input-base'
    : 'input-base bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500'

  const labelCls = isLight ? 'text-slate-600' : 'text-slate-300'

  return (
    <div className="space-y-4">

      {/* -- Header --------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>{'Invent\u00e1rios'}</h1>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{inventarios.length} {'invent\u00e1rios'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImportClick}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white
              text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
            title="Importar contagem em lote (CSV ou XLSX)"
          >
            <Upload size={15} /> Importar CSV/XLSX
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white
              text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
          >
            <Plus size={15} /> Novo Inventario
          </button>
        </div>
      </div>

      {importTargetId && (
        <ImportarCSVModal
          inventarioId={importTargetId}
          isLight={isLight}
          onClose={() => setImportTargetId(null)}
        />
      )}

      {showPickerImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowPickerImport(false)}>
          <div className={`rounded-2xl shadow-2xl w-full max-w-md ${isLight ? 'bg-white' : 'bg-[#111827]'}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
              <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Importar em qual inventário?</h2>
              <button onClick={() => setShowPickerImport(false)} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/[0.06] text-slate-400'}`}>
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {inventariosElegiveis.map(inv => {
                const baseNome = bases.find(b => b.id === inv.base_id)?.nome ?? 'Todas as bases'
                return (
                  <button
                    key={inv.id}
                    onClick={() => { setImportTargetId(inv.id); setShowPickerImport(false) }}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      isLight ? 'bg-white hover:bg-slate-50 border-slate-200' : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.06]'
                    }`}
                  >
                    <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      {inv.numero} <span className={`text-[10px] font-semibold ml-1 px-1.5 py-0.5 rounded ${STATUS_CONFIG[inv.status]?.bg} ${STATUS_CONFIG[inv.status]?.text}`}>{STATUS_CONFIG[inv.status]?.label}</span>
                    </p>
                    <p className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {inv.tipo} · {baseNome} · aberto em {fmtData(inv.data_abertura)}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* -- Lista --------------------------------------------------- */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : inventarios.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${card}`}>
          <ClipboardList size={40} className={isLight ? 'text-slate-200' : 'text-slate-600'} />
          <p className={`font-semibold mt-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum inventario realizado</p>
          <p className={`text-sm mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Abra um novo inventario para comecar a contagem</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inventarios.map(inv => (
            <InventarioCard
              key={inv.id}
              inventario={inv}
              isExpanded={selectedId === inv.id}
              onToggle={() => setSelectedId(selectedId === inv.id ? null : inv.id)}
              onConcluir={() => concluir.mutateAsync({ inventario_id: inv.id, aprovado_por: perfil?.nome ?? '' })}
              concluding={concluir.isPending}
              isLight={isLight}
            />
          ))}
        </div>
      )}

      {/* -- Modal Novo Inventario ---------------------------------- */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`rounded-2xl shadow-2xl w-full max-w-md ${isLight ? 'bg-white' : 'bg-[#111827]'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
              <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Novo Inventario</h2>
              <button onClick={() => setShowForm(false)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/[0.06] text-slate-400'}`}>
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Tipo</label>
                <select value={tipo} onChange={e => setTipo(e.target.value as TipoInventario)}
                  className={inputCls}>
                  <option value="ciclico">Ciclico -- itens selecionados</option>
                  <option value="periodico">Periodico -- base completa</option>
                  <option value="surpresa">Surpresa -- amostral</option>
                </select>
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Base (opcional)</label>
                <select value={baseId} onChange={e => setBaseId(e.target.value)}
                  className={inputCls}>
                  <option value="">Todas as bases</option>
                  {bases.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
                </select>
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Filtrar por Curva ABC</label>
                <select value={curvaFiltro} onChange={e => setCurvaFiltro(e.target.value)}
                  className={inputCls}>
                  <option value="">Todas as curvas</option>
                  <option value="A">Curva A</option>
                  <option value="B">Curva B</option>
                  <option value="C">Curva C</option>
                </select>
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Responsavel</label>
                <input value={responsavel} onChange={e => setResponsavel(e.target.value)}
                  className={inputCls} placeholder="Nome do responsavel..." />
              </div>
            </div>

            <div className={`px-6 py-4 border-t flex justify-end gap-2 ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
              <button onClick={() => setShowForm(false)}
                className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-colors
                  ${isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'}`}>
                Cancelar
              </button>
              <button onClick={handleAbrir} disabled={abrirInventario.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700
                  text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm">
                {abrirInventario.isPending
                  ? <Loader2 size={14} className="animate-spin" />
                  : <ClipboardList size={14} />
                }
                Abrir Inventario
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// -- Inventario Card com contagem ------------------------------------------------
function InventarioCard({
  inventario, isExpanded, onToggle, onConcluir, concluding, isLight
}: {
  inventario: EstInventario
  isExpanded: boolean
  onToggle: () => void
  onConcluir: () => void
  concluding: boolean
  isLight: boolean
}) {
  const cfg = STATUS_CONFIG[inventario.status]
  const { data: detail, isLoading: loadingDetail } = useInventario(isExpanded ? inventario.id : undefined)
  const salvarContagem = useSalvarContagem()
  const [contagens, setContagens] = useState<Record<string, number>>({})
  const [showAddItem, setShowAddItem] = useState(false)
  const [showImportCSV, setShowImportCSV] = useState(false)

  const itens = detail?.itens ?? []
  const contados = itens.filter(i => i.saldo_contado != null).length
  const semItens = isExpanded && !loadingDetail && itens.length === 0

  async function handleSalvarContagem(itemId: string) {
    const valor = contagens[itemId]
    if (valor == null) return
    await salvarContagem.mutateAsync({ id: itemId, saldo_contado: valor })
  }

  const card = isLight
    ? 'bg-white border-slate-200 shadow-sm'
    : 'bg-white/[0.03] border-white/[0.06]'

  return (
    <div className={`rounded-2xl border overflow-hidden ${card}`}>
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`}
        onClick={onToggle}
      >
        <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
          <ClipboardList size={16} className="text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>{inventario.numero}</p>
            <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${cfg.bg} ${cfg.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
          <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            {inventario.tipo} - {inventario.base?.nome ?? 'Todas as bases'}
            {inventario.responsavel ? ` - ${inventario.responsavel}` : ''}
            {' - '}{fmtData(inventario.data_abertura)}
          </p>
        </div>
        {inventario.acuracia != null && (
          <div className="text-right shrink-0 mr-2">
            <p className={`text-sm font-extrabold ${inventario.acuracia >= 95 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {inventario.acuracia.toFixed(1)}%
            </p>
            <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Acuracia</p>
          </div>
        )}
        {isExpanded ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
      </div>

      {showAddItem && (
        <AdicionarItemModal
          inventarioId={inventario.id}
          baseId={inventario.base_id}
          isLight={isLight}
          onClose={() => setShowAddItem(false)}
        />
      )}

      {showImportCSV && (
        <ImportarCSVModal
          inventarioId={inventario.id}
          isLight={isLight}
          onClose={() => setShowImportCSV(false)}
        />
      )}

      {isExpanded && (
        <div className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
          {inventario.status !== 'concluido' && inventario.status !== 'cancelado' && (
            <div className={`px-4 py-2 flex items-center justify-between ${isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}`}>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {contados}/{itens.length} itens contados
              </p>
              <div className="flex items-center gap-2">
                {inventario.status === 'aberto' && (
                  <button
                    onClick={() => setShowAddItem(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700
                      text-white text-xs font-semibold transition-colors"
                  >
                    <PackagePlus size={12} />
                    Adicionar Item
                  </button>
                )}
                <button
                  onClick={() => setShowImportCSV(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700
                    text-white text-xs font-semibold transition-colors"
                >
                  <Upload size={12} />
                  Importar CSV
                </button>
                <button
                  onClick={onConcluir}
                  disabled={concluding || contados === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700
                    text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {concluding ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                  Concluir
                </button>
              </div>
            </div>
          )}

          <div className={`divide-y max-h-80 overflow-y-auto ${isLight ? 'divide-slate-50' : 'divide-white/[0.04]'}`}>
            {loadingDetail ? (
              <p className={`text-center text-sm py-8 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Carregando itens...</p>
            ) : semItens ? (
              <div className={`flex flex-col items-center justify-center py-10 px-6 text-center ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                <Inbox size={32} className={isLight ? 'text-slate-300' : 'text-slate-600'} />
                <p className="font-semibold mt-2 text-sm">Nenhum item nesse inventário</p>
                <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  {inventario.status === 'aberto'
                    ? 'Use Adicionar Item para incluir um por um ou Importar CSV pra trazer em lote.'
                    : 'O inventário foi aberto sem itens (provavelmente sem saldo na época).'}
                </p>
              </div>
            ) : itens.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                    {item.item?.descricao ?? '--'}
                  </p>
                  <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    Sistema: {item.saldo_sistema ?? '--'} {item.item?.unidade}
                    {item.saldo_contado == null ? (
                      <span className={`ml-2 italic ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>· aguardando contagem</span>
                    ) : item.divergencia !== 0 ? (
                      <span className={`ml-2 font-semibold ${item.divergencia! < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        ({item.divergencia! > 0 ? '+' : ''}{item.divergencia})
                      </span>
                    ) : (
                      <span className="ml-2 text-emerald-500 font-semibold">OK</span>
                    )}
                  </p>
                </div>
                {inventario.status !== 'concluido' ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={0}
                      placeholder={String(item.saldo_contado ?? '')}
                      value={contagens[item.id] ?? ''}
                      onChange={e => setContagens(p => ({ ...p, [item.id]: Number(e.target.value) }))}
                      className={`w-20 px-2 py-1 text-xs rounded-lg border text-center
                        focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                        ${isLight ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-white/[0.04] text-slate-200'}`}
                    />
                    <button
                      onClick={() => handleSalvarContagem(item.id)}
                      disabled={salvarContagem.isPending || contagens[item.id] == null}
                      className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center
                        justify-center text-blue-600 transition-colors disabled:opacity-40"
                    >
                      <Save size={12} />
                    </button>
                  </div>
                ) : (
                  <p className={`text-xs font-semibold shrink-0 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    {item.saldo_contado ?? '--'} {item.item?.unidade}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal: Importar Contagem (CSV ou XLSX) ───────────────────────────────────
// CSV (legado, codigo;quantidade): casa por codigo via est_importar_inventario.
// XLSX (template Inventario Geral): casa por DESCRICAO + auto-cria item se
//   necessario via est_importar_inventario_por_descricao.

// Mapeia unidades comuns da planilha para o enum est_unidade.
const UNIDADE_MAP: Record<string, string> = {
  PACOTE: 'PCT', PCT: 'PCT', CAIXA: 'CX', CX: 'CX',
  MT: 'M', METRO: 'M', M: 'M', M2: 'M2', M3: 'M3',
  'GALÃO': 'GALAO', GALAO: 'GALAO', RM: 'UN', RESMA: 'UN',
  KT: 'UN', KIT: 'UN', JG: 'JG', JOGO: 'JG',
  KG: 'KG', TON: 'TON', L: 'L', LT: 'L', LITRO: 'L',
  PC: 'PC', PEÇA: 'PC', PR: 'PR', PAR: 'PR',
  UN: 'UN', UND: 'UN', UNIDADE: 'UN',
  RL: 'RL', ROLO: 'RL', FARDO: 'FARDO', BARRA: 'BARRA',
}

type LinhaCsv = { codigo: string; quantidade: string; observacao?: string }
type LinhaXlsx = { descricao: string; unidade?: string; marca?: string; quantidade: string }

function ImportarCSVModal({
  inventarioId, isLight, onClose,
}: {
  inventarioId: string
  isLight: boolean
  onClose: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const importarCsv = useImportarInventarioCSV()
  const importarXlsx = useImportarInventarioPorDescricao()
  const [csvText, setCsvText] = useState('')
  const [xlsxRows, setXlsxRows] = useState<LinhaXlsx[]>([])
  const [xlsxFileName, setXlsxFileName] = useState('')
  const [mode, setMode] = useState<'csv' | 'xlsx'>('csv')
  const [result, setResult] = useState<any | null>(null)
  const [parseWarn, setParseWarn] = useState<string | null>(null)

  const bg = isLight ? 'bg-white' : 'bg-[#0f172a]'
  const border = isLight ? 'border-slate-200' : 'border-white/[0.06]'
  const txtMain = isLight ? 'text-slate-800' : 'text-slate-100'
  const txtMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const inputCls = `w-full rounded-xl border px-3 py-2 text-sm font-mono ${
    isLight ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-white/[0.06] bg-white/[0.02] text-slate-200'
  } focus:outline-none focus:ring-2 focus:ring-indigo-400/40`

  function handleFile(file: File | null) {
    if (!file) return
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      handleXlsx(file)
    } else {
      const reader = new FileReader()
      reader.onload = () => { setCsvText(String(reader.result ?? '')); setMode('csv') }
      reader.readAsText(file, 'utf-8')
    }
  }

  // Parse XLSX usando o template "Inventario Geral":
  //   Colunas esperadas (apos cabecalho): QTD, DESCRICAO, CODIGO, MARCA, C.A, UNID, OBRA
  //   Linhas iniciais (titulo/subtitulo) sao puladas automaticamente buscando
  //   a linha que contem "DESCR" + "QTD".
  function handleXlsx(file: File) {
    setParseWarn(null)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' })

        // Localiza linha do cabecalho (contem "QTD" e "DESCR")
        const headerIdx = rows.findIndex(r => {
          const joined = r.map(c => String(c ?? '').toUpperCase()).join('|')
          return joined.includes('QTD') && joined.includes('DESCR')
        })
        if (headerIdx < 0) {
          setParseWarn('Nao encontrei cabecalho com colunas QTD e DESCRICAO. Verifique o arquivo.')
          return
        }
        const headers = rows[headerIdx].map((c: any) => String(c ?? '').toUpperCase().replace(/\s+/g, ' ').trim())
        const idxQtd  = headers.findIndex(h => h.startsWith('QTD'))
        const idxDesc = headers.findIndex(h => h.includes('DESCR'))
        const idxMarca = headers.findIndex(h => h.startsWith('MARCA') || h.includes('FABRIC'))
        const idxUnid = headers.findIndex(h => h.startsWith('UNID') || h === 'UN')
        if (idxQtd < 0 || idxDesc < 0) {
          setParseWarn('Cabecalho sem colunas QTD/DESCRICAO suficientes.')
          return
        }

        const out: LinhaXlsx[] = []
        const ignoradas: string[] = []
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i]
          const descRaw = String(row[idxDesc] ?? '').trim()
          if (!descRaw) continue
          // Pula linhas de totalizacao/observacao
          if (/^TOTAL\s/i.test(descRaw) || /^OBS/i.test(descRaw)) continue

          let qtdRaw = row[idxQtd]
          let qtd: number
          if (typeof qtdRaw === 'number') {
            qtd = qtdRaw
          } else {
            // String tipo "10FD", "5CX": extrai apenas o numero inicial
            const m = String(qtdRaw ?? '').replace(',', '.').match(/^\s*([\d.]+)/)
            qtd = m ? Number(m[1]) : NaN
          }
          if (!Number.isFinite(qtd)) {
            ignoradas.push(`${descRaw} (qtd invalida: "${qtdRaw}")`)
            continue
          }

          const unidRaw = idxUnid >= 0 ? String(row[idxUnid] ?? '').toUpperCase().trim() : ''
          const unid = UNIDADE_MAP[unidRaw] ?? unidRaw ?? 'UN'
          const marca = idxMarca >= 0 ? String(row[idxMarca] ?? '').trim() : ''

          out.push({
            descricao: descRaw,
            unidade: unid || 'UN',
            marca: marca || undefined,
            quantidade: String(qtd),
          })
        }
        if (out.length === 0) {
          setParseWarn('Nenhuma linha valida encontrada apos o cabecalho.')
          return
        }
        if (ignoradas.length > 0) {
          setParseWarn(`${ignoradas.length} linha(s) com qtd invalida foram puladas: ${ignoradas.slice(0, 3).join('; ')}${ignoradas.length > 3 ? ` (+${ignoradas.length - 3} mais)` : ''}`)
        }
        setXlsxRows(out)
        setXlsxFileName(file.name)
        setMode('xlsx')
      } catch (e: any) {
        setParseWarn(`Erro ao ler XLSX: ${e?.message ?? 'desconhecido'}`)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function parseCsv(text: string): LinhaCsv[] {
    const out: LinhaCsv[] = []
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return out

    for (let i = 0; i < lines.length; i++) {
      const sep = lines[i].includes(';') ? ';' : ','
      const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''))
      if (cols.length < 2) continue
      const [codigo, quantidade, ...resto] = cols
      if (i === 0 && isNaN(Number(quantidade.replace(',', '.')))) continue
      out.push({
        codigo,
        quantidade: quantidade.replace(',', '.'),
        observacao: resto.length ? resto.join(' ') : undefined,
      })
    }
    return out
  }

  async function handleImport() {
    setResult(null)
    try {
      if (mode === 'xlsx') {
        if (xlsxRows.length === 0) {
          alert('Nenhuma linha XLSX carregada.')
          return
        }
        const r = await importarXlsx.mutateAsync({ inventarioId, itens: xlsxRows })
        setResult(r)
      } else {
        const linhas = parseCsv(csvText)
        if (linhas.length === 0) {
          alert('CSV vazio ou invalido. Use: codigo;quantidade;observacao (uma linha por item)')
          return
        }
        const r = await importarCsv.mutateAsync({ inventarioId, linhas })
        setResult(r)
      }
    } catch (e: any) {
      alert(`Erro: ${e?.message ?? 'desconhecido'}`)
    }
  }

  const isPending = importarCsv.isPending || importarXlsx.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`${bg} rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${border}`}>
          <h3 className={`text-sm font-bold ${txtMain}`}>Importar contagem (CSV ou XLSX)</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-3">
          {!result && (
            <>
              <div className={`rounded-xl p-3 ${isLight ? 'bg-indigo-50 border border-indigo-200' : 'bg-indigo-500/10 border border-indigo-500/20'}`}>
                <p className={`text-[11px] ${isLight ? 'text-indigo-700' : 'text-indigo-300'}`}>
                  <strong>XLSX</strong>: template "Inventário Geral" (colunas QTD, DESCRIÇÃO, CÓDIGO, MARCA, C.A, UNID., OBRA). Itens não cadastrados são criados automaticamente em est_itens (categoria "Almoxarifado Geral", valor 0).<br />
                  <strong>CSV</strong>: <code>codigo;quantidade;observacao</code> (1 item por linha, casa por código existente).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  ref={fileRef}
                  onChange={e => handleFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${
                    isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.10]'
                  }`}
                >
                  <Upload size={12} /> Selecionar arquivo (.csv ou .xlsx)
                </button>
                <span className={`text-[11px] ${txtMuted}`}>ou cole CSV abaixo</span>
              </div>

              {mode === 'xlsx' && xlsxRows.length > 0 && (
                <div className={`rounded-xl p-3 ${isLight ? 'bg-emerald-50 border border-emerald-200' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
                  <p className={`text-sm font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>
                    {xlsxFileName}
                  </p>
                  <p className={`text-[11px] ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                    {xlsxRows.length} item(ns) prontos para importar
                    {' · '}
                    {xlsxRows.filter(r => Number(r.quantidade) > 0).length} com qtd &gt; 0
                  </p>
                </div>
              )}

              {parseWarn && (
                <div className={`rounded-xl p-3 ${isLight ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                  <p className={`text-[11px] ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>{parseWarn}</p>
                </div>
              )}

              {mode === 'csv' && (
                <textarea
                  rows={6}
                  placeholder={'codigo;quantidade;observacao\nIT-001;15;contagem ok\nIT-002;3,5'}
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  className={inputCls}
                />
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={onClose}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                    isLight ? 'border-slate-300 text-slate-600 hover:bg-slate-50' : 'border-white/[0.06] text-slate-300 hover:bg-white/[0.04]'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImport}
                  disabled={isPending || (mode === 'csv' ? !csvText.trim() : xlsxRows.length === 0)}
                  className="px-3 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isPending ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  {isPending ? 'Importando...' : `Importar ${mode === 'xlsx' ? 'XLSX' : 'CSV'}`}
                </button>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-3">
              {result.ok ? (
                <div className={`rounded-xl p-4 ${isLight ? 'bg-emerald-50 border border-emerald-200' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
                  <p className={`text-sm font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>
                    {result.importados ?? 0} linha(s) importada(s)
                    {result.criados ? ` · ${result.criados} item(ns) auto-criado(s) no catálogo` : ''}
                  </p>
                  {result.erros_count ? (
                    <p className={`text-xs mt-1 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                      {result.erros_count} linha(s) ignorada(s)
                    </p>
                  ) : null}
                  <p className={`text-[11px] mt-2 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                    Próximo passo: conclua o inventário na lista para gerar movimentações de ajuste e atualizar o saldo "Em Estoque" da base.
                  </p>
                </div>
              ) : (
                <div className={`rounded-xl p-4 ${isLight ? 'bg-red-50 border border-red-200' : 'bg-red-500/10 border border-red-500/20'}`}>
                  <p className={`text-sm font-bold ${isLight ? 'text-red-700' : 'text-red-300'}`}>Erro: {result.erro}</p>
                </div>
              )}

              {result.erros && result.erros.length > 0 && (
                <div className={`rounded-xl border ${border} max-h-48 overflow-y-auto`}>
                  <p className={`text-[11px] font-bold uppercase tracking-wider px-3 py-2 ${txtMuted}`}>Linhas ignoradas</p>
                  <ul className="px-3 pb-3 space-y-1">
                    {result.erros.map((e, i) => (
                      <li key={i} className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        <span className="font-mono">{(e.linha?.codigo ?? '?')}</span>
                        <span className="text-amber-600"> - {e.motivo}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-3 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// -- Modal Adicionar Item ao Inventario ----------------------------------------
function AdicionarItemModal({
  inventarioId, baseId, isLight, onClose,
}: {
  inventarioId: string
  baseId?: string
  isLight: boolean
  onClose: () => void
}) {
  const adicionarItem = useAdicionarItemInventario()
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<EstItem | null>(null)
  const [modoLivre, setModoLivre] = useState(false)
  const [nomeLivre, setNomeLivre] = useState('')
  const [unidadeLivre, setUnidadeLivre] = useState('UN')
  const [qtdFisica, setQtdFisica] = useState<number>(0)
  const [showResults, setShowResults] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const { data: resultados = [], isFetching } = useInventarioItemSearch(search)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSubmit() {
    try {
      if (modoLivre) {
        if (!nomeLivre.trim()) {
          setFeedback({ type: 'error', msg: 'Informe o nome do item' })
          return
        }
        await adicionarItem.mutateAsync({
          inventario_id: inventarioId,
          base_id: baseId,
          descricao_livre: nomeLivre.trim(),
          unidade: unidadeLivre,
          quantidade_fisica: qtdFisica,
        })
      } else {
        if (!selectedItem) {
          setFeedback({ type: 'error', msg: 'Selecione um item do catalogo' })
          return
        }
        await adicionarItem.mutateAsync({
          inventario_id: inventarioId,
          item_id: selectedItem.id,
          base_id: baseId,
          quantidade_fisica: qtdFisica,
        })
      }
      setFeedback({ type: 'success', msg: 'Item adicionado ao inventario' })
      onClose()
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message ?? 'Erro ao adicionar item' })
    }
  }

  const inputCls = isLight
    ? 'input-base'
    : 'input-base bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500'

  const labelCls = isLight ? 'text-slate-600' : 'text-slate-300'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`rounded-2xl shadow-2xl w-full max-w-md ${isLight ? 'bg-white' : 'bg-[#111827]'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
          <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Adicionar Item ao Inventario</h2>
          <button onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/[0.06] text-slate-400'}`}>
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Toggle modo */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setModoLivre(false); setSelectedItem(null) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                !modoLivre
                  ? 'bg-blue-600 text-white'
                  : isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/[0.06] text-slate-400'
              }`}
            >
              Do Catalogo
            </button>
            <button
              onClick={() => { setModoLivre(true); setSelectedItem(null); setSearch('') }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                modoLivre
                  ? 'bg-blue-600 text-white'
                  : isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/[0.06] text-slate-400'
              }`}
            >
              Item Livre
            </button>
          </div>

          {!modoLivre ? (
            <>
              {/* Search autocomplete */}
              <div className="relative" ref={resultsRef}>
                <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Buscar item no catalogo</label>
                <div className="relative">
                  <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
                  <input
                    value={search}
                    onChange={e => { setSearch(e.target.value); setShowResults(true); setSelectedItem(null) }}
                    onFocus={() => setShowResults(true)}
                    className={`${inputCls} pl-9`}
                    placeholder="Codigo ou descricao..."
                  />
                  {isFetching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />}
                </div>

                {showResults && resultados.length > 0 && (
                  <div className={`absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border shadow-lg
                    ${isLight ? 'bg-white border-slate-200' : 'bg-[#1a2332] border-white/[0.08]'}`}>
                    {resultados.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedItem(item)
                          setSearch(item.descricao ?? '')
                          setShowResults(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors
                          ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.04]'}`}
                      >
                        <p className={`font-semibold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                          {item.descricao}
                        </p>
                        <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          {item.codigo} - {item.unidade} {item.categoria ? `- ${item.categoria}` : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedItem && (
                <div className={`rounded-xl border p-3 ${isLight ? 'bg-blue-50 border-blue-100' : 'bg-blue-900/20 border-blue-800/30'}`}>
                  <p className={`text-xs font-semibold ${isLight ? 'text-blue-800' : 'text-blue-300'}`}>{selectedItem.descricao}</p>
                  <p className={`text-[10px] mt-0.5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>
                    Codigo: {selectedItem.codigo} | Unidade: {selectedItem.unidade}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Nome do item</label>
                <input
                  value={nomeLivre}
                  onChange={e => setNomeLivre(e.target.value)}
                  className={inputCls}
                  placeholder="Descricao do material..."
                />
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Unidade</label>
                <select value={unidadeLivre} onChange={e => setUnidadeLivre(e.target.value)} className={inputCls}>
                  <option value="UN">UN - Unidade</option>
                  <option value="KG">KG - Quilograma</option>
                  <option value="M">M - Metro</option>
                  <option value="L">L - Litro</option>
                  <option value="CX">CX - Caixa</option>
                  <option value="PC">PC - Peca</option>
                  <option value="M2">M2 - Metro Quadrado</option>
                  <option value="M3">M3 - Metro Cubico</option>
                  <option value="TON">TON - Tonelada</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Quantidade fisica (contagem)</label>
            <input
              type="number"
              min={0}
              value={qtdFisica}
              onChange={e => setQtdFisica(Number(e.target.value))}
              className={inputCls}
              placeholder="0"
            />
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`mx-6 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
            feedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 size={14} /> : <X size={14} />}
            {feedback.msg}
          </div>
        )}

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex justify-end gap-2 ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
          <button onClick={onClose}
            className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-colors
              ${isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'}`}>
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={adicionarItem.isPending || (!modoLivre && !selectedItem) || (modoLivre && !nomeLivre.trim())}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700
              text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm"
          >
            {adicionarItem.isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <PackagePlus size={14} />
            }
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}

