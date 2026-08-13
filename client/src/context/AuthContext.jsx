import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      fetchUser()
    } else {
      setLoading(false)
    }
  }, [token])

  const fetchUser = async () => {
    try {
      const response = await axios.get('/api/auth/me')
      setUser(response.data)
    } catch (error) {
      logout()
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    const response = await axios.post('/api/auth/login', { email, password })
    const { user: userData, token: authToken } = response.data
    localStorage.setItem('token', authToken)
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`
    setUser(userData)
    setToken(authToken)
    return userData
  }

  const register = async (name, email, password, role) => {
    const response = await axios.post('/api/auth/register', { name, email, password, role })
    const { user: userData, token: authToken } = response.data
    localStorage.setItem('token', authToken)
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`
    setUser(userData)
    setToken(authToken)
    return userData
  }

  const logout = () => {
    localStorage.removeItem('token')
    delete axios.defaults.headers.common['Authorization']
    setUser(null)
    setToken(null)
  }

  const isManager = user?.role === 'MANAGER'
  const isSalesRep = user?.role === 'SALES_REP'

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isManager, isSalesRep }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
