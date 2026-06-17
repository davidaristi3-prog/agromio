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

    // Verificar que el llamador es propietario o mayordomo
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

    // Traer todos los pendientes usando service_role (sin RLS)
    const [
      { data: ordenos },
      { data: sanitarios },
      { data: reproductivos },
    ] = await Promise.all([
      admin.from('ordenos')
        .select('id,fecha,litros')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false }),
      admin.from('eventos_sanitarios')
        .select('id,fecha,tipo,diagnostico')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false }),
      admin.from('eventos_reproductivos')
        .select('id,fecha,tipo')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false }),
    ])

    const items = [
      ...(ordenos ?? []).map(r => ({
        id: r.id,
        fecha: r.fecha,
        _tabla: 'ordenos',
        _desc: `Ordeño — ${Number(r.litros).toFixed(1)} L`,
      })),
      ...(sanitarios ?? []).map(r => ({
        id: r.id,
        fecha: r.fecha,
        _tabla: 'eventos_sanitarios',
        _desc: `Sanidad: ${r.tipo}${r.diagnostico ? ` — ${r.diagnostico}` : ''}`,
      })),
      ...(reproductivos ?? []).map(r => ({
        id: r.id,
        fecha: r.fecha,
        _tabla: 'eventos_reproductivos',
        _desc: `Reproducción: ${r.tipo}`,
      })),
    ]

    return resp({ items })

  } catch (e) {
    return resp({ error: e?.message ?? 'Error interno' }, 500)
  }
})
