import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Milk, ListChecks, Syringe, Wallet, Download } from '../components/icons'

const PERIODOS = [
  { label: 'Esta semana',  dias: 7  },
  { label: 'Este mes',     dias: 30 },
  { label: 'Últimos 90 días', dias: 90 },
]

export default function Reportes() {
  const [fincas, setFincas] = useState([])
  const [filtroFinca, setFiltroFinca] = useState('')
  const [periodo, setPeriodo] = useState(30)
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    supabase.from('fincas').select('id,nombre').eq('activa', true).then(({ data }) => setFincas(data ?? []))
  }, [])

  useEffect(() => { cargar() }, [filtroFinca, periodo])

  async function cargar() {
    setCargando(true)
    const desde = new Date(Date.now() - periodo * 86400000).toISOString().split('T')[0]
    const hasta = new Date().toISOString().split('T')[0]

    let qOrd = supabase.from('ordenos').select('fecha,litros,finca_id,fincas(nombre)').gte('fecha', desde).lte('fecha', hasta).order('fecha')
    let qTar = supabase.from('tareas').select('completada,fecha_completada,finca_id').gte('created_at', new Date(Date.now() - periodo * 86400000).toISOString())
    let qSan = supabase.from('eventos_sanitarios').select('tipo,fecha,finca_id').gte('fecha', desde)
    let qRep = supabase.from('eventos_reproductivos').select('tipo,fecha,finca_id').gte('fecha', desde)
    let qMov = supabase.from('movimientos_hato').select('tipo,fecha,valor').gte('fecha', desde)

    if (filtroFinca) {
      qOrd = qOrd.eq('finca_id', filtroFinca)
      qTar = qTar.eq('finca_id', filtroFinca)
      qSan = qSan.eq('finca_id', filtroFinca)
      qRep = qRep.eq('finca_id', filtroFinca)
    }

    const [{ data: ordenos }, { data: tareas }, { data: sanitarios }, { data: reproductivos }, { data: movimientos }] =
      await Promise.all([qOrd, qTar, qSan, qRep, qMov])

    // Producción por día
    const porDia = {}
    ordenos?.forEach(o => {
      porDia[o.fecha] = (porDia[o.fecha] ?? 0) + Number(o.litros)
    })
    const diasConDatos = Object.entries(porDia).sort(([a], [b]) => a.localeCompare(b))

    // Producción por finca
    const porFinca = {}
    ordenos?.forEach(o => {
      const nombre = o.fincas?.nombre ?? 'Sin finca'
      porFinca[nombre] = (porFinca[nombre] ?? 0) + Number(o.litros)
    })

    // Totales
    const totalLitros = ordenos?.reduce((s, o) => s + Number(o.litros), 0) ?? 0
    const promDiario = diasConDatos.length > 0 ? totalLitros / diasConDatos.length : 0
    const maxDia = diasConDatos.reduce((max, [, v]) => Math.max(max, v), 0)
    const minDia = diasConDatos.length > 0 ? diasConDatos.reduce((min, [, v]) => Math.min(min, v), Infinity) : 0

    // Tareas
    const totalTareas = tareas?.length ?? 0
    const tareasCompletas = tareas?.filter(t => t.completada).length ?? 0

    // Ventas/compras
    const ventas = movimientos?.filter(m => m.tipo === 'venta').reduce((s, m) => s + Number(m.valor ?? 0), 0) ?? 0
    const compras = movimientos?.filter(m => m.tipo === 'compra').reduce((s, m) => s + Number(m.valor ?? 0), 0) ?? 0

    setDatos({
      totalLitros, promDiario, maxDia, minDia, diasConDatos, porFinca,
      totalTareas, tareasCompletas,
      sanitarios: sanitarios?.length ?? 0,
      partos: reproductivos?.filter(r => r.tipo === 'parto').length ?? 0,
      servicios: reproductivos?.filter(r => r.tipo === 'servicio').length ?? 0,
      ventas, compras,
    })
    setCargando(false)
  }

  const maxBarra = datos ? Math.max(...datos.diasConDatos.map(([, v]) => v), 1) : 1

  return (
    <div className="space-y-5 pt-2">
      <h2 className="text-xl font-bold text-gray-800">Reportes</h2>

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
      ) : datos && (
        <>
          {/* Producción de leche */}
          <Seccion icon={Milk} titulo="Producción de leche">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Total" valor={`${datos.totalLitros.toFixed(0)} L`} />
              <Stat label="Promedio diario" valor={`${datos.promDiario.toFixed(1)} L`} />
              <Stat label="Mejor día" valor={`${datos.maxDia.toFixed(1)} L`} color="green" />
              <Stat label="Día más bajo" valor={`${datos.minDia === Infinity ? '—' : datos.minDia.toFixed(1) + ' L'}`} color="red" />
            </div>

            {/* Gráfica de barras por día */}
            {datos.diasConDatos.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2">Litros por día</p>
                <div className="flex items-end gap-0.5 h-24 overflow-x-auto pb-1">
                  {datos.diasConDatos.map(([fecha, litros]) => (
                    <div key={fecha} className="flex flex-col items-center gap-0.5 min-w-[18px]">
                      <div
                        className="w-4 bg-verde-500 rounded-t"
                        style={{ height: `${(litros / maxBarra) * 80}px` }}
                        title={`${fecha}: ${litros.toFixed(1)} L`}
                      />
                      <span className="text-gray-300 text-[8px] rotate-90 origin-left translate-y-3">
                        {fecha.slice(8)}/{fecha.slice(5,7)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Por finca */}
            {Object.keys(datos.porFinca).length > 1 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-gray-500 mb-1">Por finca</p>
                {Object.entries(datos.porFinca).sort(([,a],[,b]) => b - a).map(([nombre, litros]) => (
                  <div key={nombre} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-24 truncate">{nombre}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-verde-500 h-2 rounded-full" style={{ width: `${(litros / datos.totalLitros) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-16 text-right">{litros.toFixed(0)} L</span>
                  </div>
                ))}
              </div>
            )}
          </Seccion>

          {/* Tareas */}
          <Seccion icon={ListChecks} titulo="Actividades">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Total creadas" valor={datos.totalTareas} />
              <Stat label="Completadas" valor={datos.tareasCompletas} color="green" />
              <Stat label="Pendientes" valor={datos.totalTareas - datos.tareasCompletas} color={datos.totalTareas - datos.tareasCompletas > 0 ? 'red' : 'green'} />
              <Stat label="% cumplimiento" valor={datos.totalTareas > 0 ? `${Math.round((datos.tareasCompletas / datos.totalTareas) * 100)}%` : '—'} />
            </div>
          </Seccion>

          {/* Sanidad y reproducción */}
          <Seccion icon={Syringe} titulo="Sanidad y reproducción">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Eventos sanidad" valor={datos.sanitarios} />
              <Stat label="Servicios" valor={datos.servicios} />
              <Stat label="Partos" valor={datos.partos} color="green" />
            </div>
          </Seccion>

          {/* Movimientos económicos */}
          {(datos.ventas > 0 || datos.compras > 0) && (
            <Seccion icon={Wallet} titulo="Movimientos económicos">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Ventas" valor={`$${datos.ventas.toLocaleString('es-CO')}`} color="green" />
                <Stat label="Compras" valor={`$${datos.compras.toLocaleString('es-CO')}`} color="red" />
              </div>
            </Seccion>
          )}

          {/* Botón exportar */}
          <button onClick={() => exportarCSV(datos)}
            className="w-full border border-verde-600 text-verde-700 font-semibold py-3 rounded-xl hover:bg-verde-50 transition text-sm flex items-center justify-center gap-2">
            <Download size={18} /> Exportar reporte CSV
          </button>
        </>
      )}
    </div>
  )
}

function exportarCSV(datos) {
  const filas = [
    ['Métrica', 'Valor'],
    ['Total litros', datos.totalLitros.toFixed(1)],
    ['Promedio diario (L)', datos.promDiario.toFixed(1)],
    ['Mejor día (L)', datos.maxDia.toFixed(1)],
    ['Actividades creadas', datos.totalTareas],
    ['Actividades completadas', datos.tareasCompletas],
    ['Eventos sanidad', datos.sanitarios],
    ['Servicios reproductivos', datos.servicios],
    ['Partos', datos.partos],
    ['Ventas ($)', datos.ventas],
    ['Compras ($)', datos.compras],
    [],
    ['Fecha', 'Litros'],
    ...datos.diasConDatos.map(([fecha, litros]) => [fecha, litros.toFixed(1)]),
  ]
  const csv = filas.map(f => f.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `agromio-reporte-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function Seccion({ icon: Icon, titulo, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
        {Icon && <Icon size={18} className="text-verde-700" />}{titulo}
      </h3>
      {children}
    </div>
  )
}

function Stat({ label, valor, color }) {
  const colors = { green: 'text-verde-700', red: 'text-red-500' }
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-3">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`text-lg font-bold ${colors[color] ?? 'text-gray-800'}`}>{valor}</div>
    </div>
  )
}
