import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtFecha } from '../lib/fecha'
import { Search, X, PawPrint, CheckCircle2, Package, Syringe } from '../components/icons'

export default function Busqueda() {
  const navigate = useNavigate()
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState(null)
  const [buscando, setBuscando] = useState(false)

  async function buscar(q) {
    setTexto(q)
    if (q.trim().length < 2) { setResultados(null); return }
    setBuscando(true)

    const term = `%${q.trim()}%`
    const [
      { data: animales },
      { data: tareas },
      { data: insumos },
      { data: eventos },
    ] = await Promise.all([
      supabase.from('animales').select('id,identificacion,nombre,tipo,fincas(nombre)').eq('activa', true)
        .or(`identificacion.ilike.${term},nombre.ilike.${term},raza.ilike.${term}`).limit(10),
      supabase.from('tareas').select('id,titulo,descripcion,completada,fincas(nombre)').eq('completada', false)
        .or(`titulo.ilike.${term},descripcion.ilike.${term}`).limit(10),
      supabase.from('inventario_insumos').select('id,nombre,categoria,stock_actual')
        .ilike('nombre', term).limit(10),
      supabase.from('eventos_sanitarios').select('id,tipo,diagnostico,fecha,animales(identificacion,nombre)')
        .or(`tipo.ilike.${term},diagnostico.ilike.${term},medicamento.ilike.${term}`).limit(5),
    ])

    setResultados({ animales: animales ?? [], tareas: tareas ?? [], insumos: insumos ?? [], eventos: eventos ?? [] })
    setBuscando(false)
  }

  const total = resultados ? resultados.animales.length + resultados.tareas.length + resultados.insumos.length + resultados.eventos.length : 0

  return (
    <div className="space-y-4 pt-2">
      <h2 className="text-xl font-bold text-gray-800">Búsqueda</h2>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          autoFocus
          value={texto}
          onChange={e => buscar(e.target.value)}
          placeholder="Buscar animal, actividad, insumo..."
          className="w-full border border-gray-300 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500"
        />
        {texto && (
          <button onClick={() => { setTexto(''); setResultados(null) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={18} /></button>
        )}
      </div>

      {buscando && <p className="text-gray-400 text-sm">Buscando...</p>}

      {resultados && !buscando && (
        total === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Sin resultados para "{texto}"</p>
        ) : (
          <div className="space-y-4">

            {resultados.animales.length > 0 && (
              <Grupo icono={PawPrint} titulo="Animales">
                {resultados.animales.map(a => (
                  <Fila key={a.id} onClick={() => navigate(`/animales/ficha/${a.id}`)}>
                    <div className="font-semibold text-sm text-gray-800">{a.identificacion}{a.nombre ? ` · ${a.nombre}` : ''}</div>
                    <div className="text-xs text-gray-500">{a.tipo} · {a.fincas?.nombre}</div>
                  </Fila>
                ))}
              </Grupo>
            )}

            {resultados.tareas.length > 0 && (
              <Grupo icono={CheckCircle2} titulo="Actividades pendientes">
                {resultados.tareas.map(t => (
                  <Fila key={t.id} onClick={() => navigate('/actividades/puntuales')}>
                    <div className="font-semibold text-sm text-gray-800">{t.titulo}</div>
                    {t.descripcion && <div className="text-xs text-gray-500 truncate">{t.descripcion}</div>}
                    <div className="text-xs text-gray-400">{t.fincas?.nombre}</div>
                  </Fila>
                ))}
              </Grupo>
            )}

            {resultados.insumos.length > 0 && (
              <Grupo icono={Package} titulo="Inventario">
                {resultados.insumos.map(i => (
                  <Fila key={i.id} onClick={() => navigate('/inventario')}>
                    <div className="font-semibold text-sm text-gray-800">{i.nombre}</div>
                    <div className="text-xs text-gray-500">{i.categoria} · Stock: {i.stock_actual}</div>
                  </Fila>
                ))}
              </Grupo>
            )}

            {resultados.eventos.length > 0 && (
              <Grupo icono={Syringe} titulo="Eventos sanitarios">
                {resultados.eventos.map(e => (
                  <Fila key={e.id} onClick={() => navigate(`/animales/ficha/${e.animales?.id ?? ''}`)}>
                    <div className="font-semibold text-sm text-gray-800">{e.tipo} · {fmtFecha(e.fecha)}</div>
                    {e.diagnostico && <div className="text-xs text-gray-500">{e.diagnostico}</div>}
                    <div className="text-xs text-gray-400">{e.animales?.identificacion}{e.animales?.nombre ? ` (${e.animales.nombre})` : ''}</div>
                  </Fila>
                ))}
              </Grupo>
            )}

          </div>
        )
      )}

      {!resultados && !buscando && (
        <div className="text-center py-12 text-gray-300">
          <Search size={48} className="mx-auto mb-3" />
          <p className="text-sm">Escribe al menos 2 caracteres</p>
        </div>
      )}
    </div>
  )
}

function Grupo({ icono: Icono, titulo, children }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        {Icono && <Icono size={14} />}
        {titulo}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Fila({ children, onClick }) {
  return (
    <div onClick={onClick} className="bg-white border border-gray-200 rounded-xl px-4 py-3 cursor-pointer hover:shadow transition">
      {children}
    </div>
  )
}
