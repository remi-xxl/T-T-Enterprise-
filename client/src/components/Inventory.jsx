import { useState, useEffect } from 'react'
import axios from 'axios'

function Inventory() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingInventory, setEditingInventory] = useState(null)
  const [editingType, setEditingType] = useState(null)
  const [newCartons, setNewCartons] = useState('')

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

  const handleUpdateInventory = async () => {
    try {
      const cartons = parseInt(newCartons)
      if (isNaN(cartons) || cartons < 0) { alert('Please enter a valid number of cartons'); return }

      if (editingType === 'product') {
        await axios.put(`/api/inventory/${editingInventory}`, { totalCartons: cartons })
      } else {
        await axios.put(`/api/variant-inventory/${editingInventory}`, { totalCartons: cartons })
      }
      setEditingInventory(null)
      setEditingType(null)
      setNewCartons('')
      fetchProducts()
    } catch (error) {
      console.error('Error updating inventory:', error)
      alert('Error updating inventory')
    }
  }

  const getStockLevel = (remaining, total) => {
    const percentage = total > 0 ? (remaining / total) * 100 : 0
    if (percentage <= 0) return { color: 'bg-red-500', width: '0%' }
    if (percentage <= 20) return { color: 'bg-red-500', width: `${percentage}%` }
    if (percentage <= 50) return { color: 'bg-yellow-500', width: `${percentage}%` }
    return { color: 'bg-green-500', width: `${percentage}%` }
  }

  const renderInventoryCard = (title, inventory, lowStockThreshold, editId, editType) => {
    const stockLevel = getStockLevel(inventory?.remainingPieces || 0, inventory?.totalPieces || 0)
    const isLow = (inventory?.remainingPieces || 0) <= lowStockThreshold && (inventory?.remainingPieces || 0) > 0
    const isOut = (inventory?.remainingPieces || 0) <= 0

    return (
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h4 className="font-medium text-gray-900">{title}</h4>
          </div>
          <button onClick={() => { setEditingInventory(editId); setEditingType(editType); setNewCartons(inventory?.totalCartons?.toString() || '') }}
            className="text-indigo-600 hover:text-indigo-900 text-sm">Edit</button>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-600">Cartons:</span><span className="font-medium">{inventory?.remainingCartons || 0} / {inventory?.totalCartons || 0}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Pieces:</span><span className="font-medium">{inventory?.remainingPieces || 0} / {inventory?.totalPieces || 0}</span></div>
          <div className="pt-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Stock Level</span>
              <span>{inventory?.totalPieces > 0 ? Math.round(((inventory?.remainingPieces || 0) / inventory.totalPieces) * 100) : 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className={`h-2 rounded-full ${stockLevel.color}`} style={{ width: stockLevel.width }}></div>
            </div>
          </div>
          {(isOut || isLow) && (
            <div className={`mt-2 p-2 rounded text-sm ${isOut ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
              {isOut ? 'Out of Stock!' : 'Low Stock Alert!'}
            </div>
          )}
        </div>
        {editingInventory === editId && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">Update Total Cartons</label>
            <div className="flex space-x-2">
              <input type="number" min="0" value={newCartons} onChange={(e) => setNewCartons(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md shadow-sm p-2 text-sm" />
              <button onClick={handleUpdateInventory} className="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700">Save</button>
              <button onClick={() => { setEditingInventory(null); setEditingType(null); setNewCartons('') }}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) return <div className="flex justify-center items-center h-64"><div className="text-gray-500">Loading...</div></div>

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <div key={product.id} className="bg-white rounded-lg shadow p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
              {product.colorCode && <p className="text-sm text-gray-500">Color: {product.colorCode}</p>}
              {product.hasVariants && <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">Has Variants</span>}
            </div>
            {product.hasVariants ? (
              <div className="space-y-3">
                {product.variants?.length === 0 && <p className="text-sm text-gray-400 italic">No variants added yet</p>}
                {product.variants?.map((variant) => (
                  <div key={variant.id} className="border rounded-lg p-3">
                    {renderInventoryCard(variant.name, variant.inventory, product.lowStockThreshold, variant.id, 'variant')}
                  </div>
                ))}
              </div>
            ) : (
              renderInventoryCard(product.name, product.inventory, product.lowStockThreshold, product.id, 'product')
            )}
          </div>
        ))}
      </div>
      {products.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No products found. Add some products first.</p>
        </div>
      )}
    </div>
  )
}

export default Inventory
