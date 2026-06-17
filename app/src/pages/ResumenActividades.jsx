import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmtFecha } from '../lib/fecha'

// Fecha local en formato YYYY-MM-DD (evita el corrimiento de toISOString por UTC)
function fechaLocal(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// ¿La actividad recurrente ocurre en esta fecha?
function ocurreEn(t, fecha) {
  if (t.frecuencia === 'semanal') return fecha.getDay() === t.dia_semana
  if (t.frecuencia === 'mensual') return fecha.getDate() === t.dia_mes
  return true // diaria
}

export default function ResumenActividades() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [periodo, setPeriodo] = useState('dia') // 'dia' | 'mes'
  const [cargando, setCargando] = useState(true)
  const [chooser, setChooser] = useState(false)
  const [resumen, setResumen] = useState({ ejec: 0, pend: 0, ejecutadas: [], pendientes: [] })
  const puedeCrear = perfil?.rol === 'propietario' || perfil?.rol === 'mayordomo'

  useEffect(() => { cargar() }, [periodo]) // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar() {
    setCargando(true)
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const hoyStr = fechaLocal(hoy)
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    const desde = periodo === 'dia' ? hoyStr : fechaLocal(primerDia)
    const finMes = fechaLocal(ultimoDia)
    const finPeriodo = periodo === 'dia' ? hoyStr : finMes

    const [{ data: puntuales }, { data: recurrentes }, { data: comps }] = await Promise.all([
      supabase.from('tareas')
        .select('id,titulo,completada,fecha_vencimiento,fecha_completada,prioridad,fincas(nombre),usuarios!tareas_asignado_a_fkey(nombre)'),
      supabase.from('tareas_recurrentes')
        .select('id,titulo,frecuencia,dia_semana,dia_mes,fincas(nombre),usuarios!tareas_recurrentes_asignado_a_fkey(nombre)')
        .eq('activa', true),
      supabase.from('completaciones_diarias')
        .select('tarea_recurrente_id,fecha').gte('fecha', desde).lte('fecha', finMes),
    ])

    const compSet = new Set((comps ?? []).map(c => `${c.tarea_recurrente_id}_${c.fecha}`))
    const ejecutadas = []
    const pendientes = []
    let totalEjec = 0
    let totalPend = 0

    // ── Puntuales (cada una cuenta como 1) ──
    ;(puntuales ?? []).forEach(t => {
      const base = { tipo: 'puntual', titulo: t.titulo, finca: t.fincas?.nombre, asignado: t.usuarios?.nombre, prioridad: t.prioridad }
      if (t.completada) {
        const fc = t.fecha_completada ? fechaLocal(new Date(t.fecha_completada)) : null
        if (fc && fc >= desde && fc <= finMes) {
          ejecutadas.push({ ...base, key: `p${t.id}`, detalle: `Hecha ${fmtFecha(fc)}` })
          totalEjec++
        }
      } else {
        const v = t.fecha_vencimiento
        if (!v || v <= finPeriodo) {
          const vencida = v && v < hoyStr
          pendientes.push({ ...base, key: `p${t.id}`, detalle: v ? `${vencida ? '⚠️ Venció' : 'Vence'} ${fmtFecha(v)}` : 'Sin fecha límite' })
          totalPend++
        }
      }
    })

    // ── Recurrentes ──
    const fechas = []
    if (periodo === 'dia') {
      fechas.push(new Date(hoy))
    } else {
      for (let d = new Date(primerDia); d <= hoy; d.setDate(d.getDate() + 1)) fechas.push(new Date(d))
    }

    ;(recurrentes ?? []).forEach(t => {
      let esperadas = 0
      let hechas = 0
      fechas.forEach(f => {
        if (!ocurreEn(t, f)) return
        esperadas++
        if (compSet.has(`${t.id}_${fechaLocal(f)}`)) hechas++
      })
      // Ejecuciones anticipadas (fechas futuras del mismo mes)
      if (periodo === 'mes') {
        const anticipadas = (comps ?? []).filter(c => c.tarea_recurrente_id === t.id && c.fecha > hoyStr && c.fecha <= finMes).length
        esperadas += anticipadas
        hechas += anticipadas
      }
      if (esperadas === 0) return // no aplica en el periodo

      const base = { tipo: 'recurrente', titulo: t.titulo, finca: t.fincas?.nombre, asignado: t.usuarios?.nombre }
      totalEjec += hechas
      totalPend += esperadas - hechas

      if (periodo === 'dia') {
        if (hechas >= esperadas) ejecutadas.push({ ...base, key: `r${t.id}`, detalle: 'Hecha hoy' })
        else pendientes.push({ ...base, key: `r${t.id}`, detalle: 'Pendiente hoy' })
      } else {
        const faltan = esperadas - hechas
        if (faltan === 0) ejecutadas.push({ ...base, key: `r${t.id}`, detalle: `${hechas}/${esperadas} días ✓` })
        else pendientes.push({ ...base, key: `r${t.id}`, detalle: `${hechas}/${esperadas} días · faltan ${faltan}` })
      }
    })

    setResumen({ ejec: totalEjec, pend: totalPend, ejecutadas, pendientes })
    setCargando(false)
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Resumen de actividades</h2>
        {puedeCrear && (
          <button onClick={() => setChooser(true)}
            className="bg-verde-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-verde-700 transition">
            + Nueva
          </button>
        )}
      </div>

      {/* Selector de periodo */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {[['dia', 'Hoy'], ['mes', 'Este mes']].map(([v, l]) => (
          <button key={v} onClick={() => setPeriodo(v)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${periodo === v ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-verde-50 border border-verde-200 rounded-2xl p-4 text-center">
          <div className="text-3xl font-black text-verde-700">{cargando ? '—' : resumen.ejec}</div>
          <div className="text-xs text-verde-600 mt-0.5 font-medium">✅ Ejecutadas</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
          <div className="text-3xl font-black text-amber-600">{cargando ? '—' : resumen.pend}</div>
          <div className="text-xs text-amber-600 mt-0.5 font-medium">⏳ Pendientes</div>
        </div>
      </div>

      {cargando ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : (
        <>
          <Seccion titulo="⏳ Pendientes por ejecutar" items={resumen.pendientes} vacio="¡Nada pendiente! 🎉" tono="pend" />
          <Seccion titulo="✅ Ejecutadas" items={resumen.ejecutadas} vacio="Aún nada ejecutado en este periodo" tono="ejec" />
        </>
      )}

      {/* Selector: ¿qué tipo de actividad crear? */}
      {chooser && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setChooser(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800">¿Qué quieres crear?</h3>
            <button onClick={() => navigate('/actividades/puntuales', { state: { nueva: true } })}
              className="w-full text-left border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-verde-400 hover:shadow transition">
              <span className="text-2xl">✅</span>
              <div>
                <div className="font-semibold text-gray-800 text-sm">Actividad puntual</div>
                <div className="text-xs text-gray-500">Una sola vez (ej. reparar una cerca)</div>
              </div>
            </button>
            <button onClick={() => navigate('/actividades/recurrentes', { state: { nueva: true } })}
              className="w-full text-left border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-verde-400 hover:shadow transition">
              <span className="text-2xl">🔄</span>
              <div>
                <div className="font-semibold text-gray-800 text-sm">Actividad recurrente</div>
                <div className="text-xs text-gray-500">Se repite (diaria, semanal o mensual)</div>
              </div>
            </button>
            <button onClick={() => setChooser(false)}
              className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg text-sm mt-1">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Seccion({ titulo, items, vacio, tono }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1 pt-2">{titulo}</p>
      {items.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">{vacio}</p>
      ) : (
        items.map(i => (
          <div key={i.key}
            className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-3 ${tono === 'ejec' ? 'border-verde-100' : 'border-gray-200'}`}>
            <span className="text-lg">{i.tipo === 'recurrente' ? '🔄' : '✅'}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${tono === 'ejec' ? 'text-gray-500' : 'text-gray-800'}`}>{i.titulo}</p>
              <p className="text-xs text-gray-400">
                {[i.finca, i.asignado, i.detalle].filter(Boolean).join(' · ')}
              </p>
            </div>
            {i.tipo === 'recurrente' && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 whitespace-nowrap">recurrente</span>
            )}
          </div>
        ))
      )}
    </div>
  )
}
