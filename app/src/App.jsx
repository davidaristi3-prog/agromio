import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
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

function Rutas() {
  const { session } = useAuth()

  if (session === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando...</div>
  }

  if (!session) return <Login />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/"             element={<Dashboard />}   />
          <Route path="/animales"     element={<Animales />}    />
          <Route path="/tareas"       element={<Tareas />}      />
          <Route path="/ordenos"      element={<Ordenos />}     />
          <Route path="/sanidad"      element={<Sanidad />}     />
          <Route path="/reproduccion" element={<Reproduccion />}/>
          <Route path="/movimientos"  element={<Movimientos />} />
          <Route path="/fincas"       element={<Fincas />}      />
          <Route path="/equipo"       element={<Usuarios />}    />
          <Route path="/mas"          element={<Mas />}         />
          <Route path="/inventario"   element={<Inventario />}  />
          <Route path="/animales/:id" element={<FichaAnimal />} />
          <Route path="/reportes"    element={<Reportes />}   />
          <Route path="*"             element={<Navigate to="/" replace />} />
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
