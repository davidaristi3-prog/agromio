import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtFecha } from '../lib/fecha'
import { Milk, Syringe, Microscope, Zap, ClipboardCheck, CheckCircle2, XCircle } from '../components/icons'

const FILTROS = ['Todos', 'Aprobados', 'Rechazados']

const TABLA_META = {
  ordenos:              { label: 'Ordeño',       icon: Milk },
  eventos_sanitarios:   { label: 'Sanidad',       icon: Syringe },
  eventos_reproductivos:{ label: 'Reproducción',  icon: Microscope },
  reportes_trabajador:  { label: 'Reporte',       icon: Zap },
}

export default function HistorialAprobaciones() {
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('Todos')

  useEffect(() => {
    async function cargar() {
      setCargando(true)

      const estados = ['aprobado', 'rechazado']
      const opts = { ascending: false }

      const [ord, san, rep, rpt] = await Promise.all([
        supabase.from('ordenos')
          .select('id,fecha,litros,estado,comentario_rechazo,creado_por,aprobado_por')
          .in('estado', estados).order('created_at', opts).limit(100),
        supabase.from('eventos_sanitarios')
          .select('id,fecha,tipo,diagnostico,estado,comentario_rechazo,creado_por,aprobado_por')
          .in('estado', estados).order('created_at', opts).limit(100),
        supabase.from('eventos_reproductivos')
          .select('id,fecha,tipo,estado,comentario_rechazo,creado_por,aprobado_por')
          .in('estado', estados).order('created_at', opts).limit(100),
        supabase.from('reportes_trabajador')
          .select('id,fecha,titulo,descripcion,estado,comentario_rechazo,creado_por,aprobado_por')
          .in('estado', estados).order('created_at', opts).limit(100),
      ])

      // Resolver nombres de usuarios
      const allRows = [...(ord.data??[]),...(san.data??[]),...(rep.data??[]),...(rpt.data??[])]
      const userIds = [...new Set(allRows.flatMap(r => [r.creado_por, r.aprobado_por]).filter(Boolean))]
      let userMap = {}
      if (userIds.length) {
        const { data: usuarios } = await supabase.from('usuarios').select('id,nombre').in('id', userIds)
        userMap = Object.fromEntries((usuarios ?? []).map(u => [u.id, u.nombre]))
      }

      const mapear = (rows, _tabla, desc) => (rows ?? []).map(r => ({
        id: r.id, fecha: r.fecha, _tabla,
        _desc: desc(r),
        estado: r.estado,
        comentario_rechazo: r.comentario_rechazo,
        creado_por_nombre: userMap[r.creado_por] ?? '—',
        aprobado_por_nombre: userMap[r.aprobado_por] ?? '—',
      }))

      const lista = [
        ...mapear(ord.data, 'ordenos', r => `Ordeño — ${Number(r.litros).toFixed(1)} L`),
        ...mapear(san.data, 'eventos_sanitarios', r => `Sanidad: ${r.tipo}${r.diagnostico ? ` — ${r.diagnostico}` : ''}`),
        ...mapear(rep.data, 'eventos_reproductivos', r => `Reproducción: ${r.tipo}`),
        ...mapear(rpt.data, 'reportes_trabajador', r => `${r.titulo}${r.descripcion ? ` — ${r.descripcion}` : ''}`),
      ].sort((a, b) => b.fecha.localeCompare(a.fecha))

      setItems(lista)
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
      ) : lista.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">Sin registros</p>
      ) : (
        <div className="space-y-2">
          {lista.map(item => {
            const meta = TABLA_META[item._tabla] ?? { label: item._tabla, icon: ClipboardCheck }
            const MetaIcon = meta.icon
            return (
              <div key={`${item._tabla}-${item.id}`}
                className="bg-white border border-gray-200 rounded-2xl px-4 py-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MetaIcon size={20} className="flex-shrink-0 text-gray-600" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{item._desc}</p>
                      <p className="text-xs text-gray-400">{meta.label} · {fmtFecha(item.fecha)}</p>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                    item.estado === 'aprobado' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {item.estado === 'aprobado'
                      ? <><CheckCircle2 size={14} /> Aprobado</>
                      : <><XCircle size={14} /> Rechazado</>}
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
            )
          })}
        </div>
      )}
    </div>
  )
}
