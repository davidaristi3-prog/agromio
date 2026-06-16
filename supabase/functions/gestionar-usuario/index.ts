import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

    const admin = createClient(supabaseUrl, serviceKey)

    // Verificar que el llamador está autenticado y tiene permiso
    const authHeader = req.headers.get('Authorization')!
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await caller.auth.getUser()
    if (!user) throw new Error('No autenticado')

    const { data: perfilCaller } = await admin
      .from('usuarios').select('rol').eq('id', user.id).single()
    if (!['propietario', 'mayordomo'].includes(perfilCaller?.rol)) {
      throw new Error('Sin permisos')
    }

    const body = await req.json()

    // ── Crear usuario ──────────────────────────────────────────────────────
    if (body.accion === 'crear') {
      const { email, password, nombre, rol } = body

      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (authErr) throw new Error(authErr.message)

      const { error: profileErr } = await admin.from('usuarios').insert({
        id: authData.user.id,
        email,
        nombre,
        rol,
        activo: true,
      })
      if (profileErr) {
        await admin.auth.admin.deleteUser(authData.user.id)
        throw new Error(profileErr.message)
      }

      return new Response(JSON.stringify({ ok: true, id: authData.user.id }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // ── Eliminar usuario ───────────────────────────────────────────────────
    if (body.accion === 'eliminar') {
      const { user_id } = body

      await admin.from('asignaciones_finca').delete().eq('usuario_id', user_id)
      await admin.from('usuarios').delete().eq('id', user_id)
      const { error } = await admin.auth.admin.deleteUser(user_id)
      if (error) throw new Error(error.message)

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    throw new Error('Acción desconocida')
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
