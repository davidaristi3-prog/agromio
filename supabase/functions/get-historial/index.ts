import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function resp(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return resp({ error: 'Sin autorización' }, 401)

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user }, error: authErr } = await caller.auth.getUser()
    if (authErr || !user) return resp({ error: 'No autenticado' }, 401)

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: perfilCaller } = await admin
      .from('usuarios').select('rol').eq('id', user.id).single()

    if (!['propietario', 'mayordomo'].includes(perfilCaller?.rol ?? '')) {
      return resp({ error: 'Sin permisos' }, 403)
    }

    const [
      { data: ordenos },
      { data: sanitarios },
      { data: reproductivos },
      { data: reportes },
    ] = await Promise.all([
      admin.from('ordenos')
        .select('id,fecha,litros,estado,comentario_rechazo,creado_por,aprobado_por')
        .in('estado', ['aprobado', 'rechazado'])
        .order('created_at', { ascending: false })
        .limit(100),
      admin.from('eventos_sanitarios')
        .select('id,fecha,tipo,diagnostico,estado,comentario_rechazo,creado_por,aprobado_por')
        .in('estado', ['aprobado', 'rechazado'])
        .order('created_at', { ascending: false })
        .limit(100),
      admin.from('eventos_reproductivos')
        .select('id,fecha,tipo,estado,comentario_rechazo,creado_por,aprobado_por')
        .in('estado', ['aprobado', 'rechazado'])
        .order('created_at', { ascending: false })
        .limit(100),
      admin.from('reportes_trabajador')
        .select('id,fecha,titulo,descripcion,estado,comentario_rechazo,creado_por,aprobado_por')
        .in('estado', ['aprobado', 'rechazado'])
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    const allRows = [
      ...(ordenos ?? []),
      ...(sanitarios ?? []),
      ...(reproductivos ?? []),
      ...(reportes ?? []),
    ]
    const userIds = [...new Set(
      allRows.flatMap(r => [r.creado_por, r.aprobado_por]).filter(Boolean)
    )]

    const { data: usuarios } = userIds.length
      ? await admin.from('usuarios').select('id,nombre').in('id', userIds)
      : { data: [] }

    const userMap: Record<string, string> = Object.fromEntries(
      (usuarios ?? []).map(u => [u.id, u.nombre])
    )

    const items = [
      ...(ordenos ?? []).map(r => ({
        id: r.id, fecha: r.fecha, _tabla: 'ordenos',
        _desc: `Ordeño — ${Number(r.litros).toFixed(1)} L`,
        estado: r.estado, comentario_rechazo: r.comentario_rechazo,
        creado_por_nombre: userMap[r.creado_por] ?? '—',
        aprobado_por_nombre: userMap[r.aprobado_por] ?? '—',
      })),
      ...(sanitarios ?? []).map(r => ({
        id: r.id, fecha: r.fecha, _tabla: 'eventos_sanitarios',
        _desc: `Sanidad: ${r.tipo}${r.diagnostico ? ` — ${r.diagnostico}` : ''}`,
        estado: r.estado, comentario_rechazo: r.comentario_rechazo,
        creado_por_nombre: userMap[r.creado_por] ?? '—',
        aprobado_por_nombre: userMap[r.aprobado_por] ?? '—',
      })),
      ...(reproductivos ?? []).map(r => ({
        id: r.id, fecha: r.fecha, _tabla: 'eventos_reproductivos',
        _desc: `Reproducción: ${r.tipo}`,
        estado: r.estado, comentario_rechazo: r.comentario_rechazo,
        creado_por_nombre: userMap[r.creado_por] ?? '—',
        aprobado_por_nombre: userMap[r.aprobado_por] ?? '—',
      })),
      ...(reportes ?? []).map(r => ({
        id: r.id, fecha: r.fecha, _tabla: 'reportes_trabajador',
        _desc: `⚡ Reporte: ${r.titulo}${r.descripcion ? ` — ${r.descripcion}` : ''}`,
        estado: r.estado, comentario_rechazo: r.comentario_rechazo,
        creado_por_nombre: userMap[r.creado_por] ?? '—',
        aprobado_por_nombre: userMap[r.aprobado_por] ?? '—',
      })),
    ].sort((a, b) => b.fecha.localeCompare(a.fecha))

    return resp({ items })

  } catch (e) {
    return resp({ error: e?.message ?? 'Error interno' }, 500)
  }
})
