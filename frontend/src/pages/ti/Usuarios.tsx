// Gestão de usuários do módulo de TI — porte da tela Users.tsx do Helpdesk TEG.
// Lista todos os perfis do TEG+ (sys_perfis). O "Papel" gerido aqui é o de TI:
// Requerente ↔ Agente (tabela ti_atendentes). "Admin" é papel global do TEG+
// (somente leitura aqui). As ações Desativar/Anonimizar NÃO são expostas: agiriam
// sobre o cadastro global do funcionário (sys_perfis), fora do escopo do módulo TI.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listAllUsers, setUserTiRole } from './data/users'
import type { ManagedUser, Role } from './data/shapes'
import { useTiAuth } from './data/auth'
import { PageHeader, Spinner } from './components/ui'
import { Avatar } from './components/Avatar'

const ROLES: Role[] = ['REQUERENTE', 'AGENTE', 'ADMIN']
const ROLE_LABEL: Record<Role, string> = { REQUERENTE: 'Requerente', AGENTE: 'Agente', ADMIN: 'Admin' }

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

export default function Usuarios() {
  const { user: me } = useTiAuth()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['ti', 'users'], queryFn: listAllUsers })

  const mutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      setUserTiRole(id, role, { id: me?.id ?? '', name: me?.name ?? '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ti', 'users'] }),
    onError: (e) => window.alert(e instanceof Error ? e.message : 'Não foi possível alterar o papel.'),
  })

  return (
    <div className="ti-scope">
      <PageHeader title="Usuários" subtitle="Papéis e acesso da equipe" />
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Papel</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Desde</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data ?? []).map((u) => {
                  const isMe = u.id === me?.id
                  const isAdmin = u.role === 'ADMIN'
                  const locked = isMe || isAdmin
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} size="sm" />
                          <div>
                            <div className="font-medium text-slate-700">
                              {u.name}
                              {isMe && <span className="ml-2 text-xs text-slate-400">(você)</span>}
                            </div>
                            <div className="text-xs text-slate-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="input w-auto"
                          value={u.role}
                          disabled={locked}
                          title={isAdmin ? 'Administrador é um papel global do TEG+ — gerido fora do módulo de TI' : undefined}
                          onChange={(e) => mutation.mutate({ id: u.id, role: e.target.value as Role })}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r} disabled={r === 'ADMIN'}>{ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {u.active
                          ? <span className="text-xs font-medium text-emerald-600">Ativo</span>
                          : <span className="text-xs font-medium text-red-600">Inativo</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(u.createdAt)}</td>
                      <td className="px-4 py-3 text-right" />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
