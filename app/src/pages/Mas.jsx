import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Target, Map, Package, Warehouse, Users, Wallet, BarChart3, User, ChevronRight } from '../components/icons'

const MODULOS_PROPIETARIO = [
  { to: '/metas',      icon: Target,    label: 'Metas',       desc: 'Objetivos y avance con semáforo' },
  { to: '/potreros',   icon: Map,       label: 'Potreros',    desc: 'Mapa satelital, dibujar cercas y ubicación' },
  { to: '/inventario', icon: Package,   label: 'Inventario',  desc: 'Medicamentos, concentrado, minerales' },
  { to: '/fincas',     icon: Warehouse, label: 'Fincas',      desc: 'Gestión de fincas y lotes/potreros' },
  { to: '/equipo',     icon: Users,     label: 'Equipo',      desc: 'Mayordomos, trabajadores y asignaciones' },
  { to: '/financiero', icon: Wallet,    label: 'Financiero',  desc: 'Ingresos, gastos y costo por litro' },
  { to: '/reportes',   icon: BarChart3, label: 'Reportes',    desc: 'Producción, actividades y estadísticas' },
  { to: '/perfil',     icon: User,      label: 'Mi perfil',   desc: 'Información personal y contraseña' },
]

const MODULOS_MAYORDOMO = [
  { to: '/metas',      icon: Target,    label: 'Metas',      desc: 'Objetivos y avance con semáforo' },
  { to: '/potreros',   icon: Map,       label: 'Potreros',   desc: 'Mapa satelital, dibujar cercas y ubicación' },
  { to: '/inventario', icon: Package,   label: 'Inventario', desc: 'Medicamentos, concentrado, minerales' },
  { to: '/fincas',     icon: Warehouse, label: 'Fincas',     desc: 'Gestión de fincas y lotes/potreros' },
  { to: '/perfil',     icon: User,      label: 'Mi perfil',  desc: 'Información personal y contraseña' },
]

const MODULOS_TRABAJADOR = [
  { to: '/potreros', icon: Map,       label: 'Potreros',   desc: '¿En qué potrero estás? Mapa con tu ubicación' },
  { to: '/fincas',   icon: Warehouse, label: 'Fincas',     desc: 'Ver fincas y lotes' },
  { to: '/perfil',   icon: User,      label: 'Mi perfil',  desc: 'Información personal y contraseña' },
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
        {modulos.map(({ to, icon: Icon, label, desc }) => (
          <Link key={to} to={to}
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4 hover:shadow transition">
            <Icon size={26} className="text-verde-700 flex-shrink-0" />
            <div>
              <div className="font-semibold text-gray-800 text-sm">{label}</div>
              <div className="text-xs text-gray-500">{desc}</div>
            </div>
            <ChevronRight size={20} className="ml-auto text-gray-300" />
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
