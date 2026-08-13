import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const RoleContext = createContext(null)

export function RoleProvider({ children }) {
  const [currentRole, setCurrentRole] = useState('SALES_REP')
  const [managerLoggedIn, setManagerLoggedIn] = useState(() => {
    return localStorage.getItem('managerLoggedIn') === 'true'
  })
  const [managerInfo, setManagerInfo] = useState(() => {
    const saved = localStorage.getItem('managerInfo')
    return saved ? JSON.parse(saved) : null
  })

  useEffect(() => {
    localStorage.setItem('managerLoggedIn', managerLoggedIn)
    if (managerInfo) {
      localStorage.setItem('managerInfo', JSON.stringify(managerInfo))
    } else {
      localStorage.removeItem('managerInfo')
    }
  }, [managerLoggedIn, managerInfo])

  const managerLogin = async (email, password) => {
    const response = await axios.post('/api/auth/manager-login', { email, password })
    if (response.data.success) {
      setManagerLoggedIn(true)
      setManagerInfo(response.data.manager)
      setCurrentRole('MANAGER')
      return true
    }
    return false
  }

  const managerLogout = () => {
    setManagerLoggedIn(false)
    setManagerInfo(null)
    setCurrentRole('SALES_REP')
    localStorage.removeItem('managerLoggedIn')
    localStorage.removeItem('managerInfo')
  }

  const switchToManager = () => {
    if (managerLoggedIn) {
      setCurrentRole('MANAGER')
    }
  }

  const switchToSalesRep = () => {
    setCurrentRole('SALES_REP')
  }

  const isManager = currentRole === 'MANAGER' && managerLoggedIn
  const isSalesRep = currentRole === 'SALES_REP'

  return (
    <RoleContext.Provider value={{ 
      currentRole, 
      managerLoggedIn,
      managerInfo,
      managerLogin,
      managerLogout,
      switchToManager,
      switchToSalesRep,
      isManager, 
      isSalesRep 
    }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const context = useContext(RoleContext)
  if (!context) throw new Error('useRole must be used within a RoleProvider')
  return context
}
