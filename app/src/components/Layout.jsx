import { NavLink, Outlet, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navPrincipal = [
  { to: '/',          icon: '🏠', label: 'Inicio'   },
  { to: '/animales',  icon: '🐄', label: 'Animales' },
  { to: '/tareas',    icon: '✅', label: 'Tareas'   },
  { to: '/ordenos',   icon: '🥛', label: 'Ordeños'  },
  { to: '/mas',       icon: '☰',  label: 'Más'      },
]

const masModulos = [
  { to: '/sanidad',     icon: '💉', label: 'Sanidad'      },
  { to: '/reproduccion',icon: '🔬', label: 'Reproducción' },
  { to: '/movimientos', icon: '🚛', label: 'Movimientos'  },
  { to: '/fincas',      icon: '🏡', label: 'Fincas'       },
  { to: '/equipo',      icon: '👥', label: 'Equipo'       },
]

export default function Layout() {
  const { perfil, logout } = useAuth()

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-verde-700 text-white px-4 py-3 flex items-center justify-between shadow">
        <span className="font-bold text-lg">🐄 AGROMIO</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-verde-100">{perfil?.nombre}</span>
          <button onClick={logout} className="text-xs bg-verde-800 hover:bg-verde-900 px-3 py-1 rounded-full transition">
            Salir
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full pb-24">
        <Outlet />
      </main>

      {/* Barra de navegación inferior */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2 shadow-lg">
        {navPrincipal.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center text-xs gap-0.5 px-3 py-1 rounded-lg transition ${
                isActive ? 'text-verde-700 font-semibold' : 'text-gray-500'
              }`
            }
          >
            <span className="text-xl">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
