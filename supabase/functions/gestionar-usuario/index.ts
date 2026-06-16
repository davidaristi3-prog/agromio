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

    if (!supabaseUrl || !serviceKey) return resp({ error: 'Variables de entorno faltantes' }, 500)

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Verificar que el llamador está autenticado
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return resp({ error: 'Sin autorización' }, 401)

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user }, error: authErr } = await caller.auth.getUser()
    if (authErr || !user) return resp({ error: 'No autenticado' }, 401)

    const { data: perfilCaller, error: perfilErr } = await admin
      .from('usuarios').select('rol').eq('id', user.id).single()
    if (perfilErr || !perfilCaller) return resp({ error: 'Perfil no encontrado' }, 403)
    if (!['propietario', 'mayordomo'].includes(perfilCaller.rol)) {
      return resp({ error: 'Sin permisos para gestionar usuarios' }, 403)
    }

    const body = await req.json()

    // ── Crear usuario ──────────────────────────────────────────────────────
    if (body.accion === 'crear') {
      const { email, password, nombre, rol } = body
      if (!email || !password || !nombre || !rol) {
        return resp({ error: 'Faltan campos obligatorios' }, 400)
      }

      const { data: authData, error: authCreateErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (authCreateErr) return resp({ error: authCreateErr.message }, 400)

      const { error: profileErr } = await admin.from('usuarios').insert({
        id: authData.user.id,
        email,
        nombre,
        rol,
        activo: true,
      })
      if (profileErr) {
        await admin.auth.admin.deleteUser(authData.user.id)
        return resp({ error: profileErr.message }, 400)
      }

      return resp({ ok: true, id: authData.user.id })
    }

    // ── Eliminar usuario ───────────────────────────────────────────────────
    if (body.accion === 'eliminar') {
      const { user_id } = body
      if (!user_id) return resp({ error: 'Falta user_id' }, 400)

      await admin.from('asignaciones_finca').delete().eq('usuario_id', user_id)
      await admin.from('usuarios').delete().eq('id', user_id)
      const { error: delErr } = await admin.auth.admin.deleteUser(user_id)
      if (delErr) return resp({ error: delErr.message }, 400)

      return resp({ ok: true })
    }

    return resp({ error: 'Acción desconocida' }, 400)

  } catch (e) {
    return resp({ error: e?.message ?? 'Error interno' }, 500)
  }
})
