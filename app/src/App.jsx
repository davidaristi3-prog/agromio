import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Hub from './components/Hub'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DashboardMayordomo from './pages/DashboardMayordomo'
import DashboardTrabajador from './pages/DashboardTrabajador'
import Animales from './pages/Animales'
import Tareas from './pages/Tareas'
import Ordenos from './pages/Ordenos'
import Sanidad from './pages/Sanidad'
import Reproduccion from './pages/Reproduccion'
import Movimientos from './pages/Movimientos'
import Fincas from './pages/Fincas'
import Usuarios from './pages/Usuarios'
import Mas from './pages/Mas'
import Inventario from './pages/Inventario'
import FichaAnimal from './pages/FichaAnimal'
import Reportes from './pages/Reportes'
import Finanzas from './pages/Finanzas'
import Busqueda from './pages/Busqueda'
import Perfil from './pages/Perfil'
import TareasRecurrentes from './pages/TareasRecurrentes'
import HistorialAprobaciones from './pages/HistorialAprobaciones'
import ResumenActividades from './pages/ResumenActividades'

// Pestañas del módulo Animales (iguales para todos los roles)
const TABS_ANIMALES = [
  { to: '/animales',              label: 'Listado',      icon: '🐄', end: true },
  { to: '/animales/reproduccion', label: 'Reproducción', icon: '🔬' },
  { to: '/animales/sanidad',      label: 'Sanidad',      icon: '💉' },
  { to: '/animales/movimientos',  label: 'Movimientos',  icon: '🚛' },
]

function ActividadesHub() {
  const { perfil } = useAuth()
  const tabs = [
    { to: '/actividades',             label: 'Resumen',     icon: '📊', end: true },
    { to: '/actividades/puntuales',   label: 'Puntuales',   icon: '✅' },
    { to: '/actividades/recurrentes', label: 'Recurrentes', icon: '🔄' },
  ]
  if (perfil?.rol === 'propietario' || perfil?.rol === 'mayordomo') {
    tabs.push({ to: '/actividades/historial', label: 'Aprobaciones', icon: '📋' })
  }
  return <Hub tabs={tabs} />
}

function Rutas() {
  const { session, perfil } = useAuth()

  if (session === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando...</div>
  }

  if (!session) return <Login />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={
            perfil?.rol === 'trabajador' ? <DashboardTrabajador /> :
            perfil?.rol === 'mayordomo'  ? <DashboardMayordomo />  :
            <Dashboard />
          } />

          {/* Módulo Animales (hub con pestañas) */}
          <Route path="/animales" element={<Hub tabs={TABS_ANIMALES} />}>
            <Route index element={<Animales />} />
            <Route path="reproduccion" element={<Reproduccion />} />
            <Route path="sanidad"      element={<Sanidad />} />
            <Route path="movimientos"  element={<Movimientos />} />
          </Route>
          <Route path="/animales/ficha/:id" element={<FichaAnimal />} />

          {/* Módulo Actividades (hub con pestañas) */}
          <Route path="/actividades" element={<ActividadesHub />}>
            <Route index element={<ResumenActividades />} />
            <Route path="puntuales"   element={<Tareas />} />
            <Route path="recurrentes" element={<TareasRecurrentes />} />
            <Route path="historial"   element={<HistorialAprobaciones />} />
          </Route>

          {/* Acceso directo (barra inferior) */}
          <Route path="/ordenos" element={<Ordenos />} />

          {/* Menú "Más" y sus módulos */}
          <Route path="/mas"        element={<Mas />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/fincas"     element={<Fincas />} />
          <Route path="/equipo"     element={<Usuarios />} />
          <Route path="/financiero" element={<Finanzas />} />
          <Route path="/reportes"   element={<Reportes />} />
          <Route path="/perfil"     element={<Perfil />} />
          <Route path="/busqueda"   element={<Busqueda />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Rutas />
    </AuthProvider>
  )
}
