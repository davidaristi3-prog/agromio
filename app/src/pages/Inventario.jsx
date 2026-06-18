import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Pill, Syringe, Wheat, Tablets, Microscope, Package, ClipboardCheck, Siren, Plus, Minus } from '../components/icons'

const CATEGORIAS = ['medicamento','vacuna','concentrado','mineral','desparasitante','otro']
const CAT_ICON = {
  medicamento: Pill, vacuna: Syringe, concentrado: Wheat,
  mineral: Tablets, desparasitante: Microscope, otro: Package
}
const CAT_LABEL = {
  medicamento: 'Medicamentos', vacuna: 'Vacunas', concentrado: 'Concentrados',
  mineral: 'Minerales', desparasitante: 'Desparasitantes', otro: 'Otros'
}

export default function Inventario() {
  const { perfil } = useAuth()
  const [insumos, setInsumos] = useState([])
  const [fincas, setFincas] = useState([])
  const [animales, setAnimales] = useState([])
  const [filtroFinca, setFiltroFinca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [cargando, setCargando] = useState(true)
  const [modalInsumo, setModalInsumo] = useState(false)
  const [modalMovimiento, setModalMovimiento] = useState(null) // insumo seleccionado
  const [guardando, setGuardando] = useState(false)
  const [formInsumo, setFormInsumo] = useState({
    nombre: '', categoria: 'medicamento', unidad: '', finca_id: '',
    stock_actual: '', stock_minimo: '', precio_unidad: '', proveedor: ''
  })
  const [formMov, setFormMov] = useState({
    tipo: 'entrada', cantidad: '', motivo: '', fecha: new Date().toISOString().split('T')[0], animal_id: ''
  })

  useEffect(() => {
    supabase.from('fincas').select('id,nombre').eq('activa', true).then(({ data }) => setFincas(data ?? []))
  }, [])

  useEffect(() => {
    if (!filtroFinca) { setAnimales([]); return }
    supabase.from('animales').select('id,identificacion,nombre').eq('finca_id', filtroFinca).eq('activa', true)
      .order('identificacion').then(({ data }) => setAnimales(data ?? []))
  }, [filtroFinca])

  async function cargar() {
    setCargando(true)
    let q = supabase.from('inventario_insumos')
      .select('*,fincas(nombre)')
      .eq('activo', true)
      .order('nombre')
    if (filtroFinca) q = q.eq('finca_id', filtroFinca)
    if (filtroCategoria) q = q.eq('categoria', filtroCategoria)
    const { data } = await q
    setInsumos(data ?? [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [filtroFinca, filtroCategoria])

  async function guardarInsumo(e) {
    e.preventDefault()
    setGuardando(true)
    await supabase.from('inventario_insumos').insert({
      ...formInsumo,
      finca_id: formInsumo.finca_id || null,
      stock_actual: Number(formInsumo.stock_actual),
      stock_minimo: Number(formInsumo.stock_minimo),
      precio_unidad: formInsumo.precio_unidad ? Number(formInsumo.precio_unidad) : null,
    })
    setGuardando(false)
    setModalInsumo(false)
    setFormInsumo({ nombre: '', categoria: 'medicamento', unidad: '', finca_id: '', stock_actual: '', stock_minimo: '', precio_unidad: '', proveedor: '' })
    cargar()
  }

  async function guardarMovimiento(e) {
    e.preventDefault()
    setGuardando(true)
    const insumo = modalMovimiento
    const cantidad = Number(formMov.cantidad)
    const nuevoStock = formMov.tipo === 'entrada'
      ? insumo.stock_actual + cantidad
      : insumo.stock_actual - cantidad

    await supabase.from('movimientos_inventario').insert({
      insumo_id: insumo.id,
      finca_id: insumo.finca_id,
      fecha: formMov.fecha,
      tipo: formMov.tipo,
      cantidad,
      motivo: formMov.motivo || null,
      animal_id: formMov.animal_id || null,
      registrado_por: perfil.id,
    })
    await supabase.from('inventario_insumos').update({ stock_actual: Math.max(0, nuevoStock) }).eq('id', insumo.id)

    setGuardando(false)
    setModalMovimiento(null)
    setFormMov({ tipo: 'entrada', cantidad: '', motivo: '', fecha: new Date().toISOString().split('T')[0], animal_id: '' })
    cargar()
  }

  const agotados = insumos.filter(i => i.stock_actual <= i.stock_minimo)

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Inventario</h2>
        <button onClick={() => setModalInsumo(true)}
          className="bg-verde-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-verde-700 transition inline-flex items-center gap-1">
          <Plus size={16} /> Insumo
        </button>
      </div>

      {/* Alerta stock bajo */}
      {agotados.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-red-700 mb-1 inline-flex items-center gap-1.5">
            <Siren size={16} className="text-red-600" /> Stock bajo o agotado
          </p>
          {agotados.map(i => {
            const Icon = CAT_ICON[i.categoria] ?? Package
            return (
              <p key={i.id} className="text-xs text-red-600 flex items-center gap-1.5">
                <Icon size={14} /> {i.nombre} — {i.stock_actual} {i.unidad} (mín. {i.stock_minimo})
              </p>
            )
          })}
        </div>
      )}

      {/* Filtro por finca */}
      <select value={filtroFinca} onChange={e => setFiltroFinca(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
        <option value="">Todas las fincas</option>
        {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
      </select>

      {/* Pestañas por categoría */}
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        {[{ value: '', icon: ClipboardCheck, label: 'Todos' },
          ...CATEGORIAS.map(c => ({ value: c, icon: CAT_ICON[c], label: CAT_LABEL[c] }))
        ].map(({ value, icon, label }) => {
          const Icon = icon
          return (
          <button key={value || 'todos'} onClick={() => setFiltroCategoria(value)}
            className={`flex items-center gap-1 whitespace-nowrap text-sm px-4 py-2 rounded-full border transition ${
              filtroCategoria === value
                ? 'bg-verde-600 text-white border-verde-600 font-semibold'
                : 'bg-white text-gray-500 border-gray-200'
            }`}>
            <Icon size={16} />{label}
          </button>
          )
        })}
      </div>

      {/* Lista */}
      {cargando ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : insumos.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No hay insumos registrados</p>
      ) : (
        <div className="space-y-2">
          {insumos.map(ins => {
            const bajo = ins.stock_actual <= ins.stock_minimo
            const Icon = CAT_ICON[ins.categoria] ?? Package
            return (
              <div key={ins.id} className={`bg-white border rounded-xl px-4 py-3 ${bajo ? 'border-red-200' : 'border-gray-200'}`}>
                <div className="flex items-center gap-3">
                  <Icon size={28} className="text-verde-700 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-800">{ins.nombre}</div>
                    <div className="text-xs text-gray-500">
                      {ins.categoria} · {ins.fincas?.nombre ?? 'Todas las fincas'}
                      {ins.proveedor ? ` · ${ins.proveedor}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${bajo ? 'text-red-500' : 'text-verde-700'}`}>
                      {ins.stock_actual} <span className="text-xs font-normal text-gray-400">{ins.unidad}</span>
                    </div>
                    {bajo && <div className="text-xs text-red-400">Stock bajo</div>}
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pl-9">
                  <button onClick={() => { setModalMovimiento(ins); setFormMov(f => ({...f, tipo: 'entrada'})) }}
                    className="flex-1 text-xs bg-verde-50 text-verde-700 border border-verde-200 py-1.5 rounded-lg hover:bg-verde-100 transition font-medium inline-flex items-center justify-center gap-1">
                    <Plus size={14} /> Entrada
                  </button>
                  <button onClick={() => { setModalMovimiento(ins); setFormMov(f => ({...f, tipo: 'salida'})) }}
                    className="flex-1 text-xs bg-red-50 text-red-600 border border-red-200 py-1.5 rounded-lg hover:bg-red-100 transition font-medium inline-flex items-center justify-center gap-1">
                    <Minus size={14} /> Salida
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nuevo insumo */}
      {modalInsumo && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setModalInsumo(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800">Nuevo insumo</h3>
            <form onSubmit={guardarInsumo} className="space-y-3">
              <Campo label="Nombre *" value={formInsumo.nombre} onChange={v => setFormInsumo(f => ({...f, nombre: v}))} required />
              <div className="grid grid-cols-2 gap-3">
                <Sel label="Categoría" value={formInsumo.categoria} onChange={v => setFormInsumo(f => ({...f, categoria: v}))}
                  opciones={CATEGORIAS.map(c => ({value: c, label: c}))} />
                <Campo label="Unidad *" value={formInsumo.unidad} onChange={v => setFormInsumo(f => ({...f, unidad: v}))} required
                  placeholder="kg, L, dosis..." />
              </div>
              <Sel label="Finca" value={formInsumo.finca_id} onChange={v => setFormInsumo(f => ({...f, finca_id: v}))}
                opciones={fincas.map(f => ({value: f.id, label: f.nombre}))} />
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Stock inicial" value={formInsumo.stock_actual} onChange={v => setFormInsumo(f => ({...f, stock_actual: v}))} placeholder="0" />
                <Campo label="Stock mínimo" value={formInsumo.stock_minimo} onChange={v => setFormInsumo(f => ({...f, stock_minimo: v}))} placeholder="0" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Precio/unidad ($)" value={formInsumo.precio_unidad} onChange={v => setFormInsumo(f => ({...f, precio_unidad: v}))} />
                <Campo label="Proveedor" value={formInsumo.proveedor} onChange={v => setFormInsumo(f => ({...f, proveedor: v}))} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalInsumo(false)}
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

      {/* Modal movimiento */}
      {modalMovimiento && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setModalMovimiento(null)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 flex items-center gap-1.5">
              {formMov.tipo === 'entrada'
                ? <><Plus size={16} /> Entrada</>
                : <><Minus size={16} /> Salida</>} · {modalMovimiento.nombre}
            </h3>
            <p className="text-sm text-gray-500">
              Stock actual: <strong>{modalMovimiento.stock_actual} {modalMovimiento.unidad}</strong>
            </p>
            <form onSubmit={guardarMovimiento} className="space-y-3">
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => setFormMov(f => ({...f, tipo: 'entrada'}))}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition inline-flex items-center justify-center gap-1 ${formMov.tipo === 'entrada' ? 'bg-verde-600 text-white border-verde-600' : 'border-gray-300 text-gray-600'}`}>
                  <Plus size={16} /> Entrada
                </button>
                <button type="button"
                  onClick={() => setFormMov(f => ({...f, tipo: 'salida'}))}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition inline-flex items-center justify-center gap-1 ${formMov.tipo === 'salida' ? 'bg-red-500 text-white border-red-500' : 'border-gray-300 text-gray-600'}`}>
                  <Minus size={16} /> Salida
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input type="date" value={formMov.fecha} onChange={e => setFormMov(f => ({...f, fecha: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad * ({modalMovimiento.unidad})</label>
                  <input type="number" step="0.01" min="0.01" required value={formMov.cantidad}
                    onChange={e => setFormMov(f => ({...f, cantidad: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
                </div>
              </div>
              <Campo label="Motivo" value={formMov.motivo} onChange={v => setFormMov(f => ({...f, motivo: v}))}
                placeholder={formMov.tipo === 'entrada' ? 'Compra, donación...' : 'Uso en tratamiento, vencimiento...'} />
              {formMov.tipo === 'salida' && animales.length > 0 && (
                <Sel label="Animal (opcional)" value={formMov.animal_id} onChange={v => setFormMov(f => ({...f, animal_id: v}))}
                  opciones={animales.map(a => ({value: a.id, label: `${a.identificacion}${a.nombre ? ` · ${a.nombre}` : ''}`}))} />
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalMovimiento(null)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">Cancelar</button>
                <button type="submit" disabled={guardando}
                  className={`flex-1 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50 ${formMov.tipo === 'entrada' ? 'bg-verde-600' : 'bg-red-500'}`}>
                  {guardando ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Campo({ label, value, onChange, required, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} required={required} placeholder={placeholder}
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
