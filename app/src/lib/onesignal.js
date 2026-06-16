import OneSignal from 'react-onesignal'

const APP_ID = '3d8029bc-2d44-4c5f-a7fc-2e3e3952c513'

let inicializado = false

export async function inicializarOneSignal(usuarioId) {
  if (inicializado) return
  inicializado = true

  await OneSignal.init({
    appId: APP_ID,
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: false },
  })

  // Pedir permiso si aún no lo tiene
  const permiso = await OneSignal.Notifications.permission
  if (!permiso) {
    await OneSignal.Notifications.requestPermission()
  }

  // Vincular este dispositivo al usuario de Supabase
  if (usuarioId) {
    await OneSignal.login(usuarioId)
  }
}

export async function obtenerPlayerId() {
  try {
    return await OneSignal.User.PushSubscription.id
  } catch {
    return null
  }
}
