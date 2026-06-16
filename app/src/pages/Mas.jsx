import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const MODULOS_PROPIETARIO = [
  { to: '/perfil',      icon: '👤', label: 'Mi perfil',     desc: 'Información personal y contraseña' },
  { to: '/reportes',    icon: '📊', label: 'Reportes',      desc: 'Producción, actividades y estadísticas' },
  { to: '/finanzas',    icon: '💰', label: 'Finanzas',      desc: 'Ingresos, gastos y costo por litro' },
  { to: '/sanidad',     icon: '💉', label: 'Sanidad',       desc: 'Tratamientos, vacunas, retiro de leche' },
  { to: '/reproduccion',icon: '🔬', label: 'Reproducción',  desc: 'Celos, servicios, partos, diagnósticos' },
  { to: '/movimientos', icon: '🚛', label: 'Movimientos',   desc: 'Traslados, compras, ventas, bajas' },
  { to: '/inventario',  icon: '📦', label: 'Inventario',    desc: 'Medicamentos, concentrado, minerales' },
  { to: '/fincas',      icon: '🏡', label: 'Fincas',        desc: 'Gestión de fincas y lotes/potreros' },
  { to: '/equipo',             icon: '👥', label: 'Equipo',             desc: 'Mayordomos, trabajadores y asignaciones' },
  { to: '/tareas-recurrentes', icon: '🔄', label: 'Actividades recurrentes', desc: 'Ver y gestionar actividades diarias del equipo' },
]

const MODULOS_MAYORDOMO = [
  { to: '/perfil',               icon: '👤', label: 'Mi perfil',          desc: 'Información personal y contraseña' },
  { to: '/tareas-recurrentes',   icon: '🔄', label: 'Actividades recurrentes', desc: 'Ver y gestionar actividades diarias del equipo' },
  { to: '/sanidad',              icon: '💉', label: 'Sanidad',            desc: 'Tratamientos, vacunas, retiro de leche' },
  { to: '/reproduccion',icon: '🔬', label: 'Reproducción',  desc: 'Celos, servicios, partos, diagnósticos' },
  { to: '/movimientos', icon: '🚛', label: 'Movimientos',   desc: 'Traslados, compras, ventas, bajas' },
  { to: '/inventario',  icon: '📦', label: 'Inventario',    desc: 'Medicamentos, concentrado, minerales' },
  { to: '/fincas',      icon: '🏡', label: 'Fincas',        desc: 'Gestión de fincas y lotes/potreros' },
]

const MODULOS_TRABAJADOR = [
  { to: '/perfil',               icon: '👤', label: 'Mi perfil',          desc: 'Información personal y contraseña' },
  { to: '/tareas-recurrentes',   icon: '🔄', label: 'Actividades del día',     desc: 'Ver tus actividades diarias' },
  { to: '/fincas',               icon: '🏡', label: 'Fincas',             desc: 'Ver fincas y lotes' },
  { to: '/movimientos',          icon: '🚛', label: 'Movimientos',        desc: 'Traslados del hato' },
]

export default function Mas() {
  const { perfil, logout } = useAuth()

  const modulos =
    perfil?.rol === 'trabajador' ? MODULOS_TRABAJADOR :
    perfil?.rol === 'mayordomo'  ? MODULOS_MAYORDOMO  :
    MODULOS_PROPIETARIO

  return (
    <div className="space-y-4 pt-2">
      <h2 className="text-xl font-bold text-gray-800">Más módulos</h2>
      <div className="space-y-2">
        {modulos.map(({ to, icon, label, desc }) => (
          <Link key={to} to={to}
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4 hover:shadow transition">
            <span className="text-3xl">{icon}</span>
            <div>
              <div className="font-semibold text-gray-800 text-sm">{label}</div>
              <div className="text-xs text-gray-500">{desc}</div>
            </div>
            <span className="ml-auto text-gray-300 text-lg">›</span>
          </Link>
        ))}
      </div>

      <div className="pt-4 border-t border-gray-200">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 space-y-1">
          <div className="text-sm font-semibold text-gray-700">{perfil?.nombre}</div>
          <div className="text-xs text-gray-500">{perfil?.email} · {perfil?.rol}</div>
          <button onClick={logout} className="text-xs text-red-500 hover:text-red-700 transition mt-1">
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
