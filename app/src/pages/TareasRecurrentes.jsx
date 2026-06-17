import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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

  async function cargar() {
    setCargando(true)
    const { data: ts } = await supabase.from('tareas_recurrentes')
      .select('id,titulo,descripcion,finca_id,fincas(nombre)')
      .eq('asignado_a', perfil.id).eq('activa', true).order('created_at')
    const ids = ts?.map(t => t.id) ?? []
    let comp = {}
    if (ids.length > 0) {
      const { data: cs } = await supabase.from('completaciones_diarias')
        .select('id,tarea_recurrente_id,foto_url,audio_url,nota')
        .in('tarea_recurrente_id', ids).eq('fecha', hoy)
      cs?.forEach(c => { comp[c.tarea_recurrente_id] = c })
    }
    setTareas(ts ?? [])
    setCompletadas(comp)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [perfil?.id])

  const hechas = tareas.filter(t => completadas[t.id])
  const pendientes = tareas.filter(t => !completadas[t.id])

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Mis actividades de hoy</h2>
        <span className="text-sm text-gray-500">{hechas.length}/{tareas.length} hechas</span>
      </div>

      {tareas.length > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div className="bg-verde-600 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${tareas.length > 0 ? (hechas.length / tareas.length) * 100 : 0}%` }} />
        </div>
      )}

      {cargando ? <p className="text-gray-400 text-sm">Cargando...</p> : tareas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-400 text-sm">No tienes actividades asignadas</p>
        </div>
      ) : (
        <>
          {hechas.length === tareas.length && (
            <div className="bg-verde-50 border border-verde-200 rounded-2xl p-5 text-center">
              <p className="text-4xl mb-2">🎉</p>
              <p className="text-verde-800 font-bold text-sm">¡Todas las actividades completadas!</p>
            </div>
          )}

          {pendientes.length > 0 && (
            <div className="space-y-2">
              {pendientes.map(t => (
                <button key={t.id} onClick={() => setModalTarea(t)}
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
            </div>
          )}

          {hechas.length > 0 && (
            <div className="space-y-2">
              {pendientes.length > 0 && (
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1 pt-2">Completadas</p>
              )}
              {hechas.map(t => {
                const c = completadas[t.id]
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
        </>
      )}

      {modalTarea && (
        <ModalCompletar
          tarea={modalTarea} perfil={perfil} hoy={hoy}
          onClose={() => setModalTarea(null)}
          onCompletada={() => { setModalTarea(null); cargar() }}
        />
      )}
      {evidenciaModal && <ModalEvidencia completacion={evidenciaModal} onClose={() => setEvidenciaModal(null)} />}
    </div>
  )
}

// ─── Modal completar tarea ──────────────────────────────────────────────────
function ModalCompletar({ tarea, perfil, hoy, onClose, onCompletada }) {
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
  const [form, setForm] = useState({ titulo: '', descripcion: '', asignado_a: '', finca_id: '' })

  async function cargar() {
    setCargando(true)
    const [{ data: ts }, { data: ws }, { data: fs }] = await Promise.all([
      supabase.from('tareas_recurrentes')
        .select('id,titulo,descripcion,asignado_a,usuarios!tareas_recurrentes_asignado_a_fkey(nombre),fincas(nombre)')
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
      frecuencia: 'diaria',
      activa: true,
    })
    setGuardando(false)
    if (error) { setErrorForm(error.message); return }
    setModal(false)
    setForm({ titulo: '', descripcion: '', asignado_a: '', finca_id: '' })
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
