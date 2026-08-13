import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom'
import { RoleProvider, useRole } from './context/RoleContext'
import Dashboard from './components/Dashboard'
import Products from './components/Products'
import Sales from './components/Sales'
import WholesaleSales from './components/WholesaleSales'
import Inventory from './components/Inventory'
import MonthlyReport from './components/MonthlyReport'
import Admin from './components/Admin'
import './App.css'

function ManagerLoginModal({ onClose }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { managerLogin } = useRole()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const success = await managerLogin(email, password)
      if (success) {
        onClose()
      } else {
        setError('Invalid credentials')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-32 mx-auto p-6 border w-96 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Manager Login</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">X</button>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              placeholder="admin@store.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              placeholder="Enter password"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </form>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">Default: admin@store.com / admin123</p>
        </div>
      </div>
    </div>
  )
}

function RoleSelector() {
  const { currentRole, managerLoggedIn, switchToManager, switchToSalesRep, managerLogout, managerInfo } = useRole()
  const [showLoginModal, setShowLoginModal] = useState(false)

  const handleManagerClick = () => {
    if (managerLoggedIn) {
      switchToManager()
    } else {
      setShowLoginModal(true)
    }
  }

  const handleLoginSuccess = () => {
    setShowLoginModal(false)
  }

  return (
    <>
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">View as:</span>
              <div className="flex space-x-2">
                <button
                  onClick={handleManagerClick}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    currentRole === 'MANAGER' && managerLoggedIn
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Manager
                </button>
                <button
                  onClick={switchToSalesRep}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    currentRole === 'SALES_REP' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Sales Rep
                </button>
              </div>
            </div>
            {managerLoggedIn && (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600">Logged in as: <span className="font-medium">{managerInfo?.name}</span></span>
                <button onClick={managerLogout} className="text-sm text-red-600 hover:text-red-800">Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {showLoginModal && <ManagerLoginModal onClose={handleLoginSuccess} />}
    </>
  )
}

function AppContent() {
  const { isManager, isSalesRep, managerLoggedIn } = useRole()

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-indigo-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-xl font-bold">T&T ENTERPRISE</Link>
              <div className="flex space-x-4">
                {isManager && (
                  <Link to="/" className="hover:text-indigo-200 px-3 py-2 rounded-md text-sm font-medium">
                    Dashboard
                  </Link>
                )}
                <Link to="/sales" className="hover:text-indigo-200 px-3 py-2 rounded-md text-sm font-medium">
                  {isSalesRep ? 'Record Sale' : 'Retail Sales'}
                </Link>
                <Link to="/wholesale" className="hover:text-indigo-200 px-3 py-2 rounded-md text-sm font-medium">
                  Wholesale
                </Link>
                {isManager && (
                  <>
                    <Link to="/products" className="hover:text-indigo-200 px-3 py-2 rounded-md text-sm font-medium">
                      Products
                    </Link>
                    <Link to="/inventory" className="hover:text-indigo-200 px-3 py-2 rounded-md text-sm font-medium">
                      Inventory
                    </Link>
                    <Link to="/reports" className="hover:text-indigo-200 px-3 py-2 rounded-md text-sm font-medium">
                      Monthly Report
                    </Link>
                    <Link to="/admin" className="hover:text-indigo-200 px-3 py-2 rounded-md text-sm font-medium">
                      Admin
                    </Link>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                isManager ? 'bg-indigo-800 text-indigo-100' : 'bg-green-800 text-green-100'
              }`}>
                {isManager ? 'Manager Mode' : 'Sales Rep Mode'}
              </span>
            </div>
          </div>
        </div>
      </nav>
      
      <RoleSelector />
      
      <main className="max-w-7xl mx-auto py-6 px-4">
        <Routes>
          <Route path="/" element={isManager ? <Dashboard /> : (managerLoggedIn ? <Navigate to="/sales" /> : <Navigate to="/sales" />)} />
          <Route path="/products" element={isManager ? <Products /> : <Navigate to="/sales" />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/wholesale" element={<WholesaleSales />} />
          <Route path="/inventory" element={isManager ? <Inventory /> : <Navigate to="/sales" />} />
          <Route path="/reports" element={isManager ? <MonthlyReport /> : <Navigate to="/sales" />} />
          <Route path="/admin" element={isManager ? <Admin /> : <Navigate to="/sales" />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <Router>
      <RoleProvider>
        <AppContent />
      </RoleProvider>
    </Router>
  )
}

export default App
