import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmtFecha } from '../lib/fecha'
import { TrendingUp, TrendingDown } from '../components/icons'

const PERIODOS = [
  { label: 'Este mes',        dias: 30  },
  { label: 'Últimos 3 meses', dias: 90  },
  { label: 'Este año',        dias: 365 },
]

const CATEGORIAS_GASTO = [
  'Alimentación / concentrado',
  'Medicamentos y vacunas',
  'Jornales y nómina',
  'Mantenimiento infraestructura',
  'Combustible y transporte',
  'Servicios (agua, luz)',
  'Otro',
]

const CATEGORIAS_INGRESO = [
  'Venta de leche',
  'Venta de animales',
  'Otro ingreso',
]

export default function Finanzas() {
  const { perfil } = useAuth()
  const [fincas, setFincas]           = useState([])
  const [filtroFinca, setFiltroFinca] = useState('')
  const [periodo, setPeriodo]         = useState(30)
  const [resumen, setResumen]         = useState(null)
  const [lista, setLista]             = useState([])
  const [cargando, setCargando]       = useState(false)
  const [modal, setModal]             = useState(false)
  const [tipo, setTipo]               = useState('gasto')
  const [form, setForm]               = useState({ fecha: hoy(), categoria: '', descripcion: '', valor: '', finca_id: '' })
  const [guardando, setGuardando]     = useState(false)

  useEffect(() => {
    supabase.from('fincas').select('id,nombre').eq('activa', true).then(({ data }) => setFincas(data ?? []))
  }, [])

  useEffect(() => { cargar() }, [filtroFinca, periodo])

  function hoy() { return new Date().toISOString().split('T')[0] }

  async function cargar() {
    setCargando(true)
    const desde = new Date(Date.now() - periodo * 86400000).toISOString().split('T')[0]

    let qTx  = supabase.from('transacciones').select('*').gte('fecha', desde).order('fecha', { ascending: false })
    let qOrd = supabase.from('ordenos').select('litros,fecha').gte('fecha', desde)

    if (filtroFinca) {
      qTx  = qTx.eq('finca_id', filtroFinca)
      qOrd = qOrd.eq('finca_id', filtroFinca)
    }

    const [{ data: txs }, { data: ordenos }] = await Promise.all([qTx, qOrd])

    const ingresos = txs?.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.valor), 0) ?? 0
    const gastos   = txs?.filter(t => t.tipo === 'gasto').reduce((s, t) => s + Number(t.valor), 0) ?? 0
    const litros   = ordenos?.reduce((s, o) => s + Number(o.litros), 0) ?? 0
    const costoPorLitro = litros > 0 ? gastos / litros : null

    // Gastos por categoría
    const porCategoria = {}
    txs?.filter(t => t.tipo === 'gasto').forEach(t => {
      porCategoria[t.categoria] = (porCategoria[t.categoria] ?? 0) + Number(t.valor)
    })

    setResumen({ ingresos, gastos, balance: ingresos - gastos, litros, costoPorLitro, porCategoria })
    setLista(txs ?? [])
    setCargando(false)
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    await supabase.from('transacciones').insert({
      tipo,
      fecha:       form.fecha,
      categoria:   form.categoria,
      descripcion: form.descripcion || null,
      valor:       Number(form.valor),
      finca_id:    form.finca_id || null,
      creado_por:  perfil?.id ?? null,
    })
    setGuardando(false)
    setModal(false)
    setForm({ fecha: hoy(), categoria: '', descripcion: '', valor: '', finca_id: '' })
    cargar()
  }

  const maxCat = resumen ? Math.max(...Object.values(resumen.porCategoria), 1) : 1

  return (
    <div className="space-y-5 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Finanzas</h2>
        <button onClick={() => setModal(true)}
          className="bg-verde-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-verde-700 transition">
          + Registrar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <select value={filtroFinca} onChange={e => setFiltroFinca(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
          <option value="">Todas las fincas</option>
          {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
        </select>
        <select value={periodo} onChange={e => setPeriodo(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
          {PERIODOS.map(p => <option key={p.dias} value={p.dias}>{p.label}</option>)}
        </select>
      </div>

      {cargando ? (
        <p className="text-gray-400 text-sm">Calculando...</p>
      ) : resumen && (
        <>
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-2 gap-3">
            <TarjetaFinanza label="Ingresos" valor={resumen.ingresos} color="green" />
            <TarjetaFinanza label="Gastos"   valor={resumen.gastos}   color="red"   />
            <TarjetaFinanza
              label="Balance"
              valor={resumen.balance}
              color={resumen.balance >= 0 ? 'green' : 'red'}
              grande
            />
            {resumen.costoPorLitro !== null && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-0.5">Costo por litro</div>
                <div className="text-lg font-bold text-gray-800">
                  ${resumen.costoPorLitro.toFixed(0)} <span className="text-xs font-normal text-gray-400">COP/L</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">{resumen.litros.toFixed(0)} L producidos</div>
              </div>
            )}
          </div>

          {/* Gastos por categoría */}
          {Object.keys(resumen.porCategoria).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-700">Gastos por categoría</p>
              {Object.entries(resumen.porCategoria).sort(([,a],[,b]) => b - a).map(([cat, val]) => (
                <div key={cat} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-36 truncate">{cat}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-red-400 h-2 rounded-full" style={{ width: `${(val / maxCat) * 100}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-20 text-right">${val.toLocaleString('es-CO')}</span>
                </div>
              ))}
            </div>
          )}

          {/* Lista de transacciones */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">Transacciones</p>
            {lista.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">Sin transacciones en este período</p>
            ) : lista.map(t => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
                {t.tipo === 'ingreso'
                  ? <TrendingUp size={24} className="text-verde-700" />
                  : <TrendingDown size={24} className="text-red-600" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800">{t.categoria}</div>
                  {t.descripcion && <div className="text-xs text-gray-500 truncate">{t.descripcion}</div>}
                  <div className="text-xs text-gray-400">{fmtFecha(t.fecha)}</div>
                </div>
                <div className={`text-sm font-bold ${t.tipo === 'ingreso' ? 'text-verde-700' : 'text-red-500'}`}>
                  {t.tipo === 'ingreso' ? '+' : '-'}${Number(t.valor).toLocaleString('es-CO')}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal registrar */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setModal(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800">Registrar transacción</h3>

            {/* Tipo */}
            <div className="flex rounded-xl overflow-hidden border border-gray-300">
              {['gasto','ingreso'].map(t => (
                <button key={t} type="button" onClick={() => { setTipo(t); setForm(f => ({...f, categoria: ''})) }}
                  className={`flex-1 py-2 text-sm font-semibold transition flex items-center justify-center gap-1.5 ${tipo === t ? (t === 'gasto' ? 'bg-red-500 text-white' : 'bg-verde-600 text-white') : 'bg-white text-gray-500'}`}>
                  {t === 'gasto'
                    ? <><TrendingDown size={16} /> Gasto</>
                    : <><TrendingUp size={16} /> Ingreso</>}
                </button>
              ))}
            </div>

            <form onSubmit={guardar} className="space-y-3">
              <Campo label="Fecha" type="date" value={form.fecha} onChange={v => setForm(f => ({...f, fecha: v}))} required />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
                <select required value={form.categoria} onChange={e => setForm(f => ({...f, categoria: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
                  <option value="">Selecciona...</option>
                  {(tipo === 'gasto' ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <Campo label="Valor (COP) *" type="number" min="0" value={form.valor} onChange={v => setForm(f => ({...f, valor: v}))} required />
              <Campo label="Descripción (opcional)" value={form.descripcion} onChange={v => setForm(f => ({...f, descripcion: v}))} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Finca</label>
                <select value={form.finca_id} onChange={e => setForm(f => ({...f, finca_id: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
                  <option value="">General (todas las fincas)</option>
                  {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModal(false)}
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

function TarjetaFinanza({ label, valor, color, grande }) {
  const colors = { green: 'text-verde-700', red: 'text-red-500' }
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 ${grande ? 'col-span-2' : ''}`}>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`${grande ? 'text-2xl' : 'text-lg'} font-bold ${colors[color] ?? 'text-gray-800'}`}>
        ${Math.abs(valor).toLocaleString('es-CO')} <span className="text-xs font-normal text-gray-400">COP</span>
      </div>
    </div>
  )
}

function Campo({ label, value, onChange, type = 'text', required, min }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} min={min}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
    </div>
  )
}
