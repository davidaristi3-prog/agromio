import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtFecha } from '../lib/fecha'

const TABS = ['Resumen', 'Fotos', 'Ordeños', 'Sanidad', 'Reproducción', 'Movimientos']

export default function FichaAnimal() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [animal, setAnimal] = useState(null)
  const [tab, setTab] = useState('Resumen')
  const [ordenos, setOrdenos] = useState([])
  const [sanitarios, setSanitarios] = useState([])
  const [reproductivos, setReproductivos] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [fotos, setFotos] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [fotoAmpliada, setFotoAmpliada] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      const [
        { data: a },
        { data: o },
        { data: s },
        { data: r },
        { data: m },
        { data: f },
      ] = await Promise.all([
        supabase.from('animales').select('*,fincas(nombre),lotes(nombre)').eq('id', id).single(),
        supabase.from('ordenos').select('*').eq('animal_id', id).order('fecha', { ascending: false }).limit(30),
        supabase.from('eventos_sanitarios').select('*').eq('animal_id', id).order('fecha', { ascending: false }).limit(30),
        supabase.from('eventos_reproductivos').select('*').eq('animal_id', id).order('fecha', { ascending: false }).limit(30),
        supabase.from('movimientos_hato').select('*,finca_origen:fincas!movimientos_hato_finca_origen_id_fkey(nombre),finca_destino:fincas!movimientos_hato_finca_destino_id_fkey(nombre)').eq('animal_id', id).order('fecha', { ascending: false }).limit(20),
        supabase.from('fotos_animales').select('*').eq('animal_id', id).order('created_at', { ascending: false }),
      ])

      // Cargar madre y padre por separado para evitar self-join
      if (a?.madre_id) {
        const { data: madre } = await supabase.from('animales').select('identificacion,nombre').eq('id', a.madre_id).single()
        a.madre = madre
      }
      if (a?.padre_id) {
        const { data: padre } = await supabase.from('animales').select('identificacion,nombre').eq('id', a.padre_id).single()
        a.padre = padre
      }
      setAnimal(a)
      setOrdenos(o ?? [])
      setSanitarios(s ?? [])
      setReproductivos(r ?? [])
      setMovimientos(m ?? [])
      setFotos(f ?? [])
      setCargando(false)
    }
    cargar()
  }, [id])

  async function subirFoto(archivo) {
    if (!archivo) return
    setSubiendo(true)
    const path = `animales/${id}/${Date.now()}.${archivo.name.split('.').pop()}`
    const { error } = await supabase.storage.from('evidencias').upload(path, archivo)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('evidencias').getPublicUrl(path)
      await supabase.from('fotos_animales').insert({ animal_id: id, url: publicUrl, fecha: new Date().toISOString().split('T')[0] })
      const { data: nuevasFotos } = await supabase.from('fotos_animales').select('*').eq('animal_id', id).order('created_at', { ascending: false })
      setFotos(nuevasFotos ?? [])
    }
    setSubiendo(false)
  }

  if (cargando) return <div className="pt-8 text-center text-gray-400 text-sm">Cargando ficha...</div>
  if (!animal) return <div className="pt-8 text-center text-gray-400 text-sm">Animal no encontrado</div>

  // Litros últimos 7 días
  const hace7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const litros7 = ordenos.filter(o => o.fecha >= hace7).reduce((s, o) => s + Number(o.litros), 0)
  const litros30 = ordenos.reduce((s, o) => s + Number(o.litros), 0)

  const edad = animal.fecha_nacimiento
    ? Math.floor((Date.now() - new Date(animal.fecha_nacimiento)) / (365.25 * 86400000))
    : null

  return (
    <div className="space-y-4 pt-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">‹</button>
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            {animal.identificacion}{animal.nombre ? ` · ${animal.nombre}` : ''}
          </h2>
          <p className="text-sm text-gray-500">
            {animal.tipo} · {animal.raza ?? 'Sin raza'} · {animal.fincas?.nombre}
            {animal.lotes?.nombre ? ` · ${animal.lotes.nombre}` : ''}
          </p>
        </div>
      </div>

      {/* Foto */}
      {animal.foto_url && (
        <img src={animal.foto_url} alt={animal.identificacion}
          className="w-full h-48 object-cover rounded-xl border border-gray-200" />
      )}

      {/* Badges de estado */}
      <div className="flex flex-wrap gap-2">
        {animal.estado_productivo && (
          <Badge label={animal.estado_productivo.replace('_',' ')}
            color={animal.estado_productivo === 'en_ordeno' ? 'green' : animal.estado_productivo === 'seca' ? 'gray' : 'yellow'} />
        )}
        {animal.estado_reproductivo && <Badge label={animal.estado_reproductivo} color="blue" />}
        {animal.en_retiro_leche && <Badge label={`Retiro hasta ${fmtFecha(animal.fecha_fin_retiro)}`} color="red" />}
        {!animal.activa && <Badge label="Inactivo" color="gray" />}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition font-medium ${
              tab === t ? 'bg-verde-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Contenido por tab */}
      {tab === 'Resumen' && (
        <div className="space-y-4">
          {fotos.length > 0 && (
            <div className="relative cursor-pointer" onClick={() => setTab('Fotos')}>
              <img src={fotos[fotos.length - 1].url} alt="foto animal"
                className="w-full h-48 object-cover rounded-xl border border-gray-200" />
              <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">
                📷 {fotos.length} foto{fotos.length > 1 ? 's' : ''} · Ver todas
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <InfoCard label="Nacimiento" valor={fmtFecha(animal.fecha_nacimiento)} />
            <InfoCard label="Edad" valor={edad !== null ? `${edad} años` : '—'} />
            <InfoCard label="Sexo" valor={animal.sexo ?? '—'} />
            <InfoCard label="Litros (7 días)" valor={`${litros7.toFixed(1)} L`} />
            <InfoCard label="Litros (30 días)" valor={`${litros30.toFixed(1)} L`} />
            <InfoCard label="N° ordeños reg." valor={ordenos.length} />
          </div>
          {(animal.madre || animal.padre) && (
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Genealogía</p>
              {animal.madre && <p className="text-sm text-gray-700">Madre: <strong>{animal.madre.identificacion}{animal.madre.nombre ? ` (${animal.madre.nombre})` : ''}</strong></p>}
              {animal.padre && <p className="text-sm text-gray-700">Padre: <strong>{animal.padre.identificacion}{animal.padre.nombre ? ` (${animal.padre.nombre})` : ''}</strong></p>}
            </div>
          )}
        </div>
      )}

      {tab === 'Fotos' && (
        <div className="space-y-3">
          {fotos.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Sin fotos aún</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {fotos.map(f => (
                <div key={f.id} className="relative cursor-pointer" onClick={() => setFotoAmpliada(f.url)}>
                  <img src={f.url} alt="foto animal" className="w-full h-36 object-cover rounded-xl border border-gray-200" />
                  <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">{fmtFecha(f.fecha)}</div>
                </div>
              ))}
            </div>
          )}
          <label className="block border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-verde-400 transition">
            <div className="text-2xl mb-1">📷</div>
            <div className="text-sm text-gray-500">{subiendo ? 'Subiendo...' : '+ Agregar foto'}</div>
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={e => Array.from(e.target.files).forEach(f => subirFoto(f))} disabled={subiendo} />
          </label>
        </div>
      )}

      {/* Foto ampliada */}
      {fotoAmpliada && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={() => setFotoAmpliada(null)}>
          <img src={fotoAmpliada} alt="foto ampliada" className="max-w-full max-h-full object-contain rounded-xl" />
          <button className="absolute top-4 right-4 text-white text-3xl leading-none">×</button>
        </div>
      )}

      {tab === 'Ordeños' && (
        <div className="space-y-2">
          {ordenos.length === 0
            ? <p className="text-gray-400 text-sm text-center py-6">Sin registros de ordeño</p>
            : ordenos.map(o => (
              <div key={o.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-xl">🥛</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-800">{Number(o.litros).toFixed(1)} L</div>
                  <div className="text-xs text-gray-500">{fmtFecha(o.fecha)} · Ordeño #{o.numero_ordeno}</div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {tab === 'Sanidad' && (
        <div className="space-y-2">
          {sanitarios.length === 0
            ? <p className="text-gray-400 text-sm text-center py-6">Sin eventos sanitarios</p>
            : sanitarios.map(s => (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💉</span>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{s.tipo} · {fmtFecha(s.fecha)}</div>
                    {s.diagnostico && <div className="text-xs text-gray-600">{s.diagnostico}</div>}
                    {s.medicamento && <div className="text-xs text-gray-500">{s.medicamento}</div>}
                    {s.requiere_retiro && <div className="text-xs text-red-500 mt-0.5">Retiro hasta {fmtFecha(s.fecha_fin_retiro)}</div>}
                  </div>
                </div>
                {s.descripcion && <p className="text-xs text-gray-500 mt-1 pl-7">{s.descripcion}</p>}
                {s.foto_url && <img src={s.foto_url} alt="evidencia" className="mt-2 rounded-lg w-full max-h-32 object-cover" />}
              </div>
            ))
          }
        </div>
      )}

      {tab === 'Reproducción' && (
        <div className="space-y-2">
          {reproductivos.length === 0
            ? <p className="text-gray-400 text-sm text-center py-6">Sin eventos reproductivos</p>
            : reproductivos.map(r => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div className="text-sm font-semibold text-gray-800">{r.tipo.replace('_',' ')} · {fmtFecha(r.fecha)}</div>
                {r.metodo && <div className="text-xs text-gray-500">{r.metodo}{r.toro_o_semen ? ` · ${r.toro_o_semen}` : ''}</div>}
                {r.resultado && <div className="text-xs text-gray-600">Resultado: {r.resultado}</div>}
                {r.fecha_probable_parto && <div className="text-xs text-yellow-600">🐄 Parto probable: {fmtFecha(r.fecha_probable_parto)}</div>}
                {r.descripcion && <div className="text-xs text-gray-500 mt-0.5">{r.descripcion}</div>}
              </div>
            ))
          }
        </div>
      )}

      {tab === 'Movimientos' && (
        <div className="space-y-2">
          {movimientos.length === 0
            ? <p className="text-gray-400 text-sm text-center py-6">Sin movimientos registrados</p>
            : movimientos.map(m => (
              <div key={m.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div className="text-sm font-semibold text-gray-800">{m.tipo.replace('_',' ')} · {fmtFecha(m.fecha)}</div>
                <div className="text-xs text-gray-500">
                  {m.finca_origen?.nombre ?? '—'}{m.finca_destino?.nombre ? ` → ${m.finca_destino.nombre}` : ''}
                </div>
                {m.categoria_anterior && <div className="text-xs text-gray-500">{m.categoria_anterior} → {m.categoria_nueva}</div>}
                {m.valor && <div className="text-xs text-verde-700 font-medium">${Number(m.valor).toLocaleString('es-CO')}</div>}
                {m.descripcion && <div className="text-xs text-gray-500">{m.descripcion}</div>}
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

function Badge({ label, color }) {
  const colors = {
    green: 'bg-green-100 text-green-700',
    gray:  'bg-gray-100 text-gray-600',
    yellow:'bg-yellow-100 text-yellow-700',
    blue:  'bg-blue-100 text-blue-700',
    red:   'bg-red-100 text-red-600',
  }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[color] ?? colors.gray}`}>{label}</span>
}

function InfoCard({ label, valor }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="font-semibold text-gray-800 text-sm">{valor}</div>
    </div>
  )
}
