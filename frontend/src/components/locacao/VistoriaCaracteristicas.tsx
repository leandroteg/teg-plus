// ─────────────────────────────────────────────────────────────────────────────
// VistoriaCaracteristicas — bloco de dados do imóvel preenchido na vistoria.
//
// Pedido da equipe de Contratos: sem matrícula, áreas, contagens, IPTU, prazo e
// melhorias, o processo de locação trava mais adiante. Quem tem esses números na
// mão é o vistoriador, então é aqui que eles entram.
//
// Onde cada coisa fica: o que descreve o IMÓVEL (matrícula, áreas, contagens,
// IPTU, contatos do locador) vai para loc_imoveis e vale para sempre — a próxima
// vistoria já abre preenchida. O que é DESTA mobilização (prazo negociado,
// renovação, melhorias) vai para loc_entradas.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import type { LocEntrada } from '../../types/locacao'

export interface CaracteristicasVistoria {
  matricula: string
  area_m2: string
  area_construida_m2: string
  qtd_banheiros: string
  qtd_portas: string
  qtd_janelas: string
  locador_cpf_cnpj: string
  locador_telefone: string
  locador_email: string
  iptu_numero: string
  iptu_quitado: '' | 'sim' | 'nao'
  prazo_fim: string
  renovacao: '' | 'sim' | 'nao'
  melhorias_mobilizacao: string
}

export const CARACTERISTICAS_VAZIAS: CaracteristicasVistoria = {
  matricula: '', area_m2: '', area_construida_m2: '',
  qtd_banheiros: '', qtd_portas: '', qtd_janelas: '',
  locador_cpf_cnpj: '', locador_telefone: '', locador_email: '',
  iptu_numero: '', iptu_quitado: '',
  prazo_fim: '', renovacao: '', melhorias_mobilizacao: '',
}

const str = (v: unknown) => (v == null ? '' : String(v))

/** Lê o que já está gravado para o formulário abrir preenchido e editável. */
export function useCaracteristicasSalvas(entrada: LocEntrada) {
  return useQuery({
    queryKey: ['loc_caracteristicas', entrada.imovel_id, entrada.id],
    enabled: !!entrada.imovel_id,
    queryFn: async (): Promise<CaracteristicasVistoria> => {
      const { data: im } = await supabase
        .from('loc_imoveis')
        .select('matricula, area_m2, area_construida_m2, qtd_banheiros, qtd_portas, qtd_janelas, iptu_numero, iptu_quitado, locador_cpf_cnpj, locador_telefone, locador_email, locador_contato')
        .eq('id', entrada.imovel_id!)
        .maybeSingle()
      const i = (im ?? {}) as Record<string, unknown>
      // Enquanto alguém não separar, o contato antigo serve de ponto de partida.
      const contatoLegado = str(i.locador_contato)
      return {
        matricula: str(i.matricula),
        area_m2: str(i.area_m2),
        area_construida_m2: str(i.area_construida_m2),
        qtd_banheiros: str(i.qtd_banheiros),
        qtd_portas: str(i.qtd_portas),
        qtd_janelas: str(i.qtd_janelas),
        locador_cpf_cnpj: str(i.locador_cpf_cnpj),
        locador_telefone: str(i.locador_telefone) || (contatoLegado.includes('@') ? '' : contatoLegado),
        locador_email: str(i.locador_email),
        iptu_numero: str(i.iptu_numero),
        iptu_quitado: i.iptu_quitado === true ? 'sim' : i.iptu_quitado === false ? 'nao' : '',
        prazo_fim: str(entrada.prazo_fim),
        renovacao: (entrada.renovacao as 'sim' | 'nao' | undefined) ?? '',
        melhorias_mobilizacao: str(entrada.melhorias_mobilizacao),
      }
    },
  })
}

const num = (v: string) => (v.trim() === '' ? null : Number(v))
const txt = (v: string) => (v.trim() === '' ? null : v.trim())

/** Grava o bloco: imóvel de um lado, entrada do outro. */
export async function salvarCaracteristicas(
  entrada: LocEntrada,
  d: CaracteristicasVistoria,
  autor?: string | null,
) {
  if (entrada.imovel_id) {
    const { error } = await supabase.from('loc_imoveis').update({
      matricula: txt(d.matricula),
      area_m2: num(d.area_m2),
      area_construida_m2: num(d.area_construida_m2),
      qtd_banheiros: num(d.qtd_banheiros),
      qtd_portas: num(d.qtd_portas),
      qtd_janelas: num(d.qtd_janelas),
      locador_cpf_cnpj: txt(d.locador_cpf_cnpj),
      locador_telefone: txt(d.locador_telefone),
      locador_email: txt(d.locador_email),
      iptu_numero: txt(d.iptu_numero),
      iptu_quitado: d.iptu_quitado === '' ? null : d.iptu_quitado === 'sim',
      atualizado_por_nome: autor ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', entrada.imovel_id)
    if (error) throw error
  }
  const { error: e2 } = await supabase.from('loc_entradas').update({
    prazo_fim: txt(d.prazo_fim),
    renovacao: d.renovacao === '' ? null : d.renovacao,
    melhorias_mobilizacao: txt(d.melhorias_mobilizacao),
    atualizado_por_nome: autor ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', entrada.id)
  if (e2) throw e2
}

const MELHORIAS_MIN = 300

export default function VistoriaCaracteristicas({ valores, onChange, isDark, dataEntrada }: {
  valores: CaracteristicasVistoria
  onChange: (v: CaracteristicasVistoria) => void
  isDark: boolean
  /** Data de entrada, só para exibir acima do prazo (o pedido foi "abaixo dela"). */
  dataEntrada?: string | null
}) {
  const set = <K extends keyof CaracteristicasVistoria>(k: K, v: CaracteristicasVistoria[K]) =>
    onChange({ ...valores, [k]: v })

  const label = `block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`
  const input = `w-full text-sm rounded-xl px-3 py-2 border outline-none ${isDark
    ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 [&>option]:bg-slate-900'
    : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400 focus:border-indigo-400'}`
  const secao = `text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`
  const card = `rounded-xl border p-3 ${isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-200 bg-white'}`

  // 0–99 no celular: number com faixa curta, sem select para não virar 2 toques.
  const Contagem = ({ k, rotulo }: { k: keyof CaracteristicasVistoria; rotulo: string }) => (
    <div>
      <label className={label}>{rotulo}</label>
      <input
        type="number" min={0} max={99} inputMode="numeric" placeholder="0"
        value={valores[k] as string}
        onChange={e => {
          const n = e.target.value
          if (n === '' || (Number(n) >= 0 && Number(n) <= 99)) set(k, n as never)
        }}
        className={input}
      />
    </div>
  )

  const faltam = MELHORIAS_MIN - valores.melhorias_mobilizacao.length

  return (
    <div className="space-y-3">
      <div className={card}>
        <p className={secao}>Características do imóvel</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
          <div>
            <label className={label}>Matrícula do imóvel</label>
            <input type="text" placeholder="00.000" value={valores.matricula}
              onChange={e => set('matricula', e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Área total (m²)</label>
            <input type="number" min={0} step="0.01" placeholder="0" value={valores.area_m2}
              onChange={e => set('area_m2', e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Área construída (m²)</label>
            <input type="number" min={0} step="0.01" placeholder="0" value={valores.area_construida_m2}
              onChange={e => set('area_construida_m2', e.target.value)} className={input} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Contagem k="qtd_banheiros" rotulo="Banheiros" />
          <Contagem k="qtd_portas" rotulo="Portas" />
          <Contagem k="qtd_janelas" rotulo="Janelas" />
        </div>
      </div>

      <div className={card}>
        <p className={secao}>Locador</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className={label}>CPF / CNPJ / CIN</label>
            <input type="text" placeholder="000.000.000-00" value={valores.locador_cpf_cnpj}
              onChange={e => set('locador_cpf_cnpj', e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Telefone (WhatsApp)</label>
            <input type="tel" inputMode="tel" placeholder="(00) 00000-0000" value={valores.locador_telefone}
              onChange={e => set('locador_telefone', e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>E-mail</label>
            <input type="email" inputMode="email" placeholder="nome@email.com" value={valores.locador_email}
              onChange={e => set('locador_email', e.target.value)} className={input} />
          </div>
        </div>
      </div>

      <div className={card}>
        <p className={secao}>IPTU</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className={label}>Número / código</label>
            <input type="text" placeholder="0000.0000.0000" value={valores.iptu_numero}
              onChange={e => set('iptu_numero', e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Situação</label>
            <select value={valores.iptu_quitado}
              onChange={e => set('iptu_quitado', e.target.value as '' | 'sim' | 'nao')} className={input}>
              <option value="">—</option>
              <option value="sim">Quitado</option>
              <option value="nao">Em aberto</option>
            </select>
          </div>
        </div>
      </div>

      <div className={card}>
        <p className={secao}>Prazo de locação</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className={label}>Data de entrada</label>
            <input type="date" value={dataEntrada ?? ''} readOnly disabled className={`${input} opacity-60`} />
          </div>
          <div>
            <label className={label}>Locado até</label>
            <input type="date" value={valores.prazo_fim}
              onChange={e => set('prazo_fim', e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Pretende renovar?</label>
            <select value={valores.renovacao}
              onChange={e => set('renovacao', e.target.value as '' | 'sim' | 'nao')} className={input}>
              <option value="">A definir</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>
        </div>
        <p className={`text-[11px] mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Esta data volta preenchida no contrato, na etapa de assinatura.
        </p>
      </div>

      <div className={card}>
        <p className={secao}>Melhorias necessárias para mobilização</p>
        <textarea
          rows={3} maxLength={2000}
          placeholder="O que precisa ser feito antes da equipe entrar. Ex.: executar uma parede no quarto dos fundos para melhor acomodação."
          value={valores.melhorias_mobilizacao}
          onChange={e => set('melhorias_mobilizacao', e.target.value)}
          className={`${input} resize-none`}
        />
        <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {valores.melhorias_mobilizacao.length} caracteres
          {valores.melhorias_mobilizacao.length > 0 && faltam > 0 && ` · cabem mais ${faltam} antes de ${MELHORIAS_MIN}`}
        </p>
      </div>
    </div>
  )
}

/** Mantém o estado do bloco sincronizado com o que veio do banco. */
export function useCaracteristicasState(entrada: LocEntrada) {
  const { data: salvas } = useCaracteristicasSalvas(entrada)
  const [valores, setValores] = useState<CaracteristicasVistoria>(CARACTERISTICAS_VAZIAS)
  const [carregou, setCarregou] = useState(false)
  useEffect(() => {
    // Só na primeira carga: depois disso o que vale é o que o vistoriador digitou.
    if (salvas && !carregou) { setValores(salvas); setCarregou(true) }
  }, [salvas, carregou])
  return { valores, setValores }
}
