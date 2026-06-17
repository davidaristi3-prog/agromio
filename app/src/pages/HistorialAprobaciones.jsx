import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtFecha } from '../lib/fecha'

const FILTROS = ['Todos', 'Aprobados', 'Rechazados']
const TABLA_LABEL = {
  ordenos: 'Ordeño',
  eventos_sanitarios: 'Sanidad',
  eventos_reproductivos: 'Reproducción',
}
const TABLA_ICON = {
  ordenos: '🥛',
  eventos_sanitarios: '💉',
  eventos_reproductivos: '🔬',
}

export default function HistorialAprobaciones() {
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('Todos')
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      const { data, error: fnErr } = await supabase.functions.invoke('get-historial')
      if (fnErr || data?.error) {
        setError(data?.error ?? fnErr?.message ?? 'Error al cargar')
      } else {
        setItems(data?.items ?? [])
      }
      setCargando(false)
    }
    cargar()
  }, [])

  const lista = items.filter(i => {
    if (filtro === 'Aprobados') return i.estado === 'aprobado'
    if (filtro === 'Rechazados') return i.estado === 'rechazado'
    return true
  })

  return (
    <div className="space-y-4 pt-2">
      <h2 className="text-xl font-bold text-gray-800">Historial de aprobaciones</h2>

      {/* Filtros */}
      <div className="flex gap-2">
        {FILTROS.map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filtro === f ? 'bg-verde-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {cargando ? (
        <p className="text-gray-400 text-sm text-center py-8">Cargando...</p>
      ) : error ? (
        <p className="text-red-500 text-sm text-center py-8">{error}</p>
      ) : lista.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">Sin registros</p>
      ) : (
        <div className="space-y-2">
          {lista.map(item => (
            <div key={`${item._tabla}-${item.id}`}
              className="bg-white border border-gray-200 rounded-2xl px-4 py-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xl flex-shrink-0">{TABLA_ICON[item._tabla]}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{item._desc}</p>
                    <p className="text-xs text-gray-400">{TABLA_LABEL[item._tabla]} · {fmtFecha(item.fecha)}</p>
                  </div>
                </div>
                <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
                  item.estado === 'aprobado'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-600'
                }`}>
                  {item.estado === 'aprobado' ? '✓ Aprobado' : '✕ Rechazado'}
                </span>
              </div>

              <div className="flex gap-4 text-xs text-gray-500 pl-8">
                {item.creado_por_nombre !== '—' && (
                  <span>Registrado por <strong>{item.creado_por_nombre}</strong></span>
                )}
                {item.aprobado_por_nombre !== '—' && (
                  <span>{item.estado === 'aprobado' ? 'Aprobado' : 'Rechazado'} por <strong>{item.aprobado_por_nombre}</strong></span>
                )}
              </div>

              {item.comentario_rechazo && (
                <div className="ml-8 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5 text-xs text-red-600">
                  Motivo: {item.comentario_rechazo}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
