import {
  LayoutDashboard, Plus, ClipboardCheck, HardHat, Leaf,
  CalendarClock, ClipboardList, Siren, ShieldCheck, GraduationCap, AlertTriangle, FileBadge, Play,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'

export default function QsmaLayout() {
  const nav = useNavigate()
  const NAV: NavItem[] = [
    { to: '/qsma', icon: LayoutDashboard, label: 'Painel', end: true },
    {
      to: '#novo-registro', icon: Plus, label: 'Novo Registro', accent: true,
      actionMenu: {
        title: 'Novo Registro',
        items: [
          { icon: CalendarClock, label: 'Programar Inspeção', description: 'Agendar checklist de equipe, veículo ou área', tone: 'sky',     action: () => nav('/qsma/inspecoes?novo=programar') },
          { icon: Play,          label: 'Executar Inspeção', description: 'Realizar uma inspeção programada em campo', tone: 'emerald',  action: () => nav('/qsma/inspecoes?novo=executar') },
          { icon: ClipboardList, label: 'Novo Modelo de Checklist', description: 'Montar um checklist configurável', tone: 'blue',        action: () => nav('/qsma/inspecoes?novo=modelo') },
          { icon: Siren,         label: 'Registrar Ocorrência', description: 'Desvio, quase-acidente, acidente ou ambiental', tone: 'rose', action: () => nav('/qsma/seguranca?novo=ocorrencia') },
          { icon: ShieldCheck,   label: 'Entrega de EPI', description: 'Ficha assinada via PortalTEG', tone: 'violet',                     action: () => nav('/qsma/seguranca?novo=epi') },
          { icon: GraduationCap, label: 'Treinamento', description: 'NR realizada com certificado e vencimento', tone: 'amber',            action: () => nav('/qsma/seguranca?novo=treinamento') },
          { icon: AlertTriangle, label: 'Risco / APR', description: 'Inventário PGR ou análise por tarefa', tone: 'amber',                 action: () => nav('/qsma/seguranca?novo=risco') },
          { icon: FileBadge,     label: 'Licença Ambiental', description: 'Condicionantes e alertas de prazo', tone: 'emerald',            action: () => nav('/qsma/meio-ambiente?novo=licenca') },
        ],
      },
    },
    { to: '/qsma/seguranca',     icon: HardHat,         label: 'Gestão SST' },
    { to: '/qsma/inspecoes',     icon: ClipboardCheck,  label: 'Inspeções' },
    { to: '/qsma/meio-ambiente', icon: Leaf,            label: 'Meio Ambiente' },
  ]
  return (
    <ModuleLayout
      moduleKey="qsma"
      moduleName="QSMA"
      moduleEmoji="🦺"
      moduleSubtitle="Qualidade, Segurança e Meio Ambiente"
      accent="rose"
      nav={NAV}
      bottomNavMaxItems={5}
      truncateBottomLabels
    />
  )
}
