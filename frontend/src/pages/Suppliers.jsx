import React, { useState, useEffect } from 'react';
import { MdEdit, MdDelete, MdClose } from 'react-icons/md';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import './Suppliers.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function Suppliers() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    supplierId: '',
    tier: 1,
    location: '',
    materialSupplied: '',
    parentSupplier: '',
    contactEmail: ''
  });

  useEffect(() => {
    fetchSuppliers();
  }, [tierFilter]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      let url = `${API}/suppliers`;
      if (tierFilter) url += `?tier=${tierFilter}`;
      
      const token = localStorage.getItem('accessToken');
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (res.ok) {
        setSuppliers(data.data.docs || data.data);
      } else {
        toast.error(data.error || 'Failed to fetch suppliers');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this supplier?')) return;
    
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API}/suppliers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        toast.success('Supplier deleted');
        fetchSuppliers();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Delete failed');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const openModal = (supplier = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        supplierId: supplier.supplierId,
        tier: supplier.tier,
        location: supplier.location || '',
        materialSupplied: supplier.materialSupplied || '',
        parentSupplier: supplier.parentSupplier?._id || supplier.parentSupplier || '',
        contactEmail: supplier.contactInfo?.email || ''
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: '', supplierId: '', tier: 1, location: '', materialSupplied: '', parentSupplier: '', contactEmail: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('accessToken');
    
    const payload = {
      ...formData,
      contactInfo: { email: formData.contactEmail }
    };
    if (!payload.parentSupplier) delete payload.parentSupplier;

    try {
      const url = editingSupplier ? `${API}/suppliers/${editingSupplier._id}` : `${API}/suppliers`;
      const method = editingSupplier ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success(editingSupplier ? 'Supplier updated' : 'Supplier added');
        setIsModalOpen(false);
        fetchSuppliers();
      } else {
        toast.error(data.error || 'Operation failed');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  return (
    <div className="suppliers-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Supplier Network</h1>
          <p className="page-subtitle">Manage and monitor your multi-tier supplier ecosystem</p>
        </div>
        <div className="suppliers-header-actions">
          <select 
            className="filter-select"
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
          >
            <option value="">All Tiers</option>
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
          </select>
          {user?.role === 'company_manager' && (
            <button className="btn btn--primary" onClick={() => openModal()}>+ Add Supplier</button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="suppliers-table-container">
          <table className="suppliers-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Tier</th>
                <th>Location</th>
                <th>Material</th>
                <th>Parent Supplier</th>
                <th>Data Status</th>
                {user?.role === 'company_manager' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center' }}>Loading...</td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center' }}>No suppliers found.</td></tr>
              ) : (
                suppliers.map(s => (
                  <tr key={s._id}>
                    <td>
                      <div className="supplier-name-cell">
                        <span className="supplier-name">{s.name}</span>
                        <span className="supplier-id">ID: {s.supplierId}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`tier-badge tier-${s.tier}`}>Tier {s.tier}</span>
                    </td>
                    <td>{s.location || '—'}</td>
                    <td>{s.materialSupplied || '—'}</td>
                    <td>{s.parentSupplier?.name || '—'}</td>
                    <td>
                      <span style={{ color: s.dataStatus?.hasSubmittedData ? '#00d68f' : '#8ba3b5' }}>
                        {s.dataStatus?.hasSubmittedData ? 'Submitted' : 'Pending'}
                      </span>
                    </td>
                    {user?.role === 'company_manager' && (
                      <td>
                        <div className="action-btns">
                          <button className="btn-icon" onClick={() => openModal(s)} title="Edit"><MdEdit size={18} /></button>
                          <button className="btn-icon delete" onClick={() => handleDelete(s._id)} title="Delete"><MdDelete size={18} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}><MdClose /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Supplier Name *</label>
                  <input type="text" className="form-input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Supplier ID *</label>
                  <input type="text" className="form-input" required value={formData.supplierId} onChange={e => setFormData({...formData, supplierId: e.target.value})} disabled={!!editingSupplier} />
                </div>
                <div className="form-group">
                  <label>Tier Level *</label>
                  <select className="form-select" required value={formData.tier} onChange={e => setFormData({...formData, tier: Number(e.target.value)})}>
                    <option value={1}>Tier 1 (Direct)</option>
                    <option value={2}>Tier 2 (Indirect)</option>
                    <option value={3}>Tier 3 (Raw Material)</option>
                  </select>
                </div>
                
                {formData.tier > 1 && (
                  <div className="form-group">
                    <label>Parent Supplier (Tier {formData.tier - 1})</label>
                    <select className="form-select" value={formData.parentSupplier} onChange={e => setFormData({...formData, parentSupplier: e.target.value})}>
                      <option value="">-- Select Parent --</option>
                      {suppliers.filter(s => s.tier === formData.tier - 1).map(parent => (
                        <option key={parent._id} value={parent._id}>{parent.name} (ID: {parent.supplierId})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Material Supplied</label>
                  <input type="text" className="form-input" value={formData.materialSupplied} onChange={e => setFormData({...formData, materialSupplied: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input type="text" className="form-input" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Contact Email</label>
                  <input type="email" className="form-input" value={formData.contactEmail} onChange={e => setFormData({...formData, contactEmail: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn--outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary">{editingSupplier ? 'Save Changes' : 'Add Supplier'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
