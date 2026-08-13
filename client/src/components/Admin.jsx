import { useState, useEffect } from 'react'
import axios from 'axios'

function Admin() {
  const [salesReps, setSalesReps] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingRep, setEditingRep] = useState(null)
  const [formData, setFormData] = useState({ name: '', email: '' })

  useEffect(() => { fetchReps() }, [])

  const fetchReps = async () => {
    try {
      const response = await axios.get('/api/salesreps')
      setSalesReps(response.data)
    } catch (error) {
      console.error('Error fetching reps:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingRep) {
        await axios.put(`/api/salesreps/${editingRep.id}`, formData)
      } else {
        await axios.post('/api/salesreps', formData)
      }
      setShowModal(false)
      setEditingRep(null)
      setFormData({ name: '', email: '' })
      fetchReps()
    } catch (error) {
      alert(error.response?.data?.error || 'Error saving sales rep')
    }
  }

  const handleEdit = (rep) => {
    setEditingRep(rep)
    setFormData({ name: rep.name, email: rep.email })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this sales rep?')) {
      try {
        await axios.delete(`/api/salesreps/${id}`)
        fetchReps()
      } catch (error) {
        alert('Error deleting sales rep')
      }
    }
  }

  if (loading) return <div className="flex justify-center items-center h-64"><div className="text-gray-500">Loading...</div></div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Manage Sales Reps</h1>
        <button onClick={() => setShowModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
          + Add Sales Rep
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Added</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {salesReps.map((rep) => (
              <tr key={rep.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{rep.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rep.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(rep.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button onClick={() => handleEdit(rep)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                  <button onClick={() => handleDelete(rep.id)} className="text-red-600 hover:text-red-900">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {salesReps.length === 0 && (
          <div className="text-center py-12"><p className="text-gray-500">No sales reps added yet</p></div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{editingRep ? 'Edit Sales Rep' : 'Add Sales Rep'}</h3>
              <button onClick={() => { setShowModal(false); setEditingRep(null) }} className="text-gray-400 hover:text-gray-600">X</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name *</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email *</label>
                <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); setEditingRep(null) }} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">{editingRep ? 'Update' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Admin
