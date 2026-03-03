import { useState } from 'react'
import {
  Users, Search, Plus, Building2, Phone, Mail,
  CreditCard, CheckCircle2, XCircle, ChevronRight,
  ExternalLink, FileText,
} from 'lucide-react'
import { useFornecedores } from '../../hooks/useFinanceiro'

export default function Fornecedores() {
  const [busca, setBusca] = useState('')
  const [showInativos, setShowInativos] = useState(false)
  const { data: fornecedores = [], isLoading } = useFornecedores()

  const filtered = fornecedores
    .filter(f => showInativos || f.ativo)
    .filter(f =>
      !busca || f.razao_social.toLowerCase().includes(busca.toLowerCase())
        || f.nome_fantasia?.toLowerCase().includes(busca.toLowerCase())
        || f.cnpj?.includes(busca)
    )

  const ativos = fornecedores.filter(f => f.ativo).length
  const comBanco = fornecedores.filter(f => f.banco_nome || f.pix_chave).length

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <Users size={20} className="text-emerald-600" />
            Fornecedores
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Cadastro e dados bancários</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white
          text-[11px] font-bold shadow-sm hover:bg-emerald-700 transition-all">
          <Plus size={13} />
          Novo
        </button>
      </div>

      {/* ── Resumo ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Total</p>
          <p className="text-xl font-extrabold text-slate-800 mt-1">{fornecedores.length}</p>
          <p className="text-[10px] text-slate-400">fornecedores</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-widest">Ativos</p>
          <p className="text-xl font-extrabold text-emerald-600 mt-1">{ativos}</p>
          <p className="text-[10px] text-slate-400">habilitados</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-widest">Dados Bancários</p>
          <p className="text-xl font-extrabold text-blue-600 mt-1">{comBanco}</p>
          <p className="text-[10px] text-slate-400">com dados</p>
        </div>
      </div>

      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar razão social, fantasia ou CNPJ..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white
              text-sm text-slate-700 placeholder-slate-400 focus:outline-none
              focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
        </div>
        <button
          onClick={() => setShowInativos(!showInativos)}
          className={`px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all
            ${showInativos
              ? 'bg-slate-700 text-white'
              : 'bg-white text-slate-500 border border-slate-200'
            }`}>
          {showInativos ? 'Mostrando Inativos' : 'Mostrar Inativos'}
        </button>
      </div>

      {/* ── Lista ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-emerald-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Nenhum fornecedor encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Cadastre fornecedores para iniciar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => (
            <div key={f.id} className={`bg-white rounded-2xl border shadow-sm p-4
              transition-all hover:shadow-md cursor-pointer group
              ${f.ativo ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>

              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                  ${f.ativo ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                  <Building2 size={16} className={f.ativo ? 'text-emerald-600' : 'text-slate-400'} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {f.nome_fantasia || f.razao_social}
                    </p>
                    {f.ativo ? (
                      <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle size={12} className="text-slate-400 shrink-0" />
                    )}
                  </div>

                  {f.nome_fantasia && (
                    <p className="text-[10px] text-slate-400 truncate mb-1">{f.razao_social}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    {f.cnpj && (
                      <span className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full font-mono">
                        {f.cnpj}
                      </span>
                    )}
                    {f.omie_id && (
                      <span className="bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <ExternalLink size={8} />
                        Omie #{f.omie_id}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                    {f.telefone && (
                      <span className="flex items-center gap-1">
                        <Phone size={10} />
                        {f.telefone}
                      </span>
                    )}
                    {f.email && (
                      <span className="flex items-center gap-1">
                        <Mail size={10} />
                        {f.email}
                      </span>
                    )}
                    {(f.banco_nome || f.pix_chave) && (
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <CreditCard size={10} />
                        {f.pix_chave ? `PIX: ${f.pix_tipo}` : f.banco_nome}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight size={14} className="text-slate-300 shrink-0 mt-2
                  group-hover:text-emerald-500 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
