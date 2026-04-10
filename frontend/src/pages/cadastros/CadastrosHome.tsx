import { useNavigate } from 'react-router-dom'
import {
  Building, Building2, Package2, Tag, Target, HardHat, Users, Warehouse,
  Layers, FolderTree, Plus, Sparkles, ArrowRight, FolderKanban,
} from 'lucide-react'
import {
  useCadFornecedores, useCadClasses, useCadCentrosCusto,
  useCadObras, useCadColaboradores, useCadEmpresas,
  useCadGrupos, useCadCategorias,
} from '../../hooks/useCadastros'
import { useEstoqueItens, useBases } from '../../hooks/useEstoque'
import { supabase } from '../../services/supabase'
import { useQuery } from '@tanstack/react-query'

const SECTIONS = [
  {
    title: 'Estrutura de Custos',
    subtitle: 'Empresa > Centro de Custo > Obra',
    entities: [
      { key: 'empresas',  label: 'Empresas',    icon: Building,  route: '/cadastros/empresas',     color: 'teal',   emoji: '🏛️' },
      { key: 'centros',   label: 'Centros Custo',icon: Target,    route: '/cadastros/centros-custo',color: 'cyan',   emoji: '🎯' },
      { key: 'obras',     label: 'Obras',        icon: HardHat,   route: '/cadastros/obras',        color: 'indigo', emoji: '🏗️' },
      { key: 'projetos',  label: 'Projetos',     icon: FolderKanban, route: '/cadastros/projetos',  color: 'violet', emoji: '📋' },
    ],
  },
  {
    title: 'Classificacao Financeira',
    subtitle: 'Grupo > Categoria > Classe',
    entities: [
      { key: 'grupos',     label: 'Grupos',      icon: Layers,     route: '/cadastros/grupos',      color: 'violet', emoji: '📊' },
      { key: 'categorias', label: 'Categorias',  icon: FolderTree, route: '/cadastros/categorias',  color: 'purple', emoji: '📁' },
      { key: 'classes',    label: 'Classes Fin.', icon: Tag,        route: '/cadastros/classes',     color: 'amber',  emoji: '📂' },
    ],
  },
  {
    title: 'Entidades',
    subtitle: 'Fornecedores, Colaboradores e Itens',
    entities: [
      { key: 'fornecedores',  label: 'Fornecedores',  icon: Building2, route: '/cadastros/fornecedores',  color: 'emerald', emoji: '🏢' },
      { key: 'colaboradores', label: 'Colaboradores',  icon: Users,     route: '/cadastros/colaboradores', color: 'rose',    emoji: '👷' },
      { key: 'itens',         label: 'Itens',          icon: Package2,  route: '/cadastros/itens',         color: 'blue',    emoji: '📦' },
      { key: 'bases',          label: 'Bases',          icon: Warehouse, route: '/cadastros/bases',         color: 'teal',    emoji: '🏭' },
    ],
  },
] as const

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',    iconBg: 'bg-teal-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', iconBg: 'bg-emerald-100' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    iconBg: 'bg-blue-100' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   iconBg: 'bg-amber-100' },
  cyan:    { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200',    iconBg: 'bg-cyan-100' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  iconBg: 'bg-indigo-100' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    iconBg: 'bg-rose-100' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  iconBg: 'bg-violet-100' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  iconBg: 'bg-purple-100' },
}

export default function CadastrosHome() {
  const navigate = useNavigate()
  const { data: empresas = [] } = useCadEmpresas()
  const { data: fornecedores = [] } = useCadFornecedores()
  const { data: itens = [] } = useEstoqueItens()
  const { data: bases = [] } = useBases()
  const { data: classes = [] } = useCadClasses()
  const { data: centros = [] } = useCadCentrosCusto()
  const { data: obras = [] } = useCadObras()
  const { data: colaboradores = [] } = useCadColaboradores()
  const { data: grupos = [] } = useCadGrupos()
  const { data: categorias = [] } = useCadCategorias()
  const { data: projetos = [] } = useQuery({
    queryKey: ['cad-projetos-count'],
    queryFn: async () => {
      const { data } = await supabase.from('pmo_projetos').select('id')
      return data ?? []
    },
  })

  const counts: Record<string, number> = {
    empresas: empresas.length,
    fornecedores: fornecedores.length,
    itens: itens.length,
    classes: classes.length,
    centros: centros.length,
    obras: obras.length,
    projetos: projetos.length,
    colaboradores: colaboradores.length,
    grupos: grupos.length,
    categorias: categorias.length,
    bases: bases.length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-800">Cadastros</h1>
        </div>
        <p className="text-xs text-slate-400">Gerencie os dados mestres do sistema com auxilio de IA</p>
      </div>

      {/* Sections */}
      {SECTIONS.map(section => (
        <div key={section.title}>
          <div className="mb-3">
            <h2 className="text-sm font-extrabold text-slate-700">{section.title}</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">{section.subtitle}</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {section.entities.map(ent => {
              const c = COLOR_MAP[ent.color]
              const Icon = ent.icon
              const count = counts[ent.key] ?? 0
              return (
                <div
                  key={ent.key}
                  onClick={() => navigate(ent.route)}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5
                    hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center`}>
                      <Icon size={18} className={c.text} />
                    </div>
                    <ArrowRight size={14} className="text-slate-300 group-hover:text-violet-500 transition-colors mt-1" />
                  </div>
                  <p className="text-2xl font-extrabold text-slate-800">{count}</p>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">{ent.label}</p>
                  <button
                    onClick={e => { e.stopPropagation(); navigate(ent.route + '?new=1') }}
                    className={`mt-3 flex items-center gap-1 text-[10px] font-bold ${c.text}
                      hover:underline transition-colors`}
                  >
                    <Plus size={10} /> Novo
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
