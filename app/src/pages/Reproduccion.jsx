import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmtFecha } from '../lib/fecha'
import { Syringe, Microscope, PawPrint, AlertTriangle, ClipboardCheck, Plus } from '../components/icons'
import { Ban } from 'lucide-react'

const TIPOS = ['celo','servicio','diagnostico_prenez','parto','aborto','secado']
const METODOS = ['inseminacion','monta','transferencia_embrion']

// Ícono por tipo de evento. "celo" se muestra como punto de color (semáforo).
function IconoTipo({ tipo, size = 20 }) {
  if (tipo === 'celo') return <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
  const Map = {
    servicio: Syringe, diagnostico_prenez: Microscope,
    parto: PawPrint, aborto: AlertTriangle, secado: Ban,
  }
  const Icon = Map[tipo] ?? ClipboardCheck
  const color = tipo === 'aborto' ? 'text-amber-600' : 'text-verde-700'
  return <Icon size={size} className={color} />
}

export default function Reproduccion() {
  const { perfil } = useAuth()
  const [eventos, setEventos] = useState([])
  const [fincas, setFincas] = useState([])
  const [animales, setAnimales] = useState([])
  const [filtroFinca, setFiltroFinca] = useState('')
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    finca_id: '', animal_id: '',
    fecha: new Date().toISOString().split('T')[0],
    tipo: 'servicio', metodo: '', toro_o_semen: '',
    resultado: '', fecha_probable_parto: '', descripcion: ''
  })

  useEffect(() => {
    supabase.from('fincas').select('id,nombre').eq('activa', true).then(({ data }) => setFincas(data ?? []))
  }, [])

  useEffect(() => {
    if (!form.finca_id) { setAnimales([]); return }
    supabase.from('animales').select('id,identificacion,nombre,tipo')
      .eq('finca_id', form.finca_id).eq('activa', true)
      .in('tipo', ['vaca', 'novilla'])
      .order('identificacion')
      .then(({ data }) => setAnimales(data ?? []))
  }, [form.finca_id])

  async function cargar() {
    setCargando(true)
    let q = supabase.from('eventos_reproductivos')
      .select('id,fecha,tipo,metodo,resultado,fecha_probable_parto,toro_o_semen,descripcion,fincas(nombre),animales(identificacion,nombre)')
      .order('fecha', { ascending: false }).limit(50)
    if (filtroFinca) q = q.eq('finca_id', filtroFinca)
    const { data } = await q
    setEventos(data ?? [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [filtroFinca])

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    const payload = {
      ...form,
      animal_id: form.animal_id || null,
      metodo: form.metodo || null,
      toro_o_semen: form.toro_o_semen || null,
      fecha_probable_parto: form.fecha_probable_parto || null,
      registrado_por: perfil.id,
      creado_por: perfil.id,
      estado: perfil.rol === 'trabajador' ? 'pendiente' : 'aprobado',
    }
    await supabase.from('eventos_reproductivos').insert(payload)

    // Si es secado, actualizar estado productivo del animal
    if (form.tipo === 'secado' && form.animal_id) {
      await supabase.from('animales').update({ estado_productivo: 'seca' }).eq('id', form.animal_id)
    }
    // Si es parto, marcar como en ordeño
    if (form.tipo === 'parto' && form.animal_id) {
      await supabase.from('animales').update({ estado_productivo: 'en_ordeno', estado_reproductivo: 'lactante' }).eq('id', form.animal_id)
    }

    setGuardando(false)
    setModalAbierto(false)
    setForm({ finca_id: '', animal_id: '', fecha: new Date().toISOString().split('T')[0], tipo: 'servicio', metodo: '', toro_o_semen: '', resultado: '', fecha_probable_parto: '', descripcion: '' })
    cargar()
  }

  // Próximos partos (próximos 30 días)
  const hoy = new Date()
  const en30 = new Date(hoy); en30.setDate(hoy.getDate() + 30)
  const proximosPartos = eventos.filter(e => {
    if (!e.fecha_probable_parto) return false
    const d = new Date(e.fecha_probable_parto)
    return d >= hoy && d <= en30
  })

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Reproducción</h2>
        <button onClick={() => setModalAbierto(true)}
          className="bg-verde-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-verde-700 transition inline-flex items-center gap-1">
          <Plus size={16} /> Registrar
        </button>
      </div>

      {/* Alerta próximos partos */}
      {proximosPartos.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-yellow-800 inline-flex items-center gap-1.5"><PawPrint size={16} /> Partos próximos (30 días)</p>
          {proximosPartos.map(e => (
            <p key={e.id} className="text-xs text-yellow-700 mt-1">
              {e.animales?.identificacion} — {fmtFecha(e.fecha_probable_parto)}
            </p>
          ))}
        </div>
      )}

      {/* Filtro */}
      <select value={filtroFinca} onChange={e => setFiltroFinca(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
        <option value="">Todas las fincas</option>
        {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
      </select>

      {/* Lista */}
      {cargando ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : eventos.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No hay eventos reproductivos</p>
      ) : (
        <div className="space-y-2">
          {eventos.map(ev => (
            <div key={ev.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <span className="mt-0.5 flex items-center"><IconoTipo tipo={ev.tipo} /></span>
              <div className="flex-1">
                <div className="font-semibold text-sm text-gray-800">
                  {ev.animales ? `${ev.animales.identificacion}${ev.animales.nombre ? ` · ${ev.animales.nombre}` : ''}` : ev.fincas?.nombre}
                </div>
                <div className="text-xs text-gray-500">{fmtFecha(ev.fecha)} · {ev.tipo.replace('_',' ')} · {ev.fincas?.nombre}</div>
                {ev.metodo && <div className="text-xs text-gray-500">{ev.metodo}{ev.toro_o_semen ? ` · ${ev.toro_o_semen}` : ''}</div>}
                {ev.resultado && <div className="text-xs text-gray-600 mt-0.5">Resultado: {ev.resultado}</div>}
                {ev.fecha_probable_parto && (
                  <div className="text-xs text-yellow-600 mt-0.5 inline-flex items-center gap-1"><PawPrint size={14} /> Parto probable: {fmtFecha(ev.fecha_probable_parto)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setModalAbierto(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800">Evento reproductivo</h3>
            <form onSubmit={guardar} className="space-y-3">
              <Sel label="Finca *" value={form.finca_id} onChange={v => setForm(f => ({...f, finca_id: v, animal_id: ''}))} required
                opciones={fincas.map(f => ({value: f.id, label: f.nombre}))} />
              {animales.length > 0 && (
                <Sel label="Animal *" value={form.animal_id} onChange={v => setForm(f => ({...f, animal_id: v}))} required
                  opciones={animales.map(a => ({value: a.id, label: `${a.identificacion}${a.nombre ? ` · ${a.nombre}` : ''}`}))} />
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input type="date" value={form.fecha} onChange={e => setForm(f => ({...f, fecha: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
                </div>
                <Sel label="Tipo *" value={form.tipo} onChange={v => setForm(f => ({...f, tipo: v}))} required
                  opciones={TIPOS.map(t => ({value: t, label: t.replace('_',' ')}))} />
              </div>

              {(form.tipo === 'servicio') && (
                <>
                  <Sel label="Método" value={form.metodo} onChange={v => setForm(f => ({...f, metodo: v}))}
                    opciones={METODOS.map(m => ({value: m, label: m.replace('_',' ')}))} />
                  <Campo label="Toro / Semen" value={form.toro_o_semen} onChange={v => setForm(f => ({...f, toro_o_semen: v}))} />
                </>
              )}
              {(form.tipo === 'servicio' || form.tipo === 'diagnostico_prenez') && (
                <>
                  <Campo label="Resultado" value={form.resultado} onChange={v => setForm(f => ({...f, resultado: v}))} />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha probable de parto</label>
                    <input type="date" value={form.fecha_probable_parto} onChange={e => setForm(f => ({...f, fecha_probable_parto: e.target.value}))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
                  </div>
                </>
              )}
              <Campo label="Descripción / Notas" value={form.descripcion} onChange={v => setForm(f => ({...f, descripcion: v}))} />

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalAbierto(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">Cancelar</button>
                <button type="submit" disabled={guardando}
                  className="flex-1 bg-verde-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
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

function Campo({ label, value, onChange, required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
    </div>
  )
}
function Sel({ label, value, onChange, opciones, required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
        <option value="">Selecciona...</option>
        {opciones.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
