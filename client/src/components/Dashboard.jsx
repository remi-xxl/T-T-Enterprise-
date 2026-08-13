import { useState, useEffect } from 'react'
import axios from 'axios'

function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchDashboard() }, [])

  const fetchDashboard = async () => {
    try {
      const response = await axios.get('/api/dashboard')
      setStats(response.data)
    } catch (error) {
      console.error('Error fetching dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPaymentIcon = (mode) => {
    const icons = { cash: '💵', transfer: '🏦', card: '💳' }
    return icons[mode] || '💰'
  }

  if (loading) return <div className="flex justify-center items-center h-64"><div className="text-gray-500">Loading...</div></div>

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-indigo-100 rounded-full"><span className="text-2xl">📦</span></div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Products</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.totalProducts || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full"><span className="text-2xl">💰</span></div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Inventory Value</p>
              <p className="text-2xl font-semibold text-gray-900">N{(stats?.totalInventoryValue || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-full"><span className="text-2xl">📈</span></div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Today's Sales</p>
              <p className="text-2xl font-semibold text-gray-900">N{(stats?.todayStats?.revenue || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-full"><span className="text-2xl">⚠️</span></div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Low Stock Items</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.lowStockProducts?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Pieces Sold</span>
              <span className="font-medium">{stats?.todayStats?.piecesSold || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Transactions</span>
              <span className="font-medium">{stats?.todayStats?.transactions || 0}</span>
            </div>
            <div className="flex justify-between border-t pt-3">
              <span className="text-gray-600">Revenue</span>
              <span className="font-bold text-green-600">N{(stats?.todayStats?.revenue || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Breakdown</h2>
          {stats?.paymentBreakdown?.length === 0 ? (
            <p className="text-gray-500">No payments recorded yet</p>
          ) : (
            <div className="space-y-3">
              {stats?.paymentBreakdown?.map((item) => (
                <div key={item.paymentMode} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="flex items-center text-gray-800">
                    <span className="mr-2">{getPaymentIcon(item.paymentMode)}</span>
                    {item.paymentMode.charAt(0).toUpperCase() + item.paymentMode.slice(1)}
                  </span>
                  <div className="text-right">
                    <span className="font-medium text-green-600">N{(item._sum.totalAmount || 0).toLocaleString()}</span>
                    <span className="text-xs text-gray-500 ml-2">({item._count} sales)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Low Stock Alert</h2>
          {stats?.lowStockProducts?.length === 0 ? (
            <p className="text-gray-500">All products are well stocked</p>
          ) : (
            <div className="space-y-3">
              {stats?.lowStockProducts?.map((product, idx) => (
                <div key={`${product.id}-${idx}`} className="flex justify-between items-center p-2 bg-red-50 rounded">
                  <span className="text-gray-800">{product.name}{product.variantName ? ` - ${product.variantName}` : ''}</span>
                  <span className="text-red-600 font-medium">{product.remainingPieces || 0} left</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Sales by Rep</h2>
        {stats?.dailyRepStats?.length === 0 ? (
          <p className="text-gray-500">No sales today</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats?.dailyRepStats?.map((stat) => (
              <div key={stat.userId} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{stat.repName}</p>
                  <p className="text-sm text-gray-500">{stat._count} sales, {stat._sum.totalQuantity} pieces</p>
                </div>
                <span className="font-bold text-green-600">N{(stat._sum.totalAmount || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">All Time Stats</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Total Revenue</p>
            <p className="text-2xl font-bold text-indigo-600">N{(stats?.totalStats?.revenue || 0).toLocaleString()}</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Total Pieces Sold</p>
            <p className="text-2xl font-bold text-indigo-600">{stats?.totalStats?.piecesSold || 0}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
