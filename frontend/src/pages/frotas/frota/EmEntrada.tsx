import { useState } from 'react'
import { LogIn, Plus, Car, Cog, ClipboardList } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useQueryClient } from '@tanstack/react-query'
import { useVeiculos } from '../../../hooks/useFrotas'
import FrotasChecklistModal from '../../../components/frotas/FrotasChecklistModal'
import ChecklistDivergenciasModal from '../../../components/frotas/ChecklistDivergenciasModal'
import RegistrarEntradaModal from '../../../components/frotas/RegistrarEntradaModal'
import type { FroVeiculo } from '../../../types/frotas'
import type { DivergenciaItem, DivergenciaZona } from '../../../components/frotas/ChecklistDivergenciasModal'

export default function EmEntrada() {
  const { isDark } = useTheme()
  const queryClient = useQueryClient()
  const [openRegistrar, setOpenRegistrar] = useState(false)
  const [selectedVeiculo, setSelectedVeiculo] = useState<FroVeiculo | null>(null)
  const [divVeiculo, setDivVeiculo] = useState<FroVeiculo | null>(null)
  const [divItens, setDivItens] = useState<DivergenciaItem[]>([])
  const [divZonas, setDivZonas] = useState<DivergenciaZona[]>([])

  const { data: veiculos = [], isLoading } = useVeiculos({ status: 'em_entrada' })

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className={`text-lg font-bold flex items-center gap-2 ${!isDark ? 'text-slate-800' : 'text-white'}`}>
            <LogIn size={18} className="text-rose-500" />
            Em Entrada
            {veiculos.length > 0 && (
              <span className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                !isDark ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-400'
              }`}>
                {veiculos.length} pendente{veiculos.length > 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <p className={`text-xs mt-0.5 ${!isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Ativos em processo de entrada — aguardando conclusão da vistoria
          </p>
        </div>
        <button
          onClick={() => setOpenRegistrar(true)}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all ${
            isLight
              ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-500/30'
              : 'bg-rose-500/90 text-white hover:bg-rose-500 shadow-sm shadow-rose-500/20'
          }`}
        >
          <Plus size={13} /> Registrar Devolução
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && veiculos.length === 0 && (
        <div className={`flex flex-col items-center justify-center py-20 rounded-2xl border ${
          !isDark ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/30 border-white/[0.06]'
        }`}>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
            !isDark ? 'bg-emerald-50' : 'bg-emerald-500/10'
          }`}>
            <LogIn size={24} className={!isDark ? 'text-emerald-600' : 'text-emerald-400'} />
          </div>
          <p className={`font-semibold text-sm ${!isDark ? 'text-slate-700' : 'text-slate-300'}`}>
            Nenhuma entrada em andamento
          </p>
          <p className={`text-xs mt-1.5 max-w-xs text-center leading-relaxed ${!isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Quando um ativo novo ou retornando de locação iniciar o processo de entrada e vistoria, ele aparecerá aqui.
          </p>
          <button
            onClick={() => setOpenRegistrar(true)}
            className={`mt-5 flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl transition-all ${
              isLight
                ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-500/30'
                : 'bg-rose-500/90 text-white hover:bg-rose-500 shadow-sm shadow-rose-500/20'
            }`}
          >
            <Plus size={13} /> Registrar Devolução
          </button>
        </div>
      )}

      {/* List */}
      {!isLoading && veiculos.length > 0 && (
        <div className="space-y-2">
          {veiculos.map(v => {
            const isMaquina = v.tipo_ativo === 'maquina'
            const identificador = isMaquina && v.numero_serie ? v.numero_serie : v.placa
            return (
              <div
                key={v.id}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-2xl border transition-all ${
                  isLight
                    ? 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-sm'
                    : 'bg-slate-800/50 border-white/[0.06] hover:border-amber-500/30'
                }`}
              >
                {/* Top line: Icon + Info */}
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isMaquina
                      ? (!isDark ? 'bg-violet-50 text-violet-600' : 'bg-violet-500/10 text-violet-400')
                      : (!isDark ? 'bg-sky-50 text-sky-600'       : 'bg-sky-500/10 text-sky-400')
                  }`}>
                    {isMaquina ? <Cog size={18} /> : <Car size={18} />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${!isDark ? 'text-slate-800' : 'text-white'}`}>
                      {identificador}
                    </p>
                    <p className={`text-xs truncate ${!isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {v.marca} {v.modelo}
                    </p>
                  </div>

                  {/* Status pill */}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    !isDark ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-400'
                  }`}>
                    Vistoria pendente
                  </span>
                </div>

                {/* Action */}
                <button
                  onClick={() => setSelectedVeiculo(v)}
                  className={`flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all whitespace-nowrap w-full sm:w-auto sm:ml-auto ${
                    isLight
                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                  }`}>
                  <ClipboardList size={12} /> Continuar Vistoria
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Registrar Entrada */}
      {openRegistrar && (
        <RegistrarEntradaModal onClose={() => setOpenRegistrar(false)} />
      )}

      {/* Checklist Modal (devolução / pós-viagem) */}
      {selectedVeiculo && (
        <FrotasChecklistModal
          veiculo={selectedVeiculo}
          tipoChecklist="pos_viagem"
          onClose={() => {
            setSelectedVeiculo(null)
            queryClient.invalidateQueries({ queryKey: ['fro_veiculos'] })
          }}
          onConcluded={(itens, zonas) => {
            if (itens.length > 0 || zonas.length > 0) {
              setDivVeiculo(selectedVeiculo)
              setDivItens(itens)
              setDivZonas(zonas)
            }
          }}
        />
      )}

      {/* Divergencias Modal (shown after concluding entrada checklist) */}
      {divVeiculo && (
        <ChecklistDivergenciasModal
          veiculo={divVeiculo}
          divergenciasItens={divItens}
          divergenciasZonas={divZonas}
          onClose={() => {
            setDivVeiculo(null)
            setDivItens([])
            setDivZonas([])
          }}
        />
      )}
    </div>
  )
}
