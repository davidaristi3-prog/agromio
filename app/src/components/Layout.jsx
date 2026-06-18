import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PawPrint, Home, ListChecks, Milk, Menu, Search } from './icons'

const navPrincipal = [
  { to: '/',            icon: Home,       label: 'Inicio'      },
  { to: '/animales',    icon: PawPrint,   label: 'Animales'    },
  { to: '/actividades', icon: ListChecks, label: 'Actividades' },
  { to: '/ordenos',     icon: Milk,       label: 'Ordeños'     },
  { to: '/mas',         icon: Menu,       label: 'Más'         },
]

export default function Layout() {
  const { perfil } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-verde-800 text-white px-4 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => navigate('/')}
          className="font-semibold text-lg tracking-tight hover:text-verde-100 transition"
        >
          AGROMIO
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/busqueda')}
            aria-label="Buscar"
            className="hover:text-verde-100 transition"
          >
            <Search size={20} />
          </button>
          <span className="text-sm text-verde-100">{perfil?.nombre}</span>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full pb-24">
        <Outlet />
      </main>

      {/* Barra de navegación inferior */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center px-2 pt-2 pb-6 shadow-[0_-1px_3px_rgba(0,0,0,0.04)]">
        {navPrincipal.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center text-xs gap-1 px-4 py-1.5 rounded-lg transition ${
                isActive ? 'text-verde-700 font-semibold' : 'text-gray-400'
              }`
            }
          >
            <Icon size={22} strokeWidth={2} />
            <span className="text-[11px]">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
