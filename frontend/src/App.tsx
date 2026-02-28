import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import NovaRequisicao from './pages/NovaRequisicao'
import ListaRequisicoes from './pages/ListaRequisicoes'
import FilaCotacoes from './pages/FilaCotacoes'
import CotacaoForm from './pages/CotacaoForm'
import Aprovacao from './pages/Aprovacao'
import AprovAi from './pages/AprovAi'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/nova" element={<NovaRequisicao />} />
        <Route path="/requisicoes" element={<ListaRequisicoes />} />
        <Route path="/cotacoes" element={<FilaCotacoes />} />
        <Route path="/cotacoes/:id" element={<CotacaoForm />} />
        <Route path="/perfil" element={<div className="text-center text-gray-500 mt-10">Perfil em breve</div>} />
      </Route>
      <Route path="/aprovaai" element={<AprovAi />} />
      <Route path="/aprovacao/:token" element={<Aprovacao />} />
    </Routes>
  )
}
