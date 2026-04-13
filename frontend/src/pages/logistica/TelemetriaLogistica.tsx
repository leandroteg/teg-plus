import { useState } from 'react'
import AlertasTelemetria from '../../components/logistica/telemetria/AlertasTelemetria'
import KmUtilizacao from '../../components/logistica/telemetria/KmUtilizacao'

export default function TelemetriaLogistica() {
  const [tab, setTab] = useState('alertas')

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>Telemetria</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setTab('alertas')} style={{ padding: '8px 16px', fontWeight: tab === 'alertas' ? 'bold' : 'normal' }}>Alertas</button>
        <button onClick={() => setTab('km')} style={{ padding: '8px 16px', fontWeight: tab === 'km' ? 'bold' : 'normal' }}>KM</button>
        <button onClick={() => setTab('mapa')} style={{ padding: '8px 16px', fontWeight: tab === 'mapa' ? 'bold' : 'normal' }}>Mapa</button>
      </div>
      {tab === 'alertas' && <AlertasTelemetria />}
      {tab === 'km' && <KmUtilizacao />}
      {tab === 'mapa' && <p>Mapa carregou sem erro</p>}
    </div>
  )
}
