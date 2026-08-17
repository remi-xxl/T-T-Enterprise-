import { useState, useEffect } from 'react'
import axios from 'axios'

function MonthlyReport() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [salesReps, setSalesReps] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedRepId, setSelectedRepId] = useState('')

  useEffect(() => {
    fetchSalesReps()
  }, [])

  const fetchSalesReps = async () => {
    try {
      const response = await axios.get('/api/salesreps')
      setSalesReps(response.data)
    } catch (error) {
      console.error('Error fetching sales reps:', error)
    }
  }

  const generateReport = async () => {
    setLoading(true)
    try {
      let url = `/api/reports/monthly?month=${selectedMonth}&year=${selectedYear}`
      if (selectedRepId) url += `&userId=${selectedRepId}`
      
      const response = await axios.get(url)
      setReport(response.data)
    } catch (error) {
      console.error('Error generating report:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMonthName = (month) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December']
    return months[month - 1]
  }

  const getPaymentBadge = (mode) => {
    const styles = { cash: 'bg-green-100 text-green-800', transfer: 'bg-blue-100 text-blue-800', card: 'bg-purple-100 text-purple-800' }
    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[mode] || 'bg-gray-100 text-gray-800'}`}>
        {mode.charAt(0).toUpperCase() + mode.slice(1)}
      </span>
    )
  }

  const printReport = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Monthly Sales Report</h1>
        {report && (
          <button onClick={printReport} className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
            Print Report
          </button>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Month</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                <option key={m} value={m}>{getMonthName(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Year</label>
            <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
              {[2023, 2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Sales Rep (Optional)</label>
            <select value={selectedRepId} onChange={(e) => setSelectedRepId(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
              <option value="">All Sales Reps</option>
              {salesReps.map(rep => (
                <option key={rep.id} value={rep.id}>{rep.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={generateReport} disabled={loading} className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>

      {report && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {getMonthName(report.period.month)} {report.period.year} Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-indigo-50 rounded-lg">
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-2xl font-bold text-indigo-600">N{report.summary.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-500">Total Pieces Sold</p>
                <p className="text-2xl font-bold text-green-600">{report.summary.totalQuantity}</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-gray-500">Total Transactions</p>
                <p className="text-2xl font-bold text-yellow-600">{report.summary.totalTransactions}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Breakdown</h3>
              <div className="space-y-3">
                {report.paymentBreakdown.map((item) => (
                  <div key={item.paymentMode} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      {getPaymentBadge(item.paymentMode)}
                      <span className="ml-2 text-gray-600">({item._count} sales)</span>
                    </div>
                    <span className="font-semibold text-green-600">N{(item._sum.totalAmount || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales by Rep</h3>
              <div className="space-y-3">
                {report.repStats.map((stat) => (
                  <div key={stat.userId} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{stat.repName}</p>
                      <p className="text-sm text-gray-500">{stat._count} sales, {stat._sum.totalQuantity} pieces</p>
                    </div>
                    <span className="font-semibold text-green-600">N{(stat._sum.totalAmount || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Transaction Details</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sold By</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {report.sales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(sale.saleDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {sale.items?.map((item, idx) => (
                        <div key={idx} className={!item.product ? 'italic text-gray-400' : 'mb-1'}>
                          <span className="font-medium">{item.product?.name || item.productName || 'Deleted Product'}</span>
                          {item.variant && <span className="text-indigo-600 ml-1">({item.variant.name})</span>}
                          <span className="text-gray-500 ml-1">— {item.quantity} {item.saleType}{item.quantity > 1 ? 's' : ''} @ N{Number(item.totalPrice).toLocaleString()}</span>
                        </div>
                      ))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {sale.items?.map((item, idx) => (
                        <span key={idx} className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full mr-1 ${item.saleType === 'carton' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                          {item.saleType === 'carton' ? 'Carton' : 'Piece'}
                        </span>
                      ))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.items?.map((item, idx) => (
                        <div key={idx} className="mb-1">{item.quantity} {item.saleType}{item.quantity > 1 ? 's' : ''}</div>
                      ))}
                      <div className="text-xs text-gray-400">Total: {sale.totalQuantity} pcs</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getPaymentBadge(sale.paymentMode)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">N{sale.totalAmount.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.user?.name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default MonthlyReport
