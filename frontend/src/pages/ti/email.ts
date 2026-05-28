/**
 * Notificações de e-mail do módulo TI.
 *
 * Envia via edge function `send-ti-email` (Supabase) usando SMTP do Office 365
 * configurado como ti@teguniao.com.br.
 *
 * Falhas são logadas mas NÃO bloqueiam a ação principal — o chamado/comentário/
 * mudança de status já foi gravado no DB quando essas funções rodam.
 */
import { supabase } from '../../services/supabase'
import type { Chamado, StatusChamado } from './types'
import { STATUS_LABEL, PRIORIDADE_LABEL, formatNumero, getCategoria } from './types'

export const TI_INBOX = 'ti@teguniao.com.br'

interface EmailPayload {
  to: string | string[]
  cc?: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

async function sendEmail(payload: EmailPayload) {
  try {
    const { error } = await supabase.functions.invoke('send-ti-email', { body: payload })
    if (error) console.warn('[TI email] falha:', error.message)
  } catch (e) {
    console.warn('[TI email] exception:', e)
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

function appUrl(path = '') {
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}

function shell(title: string, bodyHtml: string, chamado: Pick<Chamado, 'id' | 'numero'>) {
  const link = appUrl(`/ti/c/${chamado.id}`)
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="padding:24px 28px;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;">
          <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:.8;">TEG+ TI · Chamado ${escape(formatNumero(chamado.numero))}</div>
          <div style="font-size:22px;font-weight:600;margin-top:4px;">${escape(title)}</div>
        </td></tr>
        <tr><td style="padding:28px;font-size:15px;line-height:1.55;color:#0f172a;">
          ${bodyHtml}
          <div style="margin-top:28px;text-align:center;">
            <a href="${link}" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;">Abrir chamado</a>
          </div>
          <p style="margin-top:24px;color:#64748b;font-size:13px;">Ou copie o link: <a href="${link}" style="color:#0ea5e9;">${escape(link)}</a></p>
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;">
          E-mail automático do TEG+. Responda esse e-mail apenas se a equipe de TI orientar — para registrar histórico, use o chat dentro do chamado.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function escape(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function paragrafo(text: string) {
  return `<p style="margin:0 0 12px 0;white-space:pre-wrap;">${escape(text)}</p>`
}

function meta(chamado: Chamado) {
  const cat = getCategoria(chamado.categoria)
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px 0;background:#f8fafc;border-radius:10px;padding:12px 14px;font-size:13px;color:#334155;">
    <tr><td><strong>Categoria:</strong> ${escape(cat.label)}</td></tr>
    <tr><td><strong>Prioridade:</strong> ${escape(PRIORIDADE_LABEL[chamado.prioridade])}</td></tr>
    <tr><td><strong>Solicitante:</strong> ${escape(chamado.solicitante?.nome ?? '—')}</td></tr>
    <tr><td><strong>Status:</strong> ${escape(STATUS_LABEL[chamado.status])}</td></tr>
  </table>`
}

// ─── Eventos ─────────────────────────────────────────────────────────────────

/** Chamado recém-criado — notifica ti@ + cópia para o solicitante */
export async function notificarNovoChamado(chamado: Chamado) {
  const numero = formatNumero(chamado.numero)
  const cat = getCategoria(chamado.categoria)
  const html = shell(
    `Novo chamado: ${chamado.titulo}`,
    `<p style="margin:0 0 12px 0;">Um novo chamado de TI foi aberto.</p>
     ${meta(chamado)}
     <p style="margin:16px 0 6px 0;font-weight:600;">Descrição</p>
     ${paragrafo(chamado.descricao)}`,
    chamado,
  )

  const subject = `[${numero}] ${cat.label} — ${chamado.titulo}`
  const destinos: string[] = [TI_INBOX]
  const cc: string[] = []
  if (chamado.solicitante?.email && chamado.solicitante.email !== TI_INBOX) {
    cc.push(chamado.solicitante.email)
  }

  await sendEmail({
    to: destinos,
    cc: cc.length ? cc : undefined,
    subject,
    html,
    replyTo: chamado.solicitante?.email,
  })
}

/** Novo comentário — se for atendente, vai pro solicitante; se for solicitante, vai pra TI */
export async function notificarNovoComentario(
  chamado: Chamado,
  autor: { nome: string; email?: string | null; eAtendente: boolean },
  mensagem: string,
  interno: boolean,
) {
  if (interno) return // nota interna não vaza pra ninguém

  const numero = formatNumero(chamado.numero)
  const destino = autor.eAtendente
    ? (chamado.solicitante?.email ?? null)
    : TI_INBOX

  if (!destino) return

  const html = shell(
    `Nova mensagem no chamado`,
    `<p style="margin:0 0 12px 0;"><strong>${escape(autor.nome)}</strong> respondeu o chamado <strong>${escape(chamado.titulo)}</strong>.</p>
     ${meta(chamado)}
     <p style="margin:16px 0 6px 0;font-weight:600;">Mensagem</p>
     <div style="border-left:3px solid #0ea5e9;padding-left:12px;color:#1e293b;">${paragrafo(mensagem)}</div>`,
    chamado,
  )

  await sendEmail({
    to: destino,
    subject: `[${numero}] Nova resposta: ${chamado.titulo}`,
    html,
    replyTo: autor.email ?? undefined,
  })
}

/** Mudança de status — avisa o solicitante quando algo relevante muda */
export async function notificarMudancaStatus(chamado: Chamado, novoStatus: StatusChamado) {
  // Notificamos apenas mudanças que importam para o solicitante
  const interessam: StatusChamado[] = ['em_atendimento', 'aguardando_usuario', 'resolvido', 'fechado']
  if (!interessam.includes(novoStatus)) return
  if (!chamado.solicitante?.email) return

  const numero = formatNumero(chamado.numero)
  const titulosPorStatus: Record<StatusChamado, string> = {
    aberto: 'Chamado aberto',
    em_atendimento: 'Seu chamado está em atendimento',
    aguardando_usuario: 'Estamos aguardando uma resposta sua',
    resolvido: 'Seu chamado foi marcado como resolvido',
    fechado: 'Chamado encerrado',
  }
  const mensagensPorStatus: Record<StatusChamado, string> = {
    aberto: '',
    em_atendimento: 'A equipe de TI começou a trabalhar no seu chamado. Você pode acompanhar pelo link abaixo.',
    aguardando_usuario: 'A TI precisa de mais informações pra continuar. Quando puder, abra o chamado e responda a mensagem.',
    resolvido: 'A TI marcou seu chamado como resolvido. Se estiver tudo certo, confirme o fechamento. Se ainda não resolveu, é só reabrir.',
    fechado: 'Seu chamado foi encerrado. Se o problema voltar, abra um novo.',
  }

  const html = shell(
    titulosPorStatus[novoStatus],
    `<p style="margin:0 0 12px 0;">${escape(mensagensPorStatus[novoStatus])}</p>
     ${meta({ ...chamado, status: novoStatus })}`,
    chamado,
  )

  await sendEmail({
    to: chamado.solicitante.email,
    subject: `[${numero}] ${titulosPorStatus[novoStatus]}`,
    html,
  })
}
