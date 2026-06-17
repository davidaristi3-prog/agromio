import { NavLink, Outlet } from 'react-router-dom'

// Barra de pestañas reutilizable para los módulos-hub (Animales, Actividades...).
// Recibe un arreglo de { to, label, icon, end } y renderiza la sub-página activa.
export default function Hub({ tabs }) {
  return (
    <div className="space-y-4">
      <nav className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        {tabs.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-1 whitespace-nowrap text-sm px-4 py-2 rounded-full border transition ${
                isActive
                  ? 'bg-verde-600 text-white border-verde-600 font-semibold'
                  : 'bg-white text-gray-500 border-gray-200'
              }`
            }
          >
            {icon && <span>{icon}</span>}
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
