import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [showVariantModal, setShowVariantModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [stockChanged, setStockChanged] = useState(false)
  const [addingVariantTo, setAddingVariantTo] = useState(null)
  const [bulkFile, setBulkFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const fileInputRef = useRef(null)
  const [formData, setFormData] = useState({
    name: '', price: '', piecesPerCarton: '', colorCode: '',
    lowStockThreshold: '5', totalCartons: '', totalPieces: '', hasVariants: false
  })
  const [variants, setVariants] = useState([{ name: '', colorCode: '', totalCartons: '', totalPieces: '' }])
  const [variantForm, setVariantForm] = useState({ name: '', colorCode: '', totalCartons: '', totalPieces: '' })

  useEffect(() => { fetchProducts() }, [])

  const fetchProducts = async () => {
    try {
      const response = await axios.get('/api/products')
      setProducts(response.data)
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = {
        name: formData.name,
        price: parseFloat(formData.price),
        piecesPerCarton: parseInt(formData.piecesPerCarton),
        colorCode: formData.colorCode || null,
        lowStockThreshold: parseInt(formData.lowStockThreshold),
        hasVariants: formData.hasVariants,
        totalCartons: editingProduct && !stockChanged ? undefined : (formData.totalCartons === '' ? undefined : parseInt(formData.totalCartons)),
        totalPieces: editingProduct && !stockChanged ? undefined : (formData.totalPieces === '' ? undefined : parseInt(formData.totalPieces)),
        variants: formData.hasVariants
          ? variants.filter(v => v.name).map(v => ({
              name: v.name,
              colorCode: v.colorCode || null,
              totalCartons: parseInt(v.totalCartons) || 0,
              totalPieces: v.totalPieces === '' ? undefined : parseInt(v.totalPieces)
            }))
          : []
      }

      if (editingProduct) {
        await axios.put(`/api/products/${editingProduct.id}`, data)
      } else {
        await axios.post('/api/products', data)
      }
      resetForm()
      fetchProducts()
    } catch (error) {
      alert('Error saving product: ' + (error.response?.data?.error || error.message))
    }
  }

  const resetForm = () => {
    setShowModal(false)
    setEditingProduct(null)
    setStockChanged(false)
    setFormData({ name: '', price: '', piecesPerCarton: '', colorCode: '', lowStockThreshold: '5', totalCartons: '', totalPieces: '', hasVariants: false })
    setVariants([{ name: '', colorCode: '', totalCartons: '', totalPieces: '' }])
  }

  const handleEdit = (product) => {
    setEditingProduct(product)
    setStockChanged(false)
    setFormData({
      name: product.name,
      price: product.price.toString(),
      piecesPerCarton: product.piecesPerCarton.toString(),
      colorCode: product.colorCode || '',
      lowStockThreshold: product.lowStockThreshold.toString(),
      totalCartons: product.inventory?.totalCartons?.toString() || '', totalPieces: '',
      hasVariants: product.hasVariants
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product? Sales history will be preserved.')) {
      try {
        await axios.delete(`/api/products/${id}`)
        fetchProducts()
      } catch (error) {
        console.error('Error deleting product:', error)
      }
    }
  }

  const handleDeleteAll = async () => {
    if (window.confirm('Are you sure you want to delete ALL products? This cannot be undone!')) {
      if (window.confirm('This will delete all products and inventory. Sales history will be preserved. Continue?')) {
        try {
          await axios.delete('/api/products')
          fetchProducts()
        } catch (error) {
          console.error('Error deleting all products:', error)
        }
      }
    }
  }

  const handleAddVariant = async (e) => {
    e.preventDefault()
    try {
      await axios.post(`/api/products/${addingVariantTo.id}/variants`, {
        name: variantForm.name,
        colorCode: variantForm.colorCode || null,
        totalCartons: parseInt(variantForm.totalCartons) || 0,
        totalPieces: variantForm.totalPieces === '' ? undefined : parseInt(variantForm.totalPieces)
      })
      setShowVariantModal(false)
      setAddingVariantTo(null)
      setVariantForm({ name: '', colorCode: '', totalCartons: '', totalPieces: '' })
      fetchProducts()
    } catch (error) {
      alert('Error adding variant: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleDeleteVariant = async (variantId) => {
    if (window.confirm('Delete this variant? Sales history will be preserved.')) {
      try {
        await axios.delete(`/api/variants/${variantId}`)
        fetchProducts()
      } catch (error) {
        console.error('Error deleting variant:', error)
      }
    }
  }

  const handleBulkUpload = async () => {
    if (!bulkFile) { alert('Please select a file'); return }
    setUploading(true)
    setUploadResult(null)
    const formDataObj = new FormData()
    formDataObj.append('file', bulkFile)
    try {
      const response = await axios.post('/api/products/bulk', formDataObj, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setUploadResult(response.data)
      fetchProducts()
    } catch (error) {
      setUploadResult({ error: error.response?.data?.error || 'Upload failed' })
    } finally {
      setUploading(false)
    }
  }

  const downloadTemplate = () => {
    window.open('/api/products/template', '_blank')
  }

  const getStockDisplay = (product) => {
    if (product.hasVariants) {
      if (!product.variants || product.variants.length === 0) return { text: 'No Variants', color: 'bg-gray-100 text-gray-800' }
      const totalRemaining = product.variants.reduce((sum, v) => sum + (v.inventory?.remainingPieces || 0), 0)
      if (totalRemaining <= 0) return { text: 'Out of Stock', color: 'bg-red-100 text-red-800' }
      if (totalRemaining <= product.lowStockThreshold * product.variants.length) return { text: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' }
      return { text: 'In Stock', color: 'bg-green-100 text-green-800' }
    }
    const remaining = product.inventory?.remainingPieces || 0
    if (remaining <= 0) return { text: 'Out of Stock', color: 'bg-red-100 text-red-800' }
    if (remaining <= product.lowStockThreshold) return { text: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' }
    return { text: 'In Stock', color: 'bg-green-100 text-green-800' }
  }

  if (loading) return <div className="flex justify-center items-center h-64"><div className="text-gray-500">Loading...</div></div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Products</h1>
        <div className="flex space-x-3">
          <button onClick={() => setShowBulkModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Bulk Upload</button>
          <button onClick={() => setShowModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">+ Add Product</button>
          {products.length > 0 && (
            <button onClick={handleDeleteAll} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">Delete All</button>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price/Piece</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Variants / Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((product) => {
              const stockStatus = getStockDisplay(product)
              return (
                <tr key={product.id}>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                    {product.colorCode && <div className="text-xs text-gray-500">Color: {product.colorCode}</div>}
                    {product.hasVariants && <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">Has Variants</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">N{product.price.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {product.hasVariants ? (
                      <div className="space-y-1">
                        {product.variants?.length === 0 && <span className="text-gray-400 italic">No variants yet</span>}
                        {product.variants?.map((v) => (
                          <div key={v.id} className="flex justify-between items-center bg-gray-50 rounded px-2 py-1 text-xs">
                            <span>{v.name} {v.colorCode && `(${v.colorCode})`}</span>
                            <span>{v.inventory?.remainingCartons || 0}c / {v.inventory?.remainingPieces || 0}p</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span>{product.inventory?.remainingCartons || 0}c / {product.inventory?.remainingPieces || 0}p</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${stockStatus.color}`}>{stockStatus.text}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {product.hasVariants && (
                      <button onClick={() => { setAddingVariantTo(product); setShowVariantModal(true) }} className="text-green-600 hover:text-green-900">+ Variant</button>
                    )}
                    <button onClick={() => handleEdit(product)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                    <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-900">Delete</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {products.length === 0 && <div className="text-center py-12"><p className="text-gray-500">No products yet</p></div>}
      </div>

      {showBulkModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-[500px] shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Bulk Upload Products</h3>
              <button onClick={() => { setShowBulkModal(false); setBulkFile(null); setUploadResult(null) }} className="text-gray-400 hover:text-gray-600">X</button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Instructions:</h4>
                <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
                  <li>Download the CSV template</li>
                  <li>Fill in your products (name, price, piecesPerCarton are required)</li>
                  <li>For variant products: set hasVariants=true and add variantName rows</li>
                  <li>Upload the completed CSV file</li>
                </ol>
              </div>
              <div className="flex justify-center">
                <button onClick={downloadTemplate} className="bg-white border-2 border-indigo-600 text-indigo-600 px-6 py-3 rounded-lg hover:bg-indigo-50 font-medium">Download CSV Template</button>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input ref={fileInputRef} type="file" accept=".csv" onChange={(e) => setBulkFile(e.target.files[0])} className="hidden" />
                {bulkFile ? (
                  <div><p className="text-green-600 font-medium">{bulkFile.name}</p><p className="text-sm text-gray-500">{(bulkFile.size / 1024).toFixed(1)} KB</p></div>
                ) : (
                  <div onClick={() => fileInputRef.current.click()} className="cursor-pointer">
                    <p className="text-gray-600">Click to select CSV file</p>
                    <p className="text-sm text-gray-400">or drag and drop</p>
                  </div>
                )}
              </div>
              {uploadResult && (
                <div className={`p-4 rounded-lg ${uploadResult.error ? 'bg-red-50' : 'bg-green-50'}`}>
                  {uploadResult.error ? (
                    <p className="text-red-600">{uploadResult.error}</p>
                  ) : (
                    <div>
                      <p className="text-green-600 font-medium">{uploadResult.message}</p>
                      {uploadResult.errors && uploadResult.errors.length > 0 && (
                        <div className="mt-2">
                          <p className="text-yellow-600 text-sm">Warnings:</p>
                          {uploadResult.errors.map((err, i) => <p key={i} className="text-sm text-yellow-600">{err}</p>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-end space-x-3 pt-4">
                <button onClick={() => { setShowBulkModal(false); setBulkFile(null); setUploadResult(null) }} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleBulkUpload} disabled={!bulkFile || uploading} className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50">{uploading ? 'Uploading...' : 'Upload Products'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-[520px] shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">X</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Product Name *</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Price per Piece (N) *</label>
                  <input type="number" required step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pieces per Carton *</label>
                  <input type="number" required value={formData.piecesPerCarton} onChange={(e) => setFormData({ ...formData, piecesPerCarton: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Color Code</label>
                  <input type="text" value={formData.colorCode} onChange={(e) => setFormData({ ...formData, colorCode: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Low Stock Threshold</label>
                  <input type="number" value={formData.lowStockThreshold} onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <input type="checkbox" id="hasVariants" checked={formData.hasVariants}
                  onChange={(e) => setFormData({ ...formData, hasVariants: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 rounded" />
                <label htmlFor="hasVariants" className="text-sm font-medium text-gray-700">This product has variants (e.g. different colors)</label>
              </div>

              {formData.hasVariants ? (
                editingProduct ? (
                  <p className="text-sm text-gray-500 bg-gray-50 rounded p-3">To update a variant's cartons or pieces, use the Inventory page and edit that specific variant.</p>
                ) : (
                    <div className="border rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium text-gray-900">Variants</h4>
                        <button type="button" onClick={() => setVariants([...variants, { name: '', colorCode: '', totalCartons: '', totalPieces: '' }])}
                          className="text-sm text-indigo-600 hover:text-indigo-800">+ Add Variant</button>
                      </div>
                      {variants.map((v, i) => (
                        <div key={i} className="flex items-end space-x-2 bg-white p-2 rounded border">
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500">Name *</label>
                            <input type="text" required value={v.name}
                              onChange={(e) => { const nv = [...variants]; nv[i].name = e.target.value; setVariants(nv) }}
                              className="mt-1 block w-full border border-gray-300 rounded p-1.5 text-sm" placeholder="e.g. Color 1" />
                          </div>
                          <div className="w-20">
                            <label className="block text-xs text-gray-500">Color Code</label>
                            <input type="text" value={v.colorCode}
                              onChange={(e) => { const nv = [...variants]; nv[i].colorCode = e.target.value; setVariants(nv) }}
                              className="mt-1 block w-full border border-gray-300 rounded p-1.5 text-sm" />
                          </div>
                          <div className="w-20">
                            <label className="block text-xs text-gray-500">Cartons</label>
                            <input type="number" value={v.totalCartons}
                              onChange={(e) => { const nv = [...variants]; nv[i].totalCartons = e.target.value; setVariants(nv) }}
                              className="mt-1 block w-full border border-gray-300 rounded p-1.5 text-sm" />
                          </div>
                          <div className="w-20">
                            <label className="block text-xs text-gray-500">Pieces</label>
                            <input type="number" min="0" value={v.totalPieces}
                              onChange={(e) => { const nv = [...variants]; nv[i].totalPieces = e.target.value; setVariants(nv) }}
                              className="mt-1 block w-full border border-gray-300 rounded p-1.5 text-sm" />
                          </div>
                          {variants.length > 1 && (
                            <button type="button" onClick={() => setVariants(variants.filter((_, j) => j !== i))} className="text-red-600 text-sm">X</button>
                          )}
                        </div>
                      ))}
                    </div>
                )
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700">{editingProduct ? 'Total Stock' : 'Initial Stock'}</label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <input type="number" min="0" value={formData.totalCartons} onChange={(e) => { setStockChanged(true); setFormData({ ...formData, totalCartons: e.target.value }) }} placeholder="Cartons" className="block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                    <input type="number" min="0" value={formData.totalPieces} onChange={(e) => { setStockChanged(true); setFormData({ ...formData, totalPieces: e.target.value }) }} placeholder="Pieces (overrides cartons)" className="block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                  </div>
                  {editingProduct && <p className="mt-1 text-xs text-gray-500">Leave the pieces box empty to update by cartons; enter pieces to set an exact quantity.</p>}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">{editingProduct ? 'Update' : 'Add Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showVariantModal && addingVariantTo && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Variant to {addingVariantTo.name}</h3>
              <button onClick={() => { setShowVariantModal(false); setAddingVariantTo(null); setVariantForm({ name: '', colorCode: '', totalCartons: '', totalPieces: '' }) }} className="text-gray-400 hover:text-gray-600">X</button>
            </div>
            <form onSubmit={handleAddVariant} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Variant Name *</label>
                <input type="text" required value={variantForm.name} onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="e.g. Color 1, Gold, 33" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Color Code</label>
                <input type="text" value={variantForm.colorCode} onChange={(e) => setVariantForm({ ...variantForm, colorCode: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Initial Cartons</label>
                <input type="number" min="0" value={variantForm.totalCartons} onChange={(e) => setVariantForm({ ...variantForm, totalCartons: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Initial Pieces</label>
                <input type="number" min="0" value={variantForm.totalPieces} onChange={(e) => setVariantForm({ ...variantForm, totalPieces: e.target.value })} placeholder="Use this for loose pieces; it overrides cartons" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => { setShowVariantModal(false); setAddingVariantTo(null); setVariantForm({ name: '', colorCode: '', totalCartons: '', totalPieces: '' }) }} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">Add Variant</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Products
