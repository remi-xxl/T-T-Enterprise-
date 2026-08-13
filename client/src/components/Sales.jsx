import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useRole } from '../context/RoleContext'

function Sales() {
  const { isManager, isSalesRep } = useRole()
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState([])
  const [salesReps, setSalesReps] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedRepId, setSelectedRepId] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [filteredProducts, setFilteredProducts] = useState([])
  const productDropdownRef = useRef(null)
  const [formData, setFormData] = useState({
    productId: '', variantId: '', quantity: '', saleType: 'piece', paymentMode: 'cash', notes: ''
  })
  const [filterDate, setFilterDate] = useState({ startDate: '', endDate: '' })

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    if (productSearch.trim() === '') {
      setFilteredProducts(products)
    } else {
      const search = productSearch.toLowerCase()
      setFilteredProducts(products.filter(p =>
        p.name.toLowerCase().includes(search) ||
        (p.colorCode && p.colorCode.toLowerCase().includes(search)) ||
        p.variants?.some(v => v.name.toLowerCase().includes(search))
      ))
    }
  }, [productSearch, products])

  useEffect(() => {
    function handleClickOutside(event) {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target)) {
        setShowProductDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchData = async () => {
    try {
      const [productsRes, salesRes, repsRes] = await Promise.all([
        axios.get('/api/products'),
        axios.get('/api/sales'),
        axios.get('/api/salesreps')
      ])
      setProducts(productsRes.data)
      setSales(salesRes.data)
      setSalesReps(repsRes.data)
      if (repsRes.data.length > 0 && !selectedRepId) setSelectedRepId(repsRes.data[0].id.toString())
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProductSelect = (product) => {
    setFormData({ ...formData, productId: product.id.toString(), variantId: '' })
    setProductSearch(product.name)
    setShowProductDropdown(false)
  }

  const handleProductSearchChange = (e) => {
    setProductSearch(e.target.value)
    setShowProductDropdown(true)
    if (e.target.value === '') {
      setFormData({ ...formData, productId: '', variantId: '' })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (!selectedRepId) { alert('Please select a sales rep'); return }
      const selectedProduct = products.find(p => p.id === parseInt(formData.productId))
      if (!selectedProduct) { alert('Please select a product'); return }

      if (selectedProduct.hasVariants && !formData.variantId) {
        alert('Please select a variant'); return
      }

      await axios.post('/api/sales', {
        productId: parseInt(formData.productId),
        variantId: formData.variantId ? parseInt(formData.variantId) : null,
        userId: parseInt(selectedRepId),
        quantity: parseInt(formData.quantity),
        saleType: formData.saleType,
        paymentMode: formData.paymentMode,
        notes: formData.notes
      })
      setShowModal(false)
      setFormData({ productId: '', variantId: '', quantity: '', saleType: 'piece', paymentMode: 'cash', notes: '' })
      setProductSearch('')
      fetchData()
    } catch (error) {
      alert(error.response?.data?.error || 'Error recording sale')
    }
  }

  const handleFilter = async () => {
    try {
      let url = '/api/sales'
      const params = new URLSearchParams()
      if (filterDate.startDate) params.append('startDate', filterDate.startDate)
      if (filterDate.endDate) params.append('endDate', filterDate.endDate)
      if (params.toString()) url += `?${params.toString()}`
      const response = await axios.get(url)
      setSales(response.data)
    } catch (error) {
      console.error('Error filtering sales:', error)
    }
  }

  const getSelectedProduct = () => products.find(p => p.id === parseInt(formData.productId))
  const getSelectedVariant = () => {
    const product = getSelectedProduct()
    if (!product || !formData.variantId) return null
    return product.variants?.find(v => v.id === parseInt(formData.variantId))
  }

  const calculateTotal = () => {
    const product = getSelectedProduct()
    if (!product || !formData.quantity) return 0
    const quantity = parseInt(formData.quantity)
    return formData.saleType === 'carton'
      ? quantity * product.price * product.piecesPerCarton
      : quantity * product.price
  }

  const getAvailableStock = () => {
    const product = getSelectedProduct()
    if (!product) return 0
    if (product.hasVariants) {
      const variant = getSelectedVariant()
      if (!variant) return 0
      return formData.saleType === 'carton' ? (variant.inventory?.remainingCartons || 0) : (variant.inventory?.remainingPieces || 0)
    }
    return formData.saleType === 'carton' ? (product.inventory?.remainingCartons || 0) : (product.inventory?.remainingPieces || 0)
  }

  const getPaymentBadge = (mode) => {
    const styles = { cash: 'bg-green-100 text-green-800', transfer: 'bg-blue-100 text-blue-800', card: 'bg-purple-100 text-purple-800' }
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[mode] || 'bg-gray-100 text-gray-800'}`}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
  }

  const today = new Date().toISOString().split('T')[0]
  const todaySales = sales.filter(s => s.saleDate.startsWith(today))

  if (loading) return <div className="flex justify-center items-center h-64"><div className="text-gray-500">Loading...</div></div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">{isManager ? 'All Sales' : 'Record Sale'}</h1>
        <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">+ New Sale</button>
      </div>

      {isManager && (
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <input type="date" value={filterDate.startDate} onChange={(e) => setFilterDate({ ...filterDate, startDate: e.target.value })} className="mt-1 block border border-gray-300 rounded-md shadow-sm p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <input type="date" value={filterDate.endDate} onChange={(e) => setFilterDate({ ...filterDate, endDate: e.target.value })} className="mt-1 block border border-gray-300 rounded-md shadow-sm p-2" />
            </div>
            <button onClick={handleFilter} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Filter</button>
            <button onClick={() => { setFilterDate({ startDate: '', endDate: '' }); fetchData() }} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">Clear</button>
          </div>
        </div>
      )}

      {isSalesRep && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-800">Today's Sales: {todaySales.length} transactions</h3>
          <p className="text-green-600">Total: N{todaySales.reduce((sum, s) => sum + s.totalAmount, 0).toLocaleString()}</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              {isManager && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sold By</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {(isManager ? sales : todaySales).map((sale) => (
              <tr key={sale.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(sale.saleDate).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {sale.items?.map((item, idx) => (
                    <div key={idx} className={!item.product ? 'italic text-gray-400' : ''}>
                      {item.product?.name || item.productName || 'Deleted'}
                      {item.variant && <span className="text-indigo-600 ml-1">({item.variant.name})</span>}
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sale.totalQuantity}</td>
                <td className="px-6 py-4 whitespace-nowrap">{getPaymentBadge(sale.paymentMode)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">N{sale.totalAmount.toLocaleString()}</td>
                {isManager && <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.user?.name || '-'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {(isManager ? sales : todaySales).length === 0 && (
          <div className="text-center py-12"><p className="text-gray-500">No sales recorded yet</p></div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-[480px] shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Record New Sale</h3>
              <button onClick={() => { setShowModal(false); setProductSearch('') }} className="text-gray-400 hover:text-gray-600">X</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Sales Rep *</label>
                <select required value={selectedRepId} onChange={(e) => setSelectedRepId(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
                  <option value="">Select sales rep</option>
                  {salesReps.map((rep) => <option key={rep.id} value={rep.id}>{rep.name}</option>)}
                </select>
              </div>

              <div className="relative" ref={productDropdownRef}>
                <label className="block text-sm font-medium text-gray-700">Product *</label>
                <input type="text" required value={productSearch} onChange={handleProductSearchChange}
                  onFocus={() => setShowProductDropdown(true)} placeholder="Search product..." autoComplete="off"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredProducts.map((product) => (
                      <div key={product.id} onClick={() => handleProductSelect(product)}
                        className={`px-4 py-3 cursor-pointer hover:bg-indigo-50 border-b border-gray-100 last:border-0 ${formData.productId === product.id.toString() ? 'bg-indigo-100' : ''}`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-gray-900">{product.name}</p>
                            {product.colorCode && <p className="text-xs text-gray-500">Color: {product.colorCode}</p>}
                            {product.hasVariants && <span className="text-xs bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">{product.variants?.length || 0} variants</span>}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-green-600">N{product.price.toLocaleString()}/pc</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {formData.productId && getSelectedProduct()?.hasVariants && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Variant *</label>
                  <select required value={formData.variantId} onChange={(e) => setFormData({ ...formData, variantId: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
                    <option value="">Select variant</option>
                    {getSelectedProduct()?.variants?.map((v) => (
                      <option key={v.id} value={v.id}>{v.name} {v.colorCode && `(${v.colorCode})`} - {formData.saleType === 'carton' ? v.inventory?.remainingCartons || 0 : v.inventory?.remainingPieces || 0} {formData.saleType === 'carton' ? 'cartons' : 'pieces'} left</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Sale Type *</label>
                <div className="mt-2 space-x-4">
                  <label className="inline-flex items-center">
                    <input type="radio" value="piece" checked={formData.saleType === 'piece'} onChange={(e) => setFormData({ ...formData, saleType: e.target.value })} className="form-radio" />
                    <span className="ml-2">Piece</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input type="radio" value="carton" checked={formData.saleType === 'carton'} onChange={(e) => setFormData({ ...formData, saleType: e.target.value })} className="form-radio" />
                    <span className="ml-2">Carton</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Payment Mode *</label>
                <select required value={formData.paymentMode} onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
                  <option value="cash">Cash</option>
                  <option value="transfer">Transfer</option>
                  <option value="card">Card</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Quantity *</label>
                <input type="number" required min="1" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                {formData.productId && (formData.variantId || !getSelectedProduct()?.hasVariants) && (
                  <p className="mt-1 text-sm text-gray-500">Available: {getAvailableStock()} {formData.saleType === 'carton' ? 'cartons' : 'pieces'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" rows="2" />
              </div>

              {formData.productId && formData.quantity && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Total Amount:</p>
                  <p className="text-xl font-bold text-green-600">N{calculateTotal().toLocaleString()}</p>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); setProductSearch('') }} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700">Record Sale</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Sales
