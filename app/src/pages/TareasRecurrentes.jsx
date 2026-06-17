import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function labelFrecuencia(t) {
  if (t.frecuencia === 'semanal') return `Todos los ${DIAS_SEMANA[t.dia_semana] ?? ''}`
  if (t.frecuencia === 'mensual') return `Día ${t.dia_mes} de cada mes`
  return 'Todos los días'
}

function proximaFecha(t) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  if (t.frecuencia === 'mensual') {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), t.dia_mes)
    if (d < hoy) d.setMonth(d.getMonth() + 1)
    return d.toISOString().split('T')[0]
  }
  if (t.frecuencia === 'semanal') {
    const diff = (t.dia_semana - hoy.getDay() + 7) % 7
    const d = new Date(hoy)
    d.setDate(hoy.getDate() + diff)
    return d.toISOString().split('T')[0]
  }
  return hoy.toISOString().split('T')[0]
}

async function notificarCompletacion(tarea, trabajador) {
  try {
    const receptores = []
    const { data: props } = await supabase.from('usuarios').select('id').eq('rol', 'propietario')
    props?.forEach(p => receptores.push(p.id))
    if (tarea.finca_id) {
      const { data: asig } = await supabase.from('asignaciones_finca').select('usuario_id').eq('finca_id', tarea.finca_id)
      asig?.forEach(a => { if (!receptores.includes(a.usuario_id)) receptores.push(a.usuario_id) })
    }
    for (const uid of receptores.filter(id => id !== trabajador.id)) {
      await supabase.functions.invoke('notificar-tarea', {
        body: {
          asignado_a: uid,
          titulo: '✅ Actividad completada',
          descripcion: `${trabajador.nombre} completó: ${tarea.titulo}`,
        },
      })
    }
  } catch {}
}

export default function TareasRecurrentes() {
  const { perfil } = useAuth()
  const [vista, setVista] = useState('hoy')

  if (perfil?.rol === 'trabajador') return <VistaTrabajador perfil={perfil} />

  return (
    <div className="space-y-4 pt-2">
      <h2 className="text-xl font-bold text-gray-800">Actividades recurrentes</h2>
      <div className="flex bg-gray-100 rounded-xl p-1">
        {[['hoy', 'Hoy'], ['gestionar', 'Gestionar']].map(([v, l]) => (
          <button key={v} onClick={() => setVista(v)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${vista === v ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
            {l}
          </button>
        ))}
      </div>
      {vista === 'hoy' ? <VistaHoyGestor /> : <VistaGestionar perfil={perfil} />}
    </div>
  )
}

// ─── Vista trabajador ───────────────────────────────────────────────────────
function VistaTrabajador({ perfil }) {
  const hoy = new Date().toISOString().split('T')[0]
  const [tareas, setTareas] = useState([])
  const [completadas, setCompletadas] = useState({})
  const [cargando, setCargando] = useState(true)
  const [modalTarea, setModalTarea] = useState(null)
  const [evidenciaModal, setEvidenciaModal] = useState(null)
  const [modalReporte, setModalReporte] = useState(false)
  const [reportes, setReportes] = useState([])
  const [fincas, setFincas] = useState([])

  async function cargarReportes() {
    const { data } = await supabase.from('reportes_trabajador')
      .select('id,titulo,descripcion,fecha,estado,comentario_rechazo,fincas(nombre)')
      .eq('creado_por', perfil.id)
      .order('created_at', { ascending: false })
      .limit(10)
    setReportes(data ?? [])
  }

  async function cargar() {
    setCargando(true)
    const { data: ts } = await supabase.from('tareas_recurrentes')
      .select('id,titulo,descripcion,finca_id,fincas(nombre),frecuencia,dia_semana,dia_mes')
      .eq('asignado_a', perfil.id).eq('activa', true).order('created_at')
    const ids = ts?.map(t => t.id) ?? []
    let comp = {}
    if (ids.length > 0) {
      // Fetch completaciones para los próximos 31 días (cubre tareas mensuales anticipadas)
      const limite = new Date(); limite.setDate(limite.getDate() + 31)
      const { data: cs } = await supabase.from('completaciones_diarias')
        .select('id,tarea_recurrente_id,fecha,foto_url,audio_url,nota')
        .in('tarea_recurrente_id', ids)
        .gte('fecha', hoy)
        .lte('fecha', limite.toISOString().split('T')[0])
      // Clave: id_tarea + fecha objetivo
      cs?.forEach(c => { comp[`${c.tarea_recurrente_id}_${c.fecha}`] = c })
    }
    setTareas(ts ?? [])
    setCompletadas(comp)
    setCargando(false)
  }

  useEffect(() => {
    cargar()
    cargarReportes()
    supabase.from('fincas').select('id,nombre').eq('activa', true).order('nombre')
      .then(({ data }) => setFincas(data ?? []))
  }, [perfil?.id])

  const tareasHoy = tareas.filter(t => proximaFecha(t) === hoy)
  const tareasProximas = tareas.filter(t => proximaFecha(t) > hoy)

  const hechasHoy = tareasHoy.filter(t => completadas[`${t.id}_${hoy}`])
  const pendientesHoy = tareasHoy.filter(t => !completadas[`${t.id}_${hoy}`])

  function keyComp(t) { return `${t.id}_${proximaFecha(t)}` }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Mis actividades de hoy</h2>
        {tareasHoy.length > 0 && (
          <span className="text-sm text-gray-500">{hechasHoy.length}/{tareasHoy.length} hechas</span>
        )}
      </div>

      {tareasHoy.length > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div className="bg-verde-600 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${(hechasHoy.length / tareasHoy.length) * 100}%` }} />
        </div>
      )}

      {cargando ? <p className="text-gray-400 text-sm">Cargando...</p> : tareas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-400 text-sm">No tienes actividades asignadas</p>
        </div>
      ) : (
        <>
          {/* Tareas de hoy */}
          {tareasHoy.length > 0 && (
            <div className="space-y-2">
              {hechasHoy.length === tareasHoy.length && (
                <div className="bg-verde-50 border border-verde-200 rounded-2xl p-5 text-center">
                  <p className="text-4xl mb-2">🎉</p>
                  <p className="text-verde-800 font-bold text-sm">¡Todas las actividades de hoy completadas!</p>
                </div>
              )}
              {pendientesHoy.map(t => (
                <button key={t.id} onClick={() => setModalTarea({ ...t, _targetFecha: hoy })}
                  className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-4 flex items-center gap-3 text-left shadow-sm active:bg-gray-50 transition">
                  <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{t.titulo}</p>
                    {t.descripcion && <p className="text-xs text-gray-500 mt-0.5">{t.descripcion}</p>}
                    {t.fincas?.nombre && <p className="text-xs text-gray-400">{t.fincas.nombre}</p>}
                  </div>
                  <span className="text-verde-600 text-sm font-medium whitespace-nowrap">Completar ›</span>
                </button>
              ))}
              {hechasHoy.map(t => {
                const c = completadas[`${t.id}_${hoy}`]
                return (
                  <div key={t.id} className="bg-verde-50 border border-verde-200 rounded-2xl px-4 py-4 flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-verde-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-verde-800 line-through">{t.titulo}</p>
                      {t.fincas?.nombre && <p className="text-xs text-verde-600">{t.fincas.nombre}</p>}
                    </div>
                    {(c?.foto_url || c?.audio_url || c?.nota) && (
                      <button onClick={() => setEvidenciaModal(c)}
                        className="text-xs text-verde-600 font-medium whitespace-nowrap">Ver evidencia</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Tareas próximas */}
          {tareasProximas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1 pt-2">Próximas</p>
              {tareasProximas.map(t => {
                const target = proximaFecha(t)
                const comp = completadas[keyComp(t)]
                const [y, m, d] = target.split('-')
                const etiqueta = `${d}/${m}/${y}`
                return comp ? (
                  <div key={t.id} className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-4 flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-800 line-through">{t.titulo}</p>
                      <p className="text-xs text-blue-500">Anticipada · {etiqueta}</p>
                    </div>
                    {(comp.foto_url || comp.audio_url || comp.nota) && (
                      <button onClick={() => setEvidenciaModal(comp)}
                        className="text-xs text-blue-600 font-medium whitespace-nowrap">Ver evidencia</button>
                    )}
                  </div>
                ) : (
                  <button key={t.id} onClick={() => setModalTarea({ ...t, _targetFecha: target })}
                    className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-4 flex items-center gap-3 text-left shadow-sm active:bg-gray-50 transition opacity-80">
                    <div className="w-6 h-6 rounded-full border-2 border-gray-200 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-700">{t.titulo}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{labelFrecuencia(t)} · próxima: {etiqueta}</p>
                    </div>
                    <span className="text-gray-400 text-sm font-medium whitespace-nowrap">Adelantar ›</span>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

          {/* Mis reportes extraordinarios */}
          {reportes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1 pt-2">Mis reportes</p>
              {reportes.map(r => {
                const [y, m, d] = r.fecha.split('-')
                const badge =
                  r.estado === 'aprobado'  ? 'bg-verde-100 text-verde-700' :
                  r.estado === 'rechazado' ? 'bg-red-100 text-red-600' :
                  'bg-amber-100 text-amber-700'
                const label =
                  r.estado === 'aprobado'  ? 'Aprobado' :
                  r.estado === 'rechazado' ? 'Rechazado' :
                  'Pendiente'
                return (
                  <div key={r.id} className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-lg mt-0.5">⚡</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{r.titulo}</p>
                        {r.descripcion && <p className="text-xs text-gray-500 mt-0.5">{r.descripcion}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">{d}/{m}/{y}{r.fincas?.nombre ? ` · ${r.fincas.nombre}` : ''}</p>
                        {r.estado === 'rechazado' && r.comentario_rechazo && (
                          <p className="text-xs text-red-500 mt-1">Motivo: {r.comentario_rechazo}</p>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${badge}`}>{label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

      {/* Botón flotante reportar */}
      <button onClick={() => setModalReporte(true)}
        className="fixed bottom-24 right-4 bg-orange-500 text-white rounded-full shadow-lg flex items-center gap-2 px-4 py-3 text-sm font-bold z-40 active:bg-orange-600 transition">
        <span className="text-lg leading-none">⚡</span> Reportar actividad
      </button>

      {modalTarea && (
        <ModalCompletar
          tarea={modalTarea} perfil={perfil} targetFecha={modalTarea._targetFecha}
          onClose={() => setModalTarea(null)}
          onCompletada={() => { setModalTarea(null); cargar() }}
        />
      )}
      {evidenciaModal && <ModalEvidencia completacion={evidenciaModal} onClose={() => setEvidenciaModal(null)} />}
      {modalReporte && (
        <ModalReporte
          perfil={perfil} fincas={fincas} hoy={hoy}
          onClose={() => setModalReporte(false)}
          onGuardado={() => { setModalReporte(false); cargarReportes() }}
        />
      )}
    </div>
  )
}

// ─── Modal completar tarea ──────────────────────────────────────────────────
function ModalCompletar({ tarea, perfil, targetFecha, onClose, onCompletada }) {
  const hoy = targetFecha
  const [foto, setFoto] = useState(null)
  const [audio, setAudio] = useState(null)
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [fotoPreview, setFotoPreview] = useState(null)

  function onFoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFoto(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  async function guardar() {
    setGuardando(true)
    let foto_url = null
    let audio_url = null

    if (foto) {
      const ext = foto.name.split('.').pop()
      const path = `recurrentes/${tarea.id}/${hoy}_${perfil.id}.${ext}`
      await supabase.storage.from('evidencias').upload(path, foto, { upsert: true })
      const { data } = supabase.storage.from('evidencias').getPublicUrl(path)
      foto_url = data.publicUrl
    }
    if (audio) {
      const ext = audio.name.split('.').pop()
      const path = `recurrentes/${tarea.id}/${hoy}_${perfil.id}.${ext}`
      await supabase.storage.from('notas-voz').upload(path, audio, { upsert: true })
      const { data } = supabase.storage.from('notas-voz').getPublicUrl(path)
      audio_url = data.publicUrl
    }

    await supabase.from('completaciones_diarias').insert({
      tarea_recurrente_id: tarea.id,
      fecha: hoy,
      completado_por: perfil.id,
      foto_url,
      audio_url,
      nota: nota || null,
    })

    await notificarCompletacion(tarea, perfil)
    setGuardando(false)
    onCompletada()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800">Completar: {tarea.titulo}</h3>

        {/* Foto */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Foto evidencia</label>
          {fotoPreview ? (
            <div className="relative">
              <img src={fotoPreview} className="w-full h-44 object-cover rounded-xl" />
              <button onClick={() => { setFoto(null); setFotoPreview(null) }}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">×</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl h-28 cursor-pointer bg-gray-50 active:bg-gray-100">
              <span className="text-2xl mb-1">📷</span>
              <span className="text-sm text-gray-500">Tomar foto o elegir del carrete</span>
              <input type="file" accept="image/*" onChange={onFoto} className="hidden" />
            </label>
          )}
        </div>

        {/* Audio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Nota de voz</label>
          {audio ? (
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
              <span className="text-xl">🎙️</span>
              <span className="text-sm text-gray-600 flex-1 truncate">{audio.name}</span>
              <button onClick={() => setAudio(null)} className="text-red-400 text-sm font-medium">Quitar</button>
            </div>
          ) : (
            <label className="flex items-center gap-3 border border-gray-300 rounded-xl px-4 py-3 cursor-pointer bg-gray-50 active:bg-gray-100">
              <span className="text-xl">🎙️</span>
              <span className="text-sm text-gray-500">Adjuntar nota de voz</span>
              <input type="file" accept="audio/*" onChange={e => setAudio(e.target.files?.[0] ?? null)} className="hidden" />
            </label>
          )}
        </div>

        {/* Nota */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observación (opcional)</label>
          <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2}
            placeholder="¿Algo que reportar?"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500 resize-none" />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm">Cancelar</button>
          <button onClick={guardar} disabled={guardando}
            className="flex-1 bg-verde-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
            {guardando ? 'Guardando...' : '✓ Marcar como hecha'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal reportar actividad extraordinaria ────────────────────────────────
function ModalReporte({ perfil, fincas, hoy, onClose, onGuardado }) {
  const [form, setForm] = useState({ titulo: '', descripcion: '', finca_id: '', fecha: hoy })
  const [foto, setFoto] = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function onFoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFoto(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  async function guardar(e) {
    e.preventDefault()
    if (!form.titulo.trim()) { setError('El título es obligatorio'); return }
    setGuardando(true)
    setError('')

    let foto_url = null
    if (foto) {
      const ext = foto.name.split('.').pop()
      const path = `reportes/${perfil.id}/${form.fecha}_${Date.now()}.${ext}`
      await supabase.storage.from('evidencias').upload(path, foto, { upsert: true })
      const { data } = supabase.storage.from('evidencias').getPublicUrl(path)
      foto_url = data.publicUrl
    }

    const { error: err } = await supabase.from('reportes_trabajador').insert({
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      fecha: form.fecha,
      finca_id: form.finca_id || null,
      foto_url,
      creado_por: perfil.id,
    })

    setGuardando(false)
    if (err) { setError(err.message); return }
    onGuardado()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <h3 className="font-bold text-gray-800">Reportar actividad extraordinaria</h3>
        </div>
        {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={guardar} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">¿Qué hiciste? *</label>
            <input required value={form.titulo} onChange={e => setForm(f => ({...f, titulo: e.target.value}))}
              placeholder="ej: Arreglé fuga de agua en el potrero 2"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (detalles)</label>
            <textarea value={form.descripcion} onChange={e => setForm(f => ({...f, descripcion: e.target.value}))} rows={2}
              placeholder="Más detalles de lo que pasó o cómo lo resolviste..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm(f => ({...f, fecha: e.target.value}))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Finca</label>
              <select value={form.finca_id} onChange={e => setForm(f => ({...f, finca_id: e.target.value}))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="">Sin finca</option>
                {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Foto evidencia</label>
            {fotoPreview ? (
              <div className="relative">
                <img src={fotoPreview} className="w-full h-40 object-cover rounded-xl" />
                <button type="button" onClick={() => { setFoto(null); setFotoPreview(null) }}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">×</button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl h-24 cursor-pointer bg-gray-50">
                <span className="text-xl mb-1">📷</span>
                <span className="text-xs text-gray-500">Adjuntar foto (opcional)</span>
                <input type="file" accept="image/*" onChange={onFoto} className="hidden" />
              </label>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm">Cancelar</button>
            <button type="submit" disabled={guardando}
              className="flex-1 bg-orange-500 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
              {guardando ? 'Enviando...' : '⚡ Enviar reporte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal ver evidencia ────────────────────────────────────────────────────
function ModalEvidencia({ completacion, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800">Evidencia</h3>
        {completacion.foto_url && (
          <img src={completacion.foto_url} className="w-full rounded-xl object-cover max-h-72" />
        )}
        {completacion.audio_url && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Nota de voz</p>
            <audio controls src={completacion.audio_url} className="w-full" />
          </div>
        )}
        {completacion.nota && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Observación</p>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2">{completacion.nota}</p>
          </div>
        )}
        {!completacion.foto_url && !completacion.audio_url && !completacion.nota && (
          <p className="text-sm text-gray-400 text-center py-4">Sin evidencia adjunta</p>
        )}
        <button onClick={onClose} className="w-full border border-gray-300 text-gray-700 py-3 rounded-xl text-sm">Cerrar</button>
      </div>
    </div>
  )
}

// ─── Vista gestor: ver cumplimiento hoy ────────────────────────────────────
function VistaHoyGestor() {
  const hoy = new Date().toISOString().split('T')[0]
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [evidenciaModal, setEvidenciaModal] = useState(null)

  useEffect(() => {
    async function cargar() {
      const { data: tareas } = await supabase.from('tareas_recurrentes')
        .select('id,titulo,asignado_a,finca_id,usuarios!tareas_recurrentes_asignado_a_fkey(nombre)')
        .eq('activa', true).order('created_at')
      if (!tareas?.length) { setCargando(false); return }

      const { data: completaciones } = await supabase.from('completaciones_diarias')
        .select('id,tarea_recurrente_id,foto_url,audio_url,nota')
        .in('tarea_recurrente_id', tareas.map(t => t.id)).eq('fecha', hoy)

      const compMap = {}
      completaciones?.forEach(c => { compMap[c.tarea_recurrente_id] = c })

      const porTrabajador = {}
      tareas.forEach(t => {
        const uid = t.asignado_a
        const nombre = t.usuarios?.nombre ?? 'Sin asignar'
        if (!porTrabajador[uid]) porTrabajador[uid] = { nombre, tareas: [] }
        porTrabajador[uid].tareas.push({ ...t, completacion: compMap[t.id] ?? null })
      })
      setDatos(Object.values(porTrabajador))
      setCargando(false)
    }
    cargar()
  }, [])

  if (cargando) return <p className="text-gray-400 text-sm">Cargando...</p>
  if (datos.length === 0) return (
    <div className="text-center py-12">
      <p className="text-4xl mb-3">📋</p>
      <p className="text-gray-400 text-sm">No hay actividades recurrentes asignadas</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {datos.map(({ nombre, tareas }) => {
        const hechas = tareas.filter(t => t.completacion).length
        const todas = tareas.length
        return (
          <div key={nombre} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="font-semibold text-gray-800 text-sm">{nombre}</p>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                hechas === todas ? 'bg-verde-100 text-verde-700' : 'bg-gray-100 text-gray-500'
              }`}>{hechas}/{todas}</span>
            </div>
            <div className="w-full bg-gray-100 h-1.5">
              <div className="bg-verde-500 h-1.5 transition-all" style={{ width: `${todas > 0 ? (hechas / todas) * 100 : 0}%` }} />
            </div>
            <div className="divide-y divide-gray-50">
              {tareas.map(t => (
                <div key={t.id} className="px-4 py-3 flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    t.completacion ? 'bg-verde-600' : 'border-2 border-gray-300'
                  }`}>
                    {t.completacion && <span className="text-white text-[10px] font-bold">✓</span>}
                  </div>
                  <p className={`text-sm flex-1 ${t.completacion ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{t.titulo}</p>
                  {t.completacion && (t.completacion.foto_url || t.completacion.audio_url || t.completacion.nota) && (
                    <button onClick={() => setEvidenciaModal(t.completacion)}
                      className="text-xs text-verde-600 font-medium">Ver</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {evidenciaModal && <ModalEvidencia completacion={evidenciaModal} onClose={() => setEvidenciaModal(null)} />}
    </div>
  )
}

// ─── Vista gestionar: CRUD ──────────────────────────────────────────────────
function VistaGestionar({ perfil }) {
  const [tareas, setTareas] = useState([])
  const [trabajadores, setTrabajadores] = useState([])
  const [fincas, setFincas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')
  const [form, setForm] = useState({ titulo: '', descripcion: '', asignado_a: '', finca_id: '', frecuencia: 'diaria', dia_semana: 1, dia_mes: 1 })

  async function cargar() {
    setCargando(true)
    const [{ data: ts }, { data: ws }, { data: fs }] = await Promise.all([
      supabase.from('tareas_recurrentes')
        .select('id,titulo,descripcion,asignado_a,frecuencia,dia_semana,dia_mes,usuarios!tareas_recurrentes_asignado_a_fkey(nombre),fincas(nombre)')
        .eq('activa', true).order('created_at'),
      supabase.from('usuarios').select('id,nombre').in('rol', ['trabajador', 'mayordomo']).order('nombre'),
      supabase.from('fincas').select('id,nombre').eq('activa', true).order('nombre'),
    ])
    setTareas(ts ?? [])
    setTrabajadores(ws ?? [])
    setFincas(fs ?? [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    setErrorForm('')
    const { error } = await supabase.from('tareas_recurrentes').insert({
      titulo: form.titulo,
      descripcion: form.descripcion || null,
      asignado_a: form.asignado_a || null,
      finca_id: form.finca_id || null,
      creado_por: perfil.id,
      frecuencia: form.frecuencia,
      dia_semana: form.frecuencia === 'semanal' ? Number(form.dia_semana) : null,
      dia_mes: form.frecuencia === 'mensual' ? Number(form.dia_mes) : null,
      activa: true,
    })
    setGuardando(false)
    if (error) { setErrorForm(error.message); return }
    setModal(false)
    setForm({ titulo: '', descripcion: '', asignado_a: '', finca_id: '', frecuencia: 'diaria', dia_semana: 1, dia_mes: 1 })
    cargar()
  }

  async function desactivar(id) {
    await supabase.from('tareas_recurrentes').update({ activa: false }).eq('id', id)
    cargar()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModal(true)}
          className="bg-verde-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-verde-700 transition">
          + Nueva actividad
        </button>
      </div>

      {cargando ? <p className="text-gray-400 text-sm">Cargando...</p> : tareas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🔄</p>
          <p className="text-gray-400 text-sm">No hay actividades recurrentes</p>
          <p className="text-xs text-gray-300 mt-1">Crea actividades que se repiten cada día</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tareas.map(t => (
            <div key={t.id} className="bg-white rounded-2xl px-4 py-3.5 border border-gray-100 shadow-sm flex items-start gap-3">
              <span className="text-xl mt-0.5">🔄</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{t.titulo}</p>
                <p className="text-xs text-gray-500">{t.usuarios?.nombre ?? '—'}{t.fincas?.nombre ? ` · ${t.fincas.nombre}` : ''}</p>
                {t.descripcion && <p className="text-xs text-gray-400 mt-0.5">{t.descripcion}</p>}
                <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{labelFrecuencia(t)}</span>
              </div>
              <button onClick={() => desactivar(t.id)}
                className="text-gray-300 hover:text-red-400 text-2xl leading-none flex-shrink-0 transition">×</button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setModal(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800">Nueva actividad recurrente</h3>
            {errorForm && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-600">{errorForm}</div>
            )}
            <form onSubmit={guardar} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input required value={form.titulo} onChange={e => setForm(f => ({...f, titulo: e.target.value}))}
                  placeholder="ej: Lavar el corral"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input value={form.descripcion} onChange={e => setForm(f => ({...f, descripcion: e.target.value}))}
                  placeholder="Detalles opcionales"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a *</label>
                <select required value={form.asignado_a} onChange={e => setForm(f => ({...f, asignado_a: e.target.value}))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
                  <option value="">Selecciona...</option>
                  {trabajadores.map(w => <option key={w.id} value={w.id}>{w.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Finca</label>
                <select value={form.finca_id} onChange={e => setForm(f => ({...f, finca_id: e.target.value}))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
                  <option value="">Sin finca específica</option>
                  {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia *</label>
                <select value={form.frecuencia} onChange={e => setForm(f => ({...f, frecuencia: e.target.value}))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
                  <option value="diaria">Todos los días</option>
                  <option value="semanal">Semanal (un día a la semana)</option>
                  <option value="mensual">Mensual (una vez al mes)</option>
                </select>
              </div>
              {form.frecuencia === 'semanal' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Día de la semana *</label>
                  <select value={form.dia_semana} onChange={e => setForm(f => ({...f, dia_semana: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
                    {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              )}
              {form.frecuencia === 'mensual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Día del mes *</label>
                  <select value={form.dia_mes} onChange={e => setForm(f => ({...f, dia_mes: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>Día {d}</option>)}
                  </select>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModal(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm">Cancelar</button>
                <button type="submit" disabled={guardando}
                  className="flex-1 bg-verde-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
