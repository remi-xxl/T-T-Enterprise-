import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useRole } from '../context/RoleContext'

function WholesaleSales() {
  const { isManager } = useRole()
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState([])
  const [salesReps, setSalesReps] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showCustomerDetail, setShowCustomerDetail] = useState(false)
  const [customerPurchases, setCustomerPurchases] = useState(null)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [selectedRepId, setSelectedRepId] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [filteredProducts, setFilteredProducts] = useState([])
  const [activeItemIndex, setActiveItemIndex] = useState(null)
  const productDropdownRef = useRef(null)
  const [formData, setFormData] = useState({ paymentMode: 'cash', notes: '' })
  const [saleItems, setSaleItems] = useState([
    { productId: '', productName: '', variantId: '', variantName: '', quantity: '', saleType: 'carton', unitPrice: 0, totalPrice: 0 }
  ])
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', address: '' })
  const [filterDate, setFilterDate] = useState({ startDate: '', endDate: '' })

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    if (productSearch.trim() === '') setFilteredProducts(products)
    else {
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
        setActiveItemIndex(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchData = async () => {
    try {
      const [productsRes, salesRes, repsRes, customersRes] = await Promise.all([
        axios.get('/api/products'),
        axios.get('/api/wholesale-sales'),
        axios.get('/api/salesreps'),
        axios.get('/api/customers')
      ])
      setProducts(productsRes.data)
      setSales(salesRes.data)
      setSalesReps(repsRes.data)
      setCustomers(customersRes.data)
      if (repsRes.data.length > 0 && !selectedRepId) setSelectedRepId(repsRes.data[0].id.toString())
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProductSelect = (product, index) => {
    const newItems = [...saleItems]
    newItems[index] = { ...newItems[index], productId: product.id, productName: product.name, unitPrice: product.price, variantId: '', variantName: '' }
    recalculateItem(newItems[index], index, newItems)
    setSaleItems(newItems)
    setProductSearch('')
    setShowProductDropdown(false)
    setActiveItemIndex(null)
  }

  const handleVariantSelect = (variantId, index) => {
    const newItems = [...saleItems]
    const product = products.find(p => p.id === parseInt(newItems[index].productId))
    const variant = product?.variants?.find(v => v.id === parseInt(variantId))
    newItems[index] = { ...newItems[index], variantId: variantId, variantName: variant?.name || '' }
    recalculateItem(newItems[index], index, newItems)
    setSaleItems(newItems)
  }

  const recalculateItem = (item, index, items) => {
    if (!item.productId || !item.quantity) return
    const product = products.find(p => p.id === parseInt(item.productId))
    if (!product) return
    const qty = parseInt(item.quantity)
    items[index].totalPrice = item.saleType === 'carton' ? qty * product.price * product.piecesPerCarton : qty * product.price
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...saleItems]
    newItems[index] = { ...newItems[index], [field]: value }
    if (field === 'quantity' || field === 'saleType') recalculateItem(newItems[index], index, newItems)
    setSaleItems(newItems)
  }

  const addItem = () => {
    setSaleItems([...saleItems, { productId: '', productName: '', variantId: '', variantName: '', quantity: '', saleType: 'carton', unitPrice: 0, totalPrice: 0 }])
  }

  const removeItem = (index) => {
    if (saleItems.length > 1) setSaleItems(saleItems.filter((_, i) => i !== index))
  }

  const handleCreateCustomer = async (e) => {
    e.preventDefault()
    try {
      const response = await axios.post('/api/customers', customerForm)
      setCustomers([...customers, { ...response.data, sales: [], totalPurchases: 0, totalItems: 0, purchaseCount: 0 }])
      setSelectedCustomerId(response.data.id.toString())
      setCustomerForm({ name: '', phone: '', address: '' })
      setShowCustomerModal(false)
    } catch (error) {
      alert('Error creating customer')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (!selectedRepId) { alert('Please select a sales rep'); return }
      if (!selectedCustomerId) { alert('Please select a customer'); return }
      const validItems = saleItems.filter(item => item.productId && item.quantity)
      if (validItems.length === 0) { alert('Please add at least one product'); return }

      for (const item of validItems) {
        const product = products.find(p => p.id === parseInt(item.productId))
        if (product?.hasVariants && !item.variantId) {
          alert(`Please select a variant for ${product.name}`); return
        }
      }

      await axios.post('/api/wholesale-sales', {
        userId: parseInt(selectedRepId),
        customerId: parseInt(selectedCustomerId),
        paymentMode: formData.paymentMode,
        notes: formData.notes,
        items: validItems.map(item => ({
          productId: parseInt(item.productId),
          variantId: item.variantId ? parseInt(item.variantId) : null,
          quantity: parseInt(item.quantity),
          saleType: item.saleType
        }))
      })
      setShowModal(false)
      resetForm()
      fetchData()
    } catch (error) {
      alert(error.response?.data?.error || 'Error recording sale')
    }
  }

  const resetForm = () => {
    setFormData({ paymentMode: 'cash', notes: '' })
    setSaleItems([{ productId: '', productName: '', variantId: '', variantName: '', quantity: '', saleType: 'carton', unitPrice: 0, totalPrice: 0 }])
    setSelectedCustomerId('')
    setProductSearch('')
  }

  const handleFilter = async () => {
    try {
      let url = '/api/wholesale-sales'
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

  const viewCustomerDetail = async (customer) => {
    try {
      const response = await axios.get(`/api/customers/${customer.id}/purchases`)
      setCustomerPurchases(response.data)
      setSelectedCustomer(customer)
      setShowCustomerDetail(true)
    } catch (error) {
      console.error('Error fetching customer details:', error)
    }
  }

  const calculateGrandTotal = () => saleItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0)

  const calculateTotalQuantity = () => {
    return saleItems.reduce((sum, item) => {
      const product = products.find(p => p.id === parseInt(item.productId))
      if (!product || !item.quantity) return sum
      return item.saleType === 'carton' ? sum + (parseInt(item.quantity) * product.piecesPerCarton) : sum + parseInt(item.quantity)
    }, 0)
  }

  const getPaymentBadge = (mode) => {
    const styles = { cash: 'bg-green-100 text-green-800', transfer: 'bg-blue-100 text-blue-800', card: 'bg-purple-100 text-purple-800' }
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[mode] || 'bg-gray-100 text-gray-800'}`}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
  }

  const getAvailableStock = (item) => {
    const product = products.find(p => p.id === parseInt(item.productId))
    if (!product) return 0
    if (product.hasVariants && item.variantId) {
      const variant = product.variants?.find(v => v.id === parseInt(item.variantId))
      if (!variant) return 0
      return item.saleType === 'carton' ? (variant.inventory?.remainingCartons || 0) : (variant.inventory?.remainingPieces || 0)
    }
    return item.saleType === 'carton' ? (product.inventory?.remainingCartons || 0) : (product.inventory?.remainingPieces || 0)
  }

  const salesByCustomer = sales.reduce((acc, sale) => {
    const custName = sale.customer?.name || 'Unknown'
    if (!acc[custName]) acc[custName] = { customer: sale.customer, sales: [], total: 0, items: 0 }
    acc[custName].sales.push(sale)
    acc[custName].total += sale.totalAmount
    acc[custName].items += sale.totalQuantity
    return acc
  }, {})

  if (loading) return <div className="flex justify-center items-center h-64"><div className="text-gray-500">Loading...</div></div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Wholesale Sales</h1>
        <div className="flex space-x-3">
          <button onClick={() => setShowCustomerModal(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">+ Add Customer</button>
          <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">+ New Wholesale Sale</button>
        </div>
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

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Customers Summary</h2>
        {Object.keys(salesByCustomer).length === 0 ? (
          <p className="text-gray-500">No wholesale sales yet</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(salesByCustomer).map(([name, data]) => (
              <div key={name} className="border rounded-lg p-4 hover:border-indigo-300 cursor-pointer" onClick={() => viewCustomerDetail(data.customer)}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{name}</p>
                    {data.customer?.phone && <p className="text-sm text-gray-500">{data.customer.phone}</p>}
                  </div>
                  <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">{data.sales.length} sales</span>
                </div>
                <div className="mt-3 flex justify-between">
                  <span className="text-sm text-gray-500">{data.items} pieces</span>
                  <span className="font-semibold text-green-600">N{data.total.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-4 border-b"><h2 className="text-lg font-semibold text-gray-900">All Wholesale Sales</h2></div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                {isManager && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sold By</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{new Date(sale.saleDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{sale.customer?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="flex flex-wrap gap-1">
                      {sale.items?.slice(0, 3).map((item, idx) => (
                        <span key={idx} className={`px-2 py-1 rounded text-xs ${!item.product ? 'bg-gray-200 italic' : 'bg-gray-100'}`}>
                          {item.product?.name || item.productName || 'Deleted'}{item.variant ? ` (${item.variant.name})` : ''} x{item.quantity}
                        </span>
                      ))}
                      {sale.items?.length > 3 && <span className="bg-gray-100 px-2 py-1 rounded text-xs">+{sale.items.length - 3} more</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{sale.totalQuantity}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{getPaymentBadge(sale.paymentMode)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600">N{sale.totalAmount.toLocaleString()}</td>
                  {isManager && <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{sale.user?.name || '-'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sales.length === 0 && <div className="text-center py-8"><p className="text-gray-500">No wholesale sales recorded yet</p></div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-5 mx-auto p-5 border w-[750px] shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">New Wholesale Sale</h3>
              <button onClick={() => { setShowModal(false); resetForm() }} className="text-gray-400 hover:text-gray-600">X</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sales Rep *</label>
                  <select required value={selectedRepId} onChange={(e) => setSelectedRepId(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
                    <option value="">Select sales rep</option>
                    {salesReps.map((rep) => <option key={rep.id} value={rep.id}>{rep.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Customer *</label>
                  <div className="flex space-x-2">
                    <select required value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className="flex-1 border border-gray-300 rounded-md shadow-sm p-2">
                      <option value="">Select customer</option>
                      {customers.map((cust) => <option key={cust.id} value={cust.id}>{cust.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowCustomerModal(true)} className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">+ New</button>
                  </div>
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

              <div className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-gray-900">Products</h4>
                  <button type="button" onClick={addItem} className="text-sm text-indigo-600 hover:text-indigo-800">+ Add Product</button>
                </div>
                <div className="space-y-3">
                  {saleItems.map((item, index) => {
                    const product = products.find(p => p.id === parseInt(item.productId))
                    return (
                      <div key={index} className="flex items-end space-x-2 bg-gray-50 p-3 rounded-lg">
                        <div className="flex-1 relative" ref={activeItemIndex === index ? productDropdownRef : null}>
                          <label className="block text-xs text-gray-500">Product *</label>
                          <input type="text" required value={item.productName || (activeItemIndex === index ? productSearch : '')}
                            onChange={(e) => { setProductSearch(e.target.value); setActiveItemIndex(index); setShowProductDropdown(true); if (e.target.value === '') handleItemChange(index, 'productId', '') }}
                            onFocus={() => { setActiveItemIndex(index); setShowProductDropdown(true); setProductSearch(item.productName || '') }}
                            placeholder="Search product..." className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm" autoComplete="off" />
                          {showProductDropdown && activeItemIndex === index && filteredProducts.length > 0 && (
                            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-auto">
                              {filteredProducts.map((product) => (
                                <div key={product.id} onClick={() => handleProductSelect(product, index)} className="px-3 py-2 cursor-pointer hover:bg-indigo-50 border-b border-gray-100 last:border-0 text-sm">
                                  <div className="flex justify-between">
                                    <span className="font-medium">{product.name}</span>
                                    <span className="text-green-600">N{product.price.toLocaleString()}/pc</span>
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    {product.hasVariants ? `${product.variants?.length || 0} variants` : `Stock: ${product.inventory?.remainingPieces || 0} pcs`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {product?.hasVariants && (
                          <div className="w-36">
                            <label className="block text-xs text-gray-500">Variant *</label>
                            <select required value={item.variantId} onChange={(e) => handleVariantSelect(e.target.value, index)}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm">
                              <option value="">Select</option>
                              {product.variants?.map((v) => (
                                <option key={v.id} value={v.id}>{v.name} {v.colorCode && `(${v.colorCode})`}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="w-24">
                          <label className="block text-xs text-gray-500">Type *</label>
                          <select value={item.saleType} onChange={(e) => handleItemChange(index, 'saleType', e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm">
                            <option value="piece">Piece</option>
                            <option value="carton">Carton</option>
                          </select>
                        </div>
                        <div className="w-24">
                          <label className="block text-xs text-gray-500">Qty *</label>
                          <input type="number" required min="1" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm" />
                          {item.productId && (item.variantId || !product?.hasVariants) && (
                            <span className="text-xs text-gray-400">Avail: {getAvailableStock(item)}</span>
                          )}
                        </div>
                        <div className="w-28">
                          <label className="block text-xs text-gray-500">Total</label>
                          <div className="mt-1 p-2 bg-gray-100 rounded-md text-sm font-medium text-green-600">N{(item.totalPrice || 0).toLocaleString()}</div>
                        </div>
                        {saleItems.length > 1 && (
                          <button type="button" onClick={() => removeItem(index)} className="p-2 text-red-600 hover:text-red-800">Remove</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" rows="2" />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Quantity (pieces):</span>
                  <span className="font-medium">{calculateTotalQuantity()}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-gray-600">Grand Total:</span>
                  <span className="text-xl font-bold text-green-600">N{calculateGrandTotal().toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm() }} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700">Record Sale</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCustomerModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add New Customer</h3>
              <button onClick={() => setShowCustomerModal(false)} className="text-gray-400 hover:text-gray-600">X</button>
            </div>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Customer Name *</label>
                <input type="text" required value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input type="text" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <textarea value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" rows="2" />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowCustomerModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700">Add Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCustomerDetail && customerPurchases && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-[700px] shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{customerPurchases.customer.name} - Purchase History</h3>
              <button onClick={() => { setShowCustomerDetail(false); setSelectedCustomer(null); setCustomerPurchases(null) }} className="text-gray-400 hover:text-gray-600">X</button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-sm text-gray-500">Total Spent</p>
                <p className="text-xl font-bold text-green-600">N{customerPurchases.summary.totalSpent.toLocaleString()}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-gray-500">Total Pieces</p>
                <p className="text-xl font-bold text-blue-600">{customerPurchases.summary.totalItems}</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <p className="text-sm text-gray-500">Transactions</p>
                <p className="text-xl font-bold text-purple-600">{customerPurchases.summary.totalTransactions}</p>
              </div>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Products</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customerPurchases.purchases.map((sale) => (
                    <tr key={sale.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{new Date(sale.saleDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {sale.items?.map((item, idx) => (
                          <div key={idx} className={!item.product ? 'italic text-gray-400' : ''}>
                            {item.product?.name || item.productName || 'Deleted'}{item.variant ? ` (${item.variant.name})` : ''}: {item.quantity} {item.saleType}s
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{sale.totalQuantity}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600">N{sale.totalAmount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end pt-4">
              <button onClick={() => { setShowCustomerDetail(false); setSelectedCustomer(null); setCustomerPurchases(null) }} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WholesaleSales
