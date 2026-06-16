import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { asignado_a, titulo, descripcion } = await req.json()

    if (!asignado_a) {
      return new Response(JSON.stringify({ ok: true, msg: 'sin asignado' }), { headers: corsHeaders })
    }

    const oneSignalAppId  = Deno.env.get('ONESIGNAL_APP_ID')!
    const oneSignalApiKey = Deno.env.get('ONESIGNAL_REST_API_KEY')!

    // Enviar por external_user_id (el UUID de Supabase del trabajador)
    const payload = {
      app_id: oneSignalAppId,
      target_channel: 'push',
      include_aliases: { external_id: [asignado_a] },
      headings: { es: '📋 Nueva tarea asignada' },
      contents: { es: titulo + (descripcion ? ` — ${descripcion}` : '') },
    }

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${oneSignalApiKey}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    return new Response(JSON.stringify({ ok: true, onesignal: data }), { headers: corsHeaders })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
