import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import NovaRequisicao from './pages/NovaRequisicao'
import ListaRequisicoes from './pages/ListaRequisicoes'
import Aprovacao from './pages/Aprovacao'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/nova" element={<NovaRequisicao />} />
        <Route path="/requisicoes" element={<ListaRequisicoes />} />
        <Route path="/perfil" element={<div className="text-center text-gray-500 mt-10">Perfil em breve</div>} />
      </Route>
      <Route path="/aprovacao/:token" element={<Aprovacao />} />
    </Routes>
  )
}
