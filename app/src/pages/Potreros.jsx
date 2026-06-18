import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Map, MapPin, Crosshair, Pencil, Pin, X } from '../components/icons'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const COLORES = ['#22c55e', '#3b82f6', '#eab308', '#ef4444', '#a855f7', '#f97316', '#14b8a6', '#ec4899']
const FC_VACIO = { type: 'FeatureCollection', features: [] }

const toRad = d => (d * Math.PI) / 180

// Área en hectáreas de un anillo [[lng,lat],...] (fórmula esférica)
function areaHectareas(ring) {
  if (!ring || ring.length < 3) return 0
  const R = 6378137
  let area = 0
  for (let i = 0; i < ring.length; i++) {
    const [lng1, lat1] = ring[i]
    const [lng2, lat2] = ring[(i + 1) % ring.length]
    area += (toRad(lng2) - toRad(lng1)) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)))
  }
  return Math.abs((area * R * R) / 2) / 10000
}

// ¿El punto [lng,lat] está dentro del anillo?
function dentro([lng, lat], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]
    if (((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) inside = !inside
  }
  return inside
}

function cerrar(ring) {
  if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
    return [...ring, ring[0]]
  }
  return ring
}

function aFeatureCollection(potreros) {
  return {
    type: 'FeatureCollection',
    features: potreros.map(p => ({
      type: 'Feature',
      properties: { id: p.id, nombre: p.nombre, color: p.color },
      geometry: { type: 'Polygon', coordinates: [cerrar(p.coordenadas)] },
    })),
  }
}

export default function Potreros() {
  const { perfil } = useAuth()
  const puedeEditar = perfil?.rol === 'propietario' || perfil?.rol === 'mayordomo'

  const [fincas, setFincas] = useState([])
  const [fincaId, setFincaId] = useState('')
  const [potreros, setPotreros] = useState([])
  const [lotes, setLotes] = useState([])
  const [pendiente, setPendiente] = useState(null)   // { coords, area } al dibujar uno nuevo
  const [seleccion, setSeleccion] = useState(null)   // potrero tocado (bottom sheet)
  const [enPotrero, setEnPotrero] = useState(null)    // nombre del potrero donde está el GPS
  const [mapListo, setMapListo] = useState(false)
  const [mapError, setMapError] = useState('')

  const contRef = useRef(null)
  const mapRef = useRef(null)
  const drawRef = useRef(null)
  const potrerosRef = useRef([])

  // ── Cargar fincas (con su centro guardado) ──
  async function loadFincas() {
    const { data } = await supabase.from('fincas').select('id,nombre,lat,lng').eq('activa', true).order('nombre')
    setFincas(data ?? [])
    setFincaId(prev => prev || (data?.[0]?.id ?? ''))
  }
  useEffect(() => { loadFincas() }, [])

  // ── Inicializar el mapa (una vez) ──
  useEffect(() => {
    if (!TOKEN || mapRef.current || !contRef.current) return
    let map
    try {
    mapboxgl.accessToken = TOKEN
    map = new mapboxgl.Map({
      container: contRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-75.5, 6.2], // Antioquia por defecto
      zoom: 12,
    })
    mapRef.current = map
    map.on('error', e => {
      const msg = e?.error?.message || 'No se pudo cargar el mapa'
      setMapError(msg)
    })
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    const geo = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    })
    map.addControl(geo, 'top-right')
    geo.on('geolocate', pos => {
      const punto = [pos.coords.longitude, pos.coords.latitude]
      const actual = potrerosRef.current.find(p => dentro(punto, cerrar(p.coordenadas)))
      setEnPotrero(actual ? actual.nombre : null)
    })

    const draw = new MapboxDraw({ displayControlsDefault: false })
    drawRef.current = draw
    map.addControl(draw)
    map.on('draw.create', e => {
      const ring = e.features[0]?.geometry?.coordinates?.[0]
      draw.deleteAll()
      if (ring && ring.length >= 4) setPendiente({ coords: ring, area: areaHectareas(ring) })
    })

    map.on('load', () => {
      map.addSource('potreros', { type: 'geojson', data: FC_VACIO })
      map.addLayer({ id: 'potreros-fill', type: 'fill', source: 'potreros', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.35 } })
      map.addLayer({ id: 'potreros-line', type: 'line', source: 'potreros', paint: { 'line-color': ['get', 'color'], 'line-width': 2.5 } })
      map.addLayer({
        id: 'potreros-label', type: 'symbol', source: 'potreros',
        layout: { 'text-field': ['get', 'nombre'], 'text-size': 13, 'text-allow-overlap': false },
        paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1.4 },
      })
      map.on('click', 'potreros-fill', e => {
        const id = e.features[0]?.properties?.id
        const p = potrerosRef.current.find(x => x.id === id)
        if (p) setSeleccion(p)
      })
      map.on('mouseenter', 'potreros-fill', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'potreros-fill', () => { map.getCanvas().style.cursor = '' })
      setMapListo(true)
      // Asegurar que el lienzo tome el tamaño real del contenedor
      map.resize()
      setTimeout(() => map.resize(), 300)
    })

    } catch (err) {
      setMapError('No se pudo iniciar el mapa: ' + (err?.message || String(err)))
      return
    }
    return () => { try { map?.remove() } catch { /* noop */ } mapRef.current = null }
  }, [])

  // ── Cargar potreros + lotes de la finca ──
  async function cargarPotreros() {
    if (!fincaId) { setPotreros([]); return }
    const [{ data: ps }, { data: ls }] = await Promise.all([
      supabase.from('potreros').select('*').eq('finca_id', fincaId).eq('activo', true).order('nombre'),
      supabase.from('lotes').select('id,nombre').eq('finca_id', fincaId).order('nombre'),
    ])
    setPotreros(ps ?? [])
    setLotes(ls ?? [])
  }
  useEffect(() => { cargarPotreros() }, [fincaId])

  // ── Pintar potreros en el mapa cuando cambian ──
  useEffect(() => {
    potrerosRef.current = potreros
    const map = mapRef.current
    if (!map || !mapListo) return
    const src = map.getSource('potreros')
    if (src) src.setData(aFeatureCollection(potreros))
    // Encuadrar a los potreros existentes...
    const todos = potreros.flatMap(p => p.coordenadas)
    if (todos.length) {
      const lngs = todos.map(c => c[0]); const lats = todos.map(c => c[1])
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 60, maxZoom: 17, duration: 600 })
    } else {
      // ...o, si no hay potreros, volar al centro guardado de la finca
      const f = fincas.find(x => x.id === fincaId)
      if (f && f.lat != null && f.lng != null) {
        map.flyTo({ center: [Number(f.lng), Number(f.lat)], zoom: 15, duration: 800 })
      }
    }
  }, [potreros, mapListo, fincaId, fincas])

  function dibujar() {
    if (!drawRef.current) return
    drawRef.current.changeMode('draw_polygon')
  }

  async function fijarUbicacion() {
    const map = mapRef.current
    if (!map || !fincaId) return
    const c = map.getCenter()
    await supabase.from('fincas').update({ lat: c.lat, lng: c.lng }).eq('id', fincaId)
    await loadFincas()
    alert('Listo: guardé el centro de esta finca. La próxima vez el mapa abrirá aquí.')
  }

  const fincaActual = fincas.find(f => f.id === fincaId)
  const sinUbicacion = fincaActual && fincaActual.lat == null && potreros.length === 0

  async function eliminar(p) {
    if (!confirm(`¿Eliminar el potrero "${p.nombre}"?`)) return
    await supabase.from('potreros').update({ activo: false }).eq('id', p.id)
    setSeleccion(null)
    cargarPotreros()
  }

  // ── Sin token: instrucciones de configuración ──
  if (!TOKEN) {
    return (
      <div className="space-y-4 pt-2">
        <h2 className="text-xl font-bold text-gray-800 inline-flex items-center gap-2"><Map size={24} /> Potreros</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3 text-sm text-amber-800">
          <p className="font-semibold">Falta configurar el mapa</p>
          <p>El mapa satelital usa Mapbox y necesita un <strong>token público</strong>. Pasos (no me lo pegues en el chat):</p>
          <ol className="list-decimal ml-5 space-y-1">
            <li>Crea una cuenta gratis en <strong>mapbox.com</strong> y copia tu <em>Default public token</em>.</li>
            <li>En tu PC, en la carpeta <code>app</code>, edita el archivo <code>.env</code> y agrega una línea:<br/><code>VITE_MAPBOX_TOKEN=tu_token_aqui</code></li>
            <li>En <strong>Vercel</strong> → tu proyecto → Settings → Environment Variables, agrega la misma variable <code>VITE_MAPBOX_TOKEN</code> con tu token.</li>
            <li>Reinicia el servidor (o vuelve a desplegar) y recarga.</li>
          </ol>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 inline-flex items-center gap-2"><Map size={24} /> Potreros</h2>
        {puedeEditar && fincaId && (
          <button onClick={dibujar}
            className="bg-verde-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-verde-700 transition inline-flex items-center gap-1">
            <Pencil size={16} /> Dibujar potrero
          </button>
        )}
      </div>

      {fincas.length === 0 && (
        <p className="text-gray-400 text-sm text-center">Aún no tienes fincas. Crea una en el módulo Fincas para guardar potreros.</p>
      )}

      {fincas.length > 0 && (
        <select value={fincaId} onChange={e => setFincaId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
          {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
        </select>
      )}

      {enPotrero && (
        <div className="bg-verde-600 text-white rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-2">
          <MapPin size={16} /> Estás en: {enPotrero}
        </div>
      )}

      {/* Aviso para ubicar la finca la primera vez */}
      {puedeEditar && sinUbicacion && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 space-y-2">
          <p>Esta finca aún no tiene ubicación. Centra el mapa en <strong>{fincaActual?.nombre}</strong> (toca el botón de ubicación <Crosshair size={14} className="inline align-text-bottom" /> si estás en la finca, o arrastra el mapa hasta ella) y guárdala:</p>
          <button onClick={fijarUbicacion}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5">
            <Pin size={16} /> Fijar el centro de esta finca aquí
          </button>
        </div>
      )}

      {mapError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <p className="font-semibold mb-0.5">El mapa reportó un error:</p>
          <p className="break-words">{mapError}</p>
          <p className="text-xs text-red-500 mt-1">Si menciona "Unauthorized" o "401", el token de Mapbox es inválido o tiene restricciones.</p>
        </div>
      )}

      {/* El recuadro del mapa SIEMPRE se renderiza para que el mapa arranque al cargar */}
      <div ref={contRef} className="w-full h-[62vh] rounded-xl overflow-hidden border border-gray-200 bg-gray-100" />

      <p className="text-xs text-gray-400 text-center inline-flex flex-wrap items-center justify-center gap-1 w-full">
        {puedeEditar
          ? <>Toca "Dibujar potrero", marca las esquinas siguiendo las cercas y cierra tocando el primer punto. Usa <Crosshair size={12} className="inline align-text-bottom" /> para ubicarte.</>
          : <>Toca <Crosshair size={12} className="inline align-text-bottom" /> (arriba a la derecha) para ver en qué potrero estás.</>}
      </p>

      {puedeEditar && fincaActual && !sinUbicacion && (
        <button onClick={fijarUbicacion}
          className="w-full text-xs text-gray-400 hover:text-verde-600 transition inline-flex items-center justify-center gap-1">
          <Pin size={14} /> Actualizar el centro de esta finca a la vista actual
        </button>
      )}

      {potreros.length > 0 && (
        <div className="space-y-1.5">
          {potreros.map(p => (
            <button key={p.id} onClick={() => setSeleccion(p)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex items-center gap-3 text-left hover:shadow transition">
              <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: p.color }} />
              <span className="flex-1 text-sm font-semibold text-gray-800">{p.nombre}</span>
              <span className="text-xs text-gray-400">{p.area_ha ? `${Number(p.area_ha).toFixed(2)} ha` : ''}</span>
            </button>
          ))}
        </div>
      )}

      {/* Modal: nombrar potrero recién dibujado */}
      {pendiente && (
        <ModalNuevo
          pendiente={pendiente} lotes={lotes} fincaId={fincaId} perfil={perfil}
          onClose={() => setPendiente(null)}
          onGuardado={() => { setPendiente(null); cargarPotreros() }}
        />
      )}

      {/* Bottom sheet: detalle del potrero */}
      {seleccion && (
        <SheetPotrero
          potrero={seleccion} lotes={lotes} puedeEditar={puedeEditar}
          onClose={() => setSeleccion(null)}
          onEliminar={() => eliminar(seleccion)}
          onActualizado={() => { setSeleccion(null); cargarPotreros() }}
        />
      )}
    </div>
  )
}

function ModalNuevo({ pendiente, lotes, fincaId, perfil, onClose, onGuardado }) {
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(COLORES[0])
  const [loteId, setLoteId] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    if (!nombre.trim()) { setError('Ponle un nombre al potrero'); return }
    setGuardando(true); setError('')
    const { error: err } = await supabase.from('potreros').insert({
      finca_id: fincaId,
      nombre: nombre.trim(),
      color,
      coordenadas: pendiente.coords,
      area_ha: Number(pendiente.area.toFixed(4)),
      lote_id: loteId || null,
      creado_por: perfil.id,
    })
    setGuardando(false)
    if (err) { setError(err.message); return }
    onGuardado()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800">Nuevo potrero</h3>
        <p className="text-sm text-gray-500">Área aproximada: <strong>{pendiente.area.toFixed(2)} ha</strong></p>
        {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-600">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="ej: Potrero La Loma"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
          <div className="flex gap-2 flex-wrap">
            {COLORES.map(c => (
              <button key={c} onClick={() => setColor(c)} type="button"
                className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-gray-800' : 'border-white'}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>

        {lotes.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vincular a lote (opcional)</label>
            <select value={loteId} onChange={e => setLoteId(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
              <option value="">Sin vincular</option>
              {lotes.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">Si lo vinculas, podrás ver cuántos animales hay en este potrero.</p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm">Cancelar</button>
          <button onClick={guardar} disabled={guardando}
            className="flex-1 bg-verde-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar potrero'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SheetPotrero({ potrero, lotes, puedeEditar, onClose, onEliminar, onActualizado }) {
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(potrero.nombre)
  const [color, setColor] = useState(potrero.color)
  const [loteId, setLoteId] = useState(potrero.lote_id ?? '')
  const [animales, setAnimales] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!potrero.lote_id) { setAnimales(null); return }
    supabase.from('animales').select('*', { count: 'exact', head: true })
      .eq('lote_id', potrero.lote_id).eq('activa', true)
      .then(({ count }) => setAnimales(count ?? 0))
  }, [potrero.id, potrero.lote_id])

  async function guardar() {
    setGuardando(true)
    await supabase.from('potreros').update({ nombre: nombre.trim(), color, lote_id: loteId || null }).eq('id', potrero.id)
    setGuardando(false)
    onActualizado()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
        {!editando ? (
          <>
            <div className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-full" style={{ background: potrero.color }} />
              <h3 className="font-bold text-gray-800 text-lg flex-1">{potrero.nombre}</h3>
              <button onClick={onClose} className="text-gray-400"><X size={22} /></button>
            </div>
            <div className="text-sm text-gray-500 space-y-1">
              {potrero.area_ha != null && <div>Área: <strong>{Number(potrero.area_ha).toFixed(2)} ha</strong></div>}
              {potrero.lote_id
                ? <div>Animales en este potrero: <strong>{animales == null ? '…' : animales}</strong></div>
                : <div className="text-gray-400">Sin lote vinculado</div>}
            </div>
            {puedeEditar && (
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditando(true)} className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm font-medium">Editar</button>
                <button onClick={onEliminar} className="flex-1 border border-red-200 text-red-500 py-3 rounded-xl text-sm font-medium">Eliminar</button>
              </div>
            )}
          </>
        ) : (
          <>
            <h3 className="font-bold text-gray-800">Editar potrero</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORES.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-gray-800' : 'border-white'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            {lotes.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vincular a lote</label>
                <select value={loteId} onChange={e => setLoteId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
                  <option value="">Sin vincular</option>
                  {lotes.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditando(false)} className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm">Cancelar</button>
              <button onClick={guardar} disabled={guardando}
                className="flex-1 bg-verde-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
