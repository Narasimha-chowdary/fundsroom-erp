import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Eye,
  MessageSquarePlus,
  Calendar,
  Clock,
  Loader2,
} from 'lucide-react';
import { customerApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Customer, CustomerType, CustomerStatus, Pagination as PaginationType } from '../../types';
import { Button } from '../../components/common/Button';
import { Badge, StatusBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import { Alert } from '../../components/common/Alert';

export const CustomersPage: React.FC = () => {
  const { canManageCustomers } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    mobileNumber: '',
    email: '',
    gstNumber: '',
    customerType: 'RETAIL' as CustomerType,
    address: '',
    status: 'LEAD' as CustomerStatus,
    followUpDate: '',
    initialNote: '',
  });

  const [noteInput, setNoteInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCustomers = useCallback(
    async (pageNumber = 1) => {
      setLoading(true);
      setError(null);
      try {
        const result = await customerApi.getAll({
          page: pageNumber,
          limit: 10,
          search: search || undefined,
          status: statusFilter || undefined,
          customerType: typeFilter || undefined,
        });
        setCustomers(result.customers);
        setPagination(result.pagination);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch customer directory');
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter, typeFilter]
  );

  useEffect(() => {
    fetchCustomers(1);
  }, [fetchCustomers]);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      businessName: '',
      mobileNumber: '',
      email: '',
      gstNumber: '',
      customerType: 'RETAIL',
      address: '',
      status: 'LEAD',
      followUpDate: '',
      initialNote: '',
    });
    setError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      businessName: customer.businessName,
      mobileNumber: customer.mobileNumber,
      email: customer.email || '',
      gstNumber: customer.gstNumber || '',
      customerType: customer.customerType,
      address: customer.address,
      status: customer.status,
      followUpDate: customer.followUpDate ? customer.followUpDate.split('T')[0] : '',
      initialNote: '',
    });
    setError(null);
    setIsEditModalOpen(true);
  };

  const handleOpenDetail = async (customer: Customer) => {
    setIsDetailModalOpen(true);
    setDetailLoading(true);
    setSelectedCustomer(customer);
    try {
      const full = await customerApi.getById(customer.id);
      setSelectedCustomer(full);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch customer profile');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await customerApi.create({
        ...formData,
        email: formData.email || undefined,
        gstNumber: formData.gstNumber || undefined,
        followUpDate: formData.followUpDate ? new Date(formData.followUpDate).toISOString() : undefined,
      });

      setIsAddModalOpen(false);
      setSuccessMsg(`Customer account "${formData.businessName}" created successfully!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchCustomers(1);
    } catch (err: any) {
      setError(err.message || 'Failed to create customer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setSubmitting(true);
    setError(null);

    try {
      await customerApi.update(selectedCustomer.id, {
        name: formData.name,
        businessName: formData.businessName,
        mobileNumber: formData.mobileNumber,
        email: formData.email || null,
        gstNumber: formData.gstNumber || null,
        customerType: formData.customerType,
        address: formData.address,
        status: formData.status,
        followUpDate: formData.followUpDate ? new Date(formData.followUpDate).toISOString() : null,
      });

      setIsEditModalOpen(false);
      setSuccessMsg(`Customer "${formData.businessName}" updated successfully!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchCustomers(pagination.page);
    } catch (err: any) {
      setError(err.message || 'Failed to update customer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !noteInput.trim()) return;

    setSubmitting(true);
    try {
      await customerApi.addNote(selectedCustomer.id, noteInput.trim());
      setNoteInput('');
      const updated = await customerApi.getById(selectedCustomer.id);
      setSelectedCustomer(updated);
      setSuccessMsg('Interaction note added!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to record note');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Customer CRM</h1>
          <p className="page-subtitle">
            Manage wholesale clients, leads, contact profiles, and follow-up interaction history.
          </p>
        </div>
        {canManageCustomers && (
          <Button variant="primary" icon={<Plus size={18} />} onClick={handleOpenAdd}>
            Register Customer
          </Button>
        )}
      </div>

      {successMsg && <Alert type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Filter and Search Bar */}
      <div className="filter-toolbar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by customer name, business, or mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="LEAD">LEAD</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>

          <select
            className="filter-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="RETAIL">Retail</option>
            <option value="WHOLESALE">Wholesale</option>
            <option value="DISTRIBUTOR">Distributor</option>
          </select>
        </div>
      </div>

      {/* Customer Data Table */}
      <div className="panel-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Business & Contact</th>
                <th>Mobile Number</th>
                <th>Customer Type</th>
                <th>Status</th>
                <th>Follow-up Date</th>
                <th>History</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="table-loading-cell">
                    <Loader2 className="spinner" size={24} />
                    <span>Loading customers...</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty-cell">
                    <Users size={32} className="text-muted" />
                    <p>No customer accounts match the current filter.</p>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="font-semibold text-primary">{c.businessName}</div>
                      <div className="text-muted text-sm">{c.name}</div>
                    </td>
                    <td>{c.mobileNumber}</td>
                    <td>
                      <Badge variant="neutral">{c.customerType}</Badge>
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>
                      {c.followUpDate ? (
                        <span className="flex-center-gap text-sm">
                          <Calendar size={14} className="text-muted" />
                          {new Date(c.followUpDate).toLocaleDateString('en-IN')}
                        </span>
                      ) : (
                        <span className="text-muted text-sm">—</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-neutral">
                        {c._count?.notes || 0} notes
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="actions-cell">
                        <button
                          type="button"
                          className="action-btn"
                          title="View Details"
                          onClick={() => handleOpenDetail(c)}
                        >
                          <Eye size={16} />
                        </button>
                        {canManageCustomers && (
                          <button
                            type="button"
                            className="action-btn"
                            title="Edit Customer"
                            onClick={() => handleOpenEdit(c)}
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          pagination={pagination}
          onPageChange={(page) => fetchCustomers(page)}
          disabled={loading}
        />
      </div>

      {/* ADD CUSTOMER MODAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Customer Account"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateCustomer} className="modal-form">
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="businessName">
                Business / Entity Name *
              </label>
              <input
                id="businessName"
                className="form-input"
                placeholder="e.g. Apex Wholesale Mart"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="contactName">
                Contact Person Name *
              </label>
              <input
                id="contactName"
                className="form-input"
                placeholder="e.g. Rajesh Sharma"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="mobileNumber">
                Mobile Number *
              </label>
              <input
                id="mobileNumber"
                className="form-input"
                placeholder="e.g. 9876543210"
                value={formData.mobileNumber}
                onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email Address (Optional)
              </label>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="contact@apexmart.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="gstNumber">
                GST Number (Optional)
              </label>
              <input
                id="gstNumber"
                className="form-input"
                placeholder="e.g. 27ABCDE1234F1Z5"
                value={formData.gstNumber}
                onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="customerType">
                Customer Type *
              </label>
              <select
                id="customerType"
                className="form-select"
                value={formData.customerType}
                onChange={(e) => setFormData({ ...formData, customerType: e.target.value as CustomerType })}
              >
                <option value="RETAIL">Retail</option>
                <option value="WHOLESALE">Wholesale</option>
                <option value="DISTRIBUTOR">Distributor</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="status">
                Lifecycle Status *
              </label>
              <select
                id="status"
                className="form-select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as CustomerStatus })}
              >
                <option value="LEAD">LEAD</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="followUpDate">
                Follow-up Date
              </label>
              <input
                id="followUpDate"
                type="date"
                className="form-input"
                value={formData.followUpDate}
                onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="address">
              Billing & Delivery Address *
            </label>
            <textarea
              id="address"
              className="form-textarea"
              rows={2}
              placeholder="Full street address, area, city, and state"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="initialNote">
              Initial Interaction Note (Optional)
            </label>
            <textarea
              id="initialNote"
              className="form-textarea"
              rows={2}
              placeholder="e.g. Inquired about wholesale discount margins at regional trade fair"
              value={formData.initialNote}
              onChange={(e) => setFormData({ ...formData, initialNote: e.target.value })}
            />
          </div>

          <div className="modal-actions">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Save Customer
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT CUSTOMER MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Customer Profile"
        maxWidth="lg"
      >
        <form onSubmit={handleUpdateCustomer} className="modal-form">
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="editBusinessName">
                Business Name *
              </label>
              <input
                id="editBusinessName"
                className="form-input"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="editName">
                Contact Person *
              </label>
              <input
                id="editName"
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="editMobile">
                Mobile Number *
              </label>
              <input
                id="editMobile"
                className="form-input"
                value={formData.mobileNumber}
                onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="editEmail">
                Email
              </label>
              <input
                id="editEmail"
                type="email"
                className="form-input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="editGst">
                GST Number
              </label>
              <input
                id="editGst"
                className="form-input"
                value={formData.gstNumber}
                onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="editType">
                Customer Type
              </label>
              <select
                id="editType"
                className="form-select"
                value={formData.customerType}
                onChange={(e) => setFormData({ ...formData, customerType: e.target.value as CustomerType })}
              >
                <option value="RETAIL">Retail</option>
                <option value="WHOLESALE">Wholesale</option>
                <option value="DISTRIBUTOR">Distributor</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="editStatus">
                Status
              </label>
              <select
                id="editStatus"
                className="form-select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as CustomerStatus })}
              >
                <option value="LEAD">LEAD</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="editFollowUp">
                Follow-up Date
              </label>
              <input
                id="editFollowUp"
                type="date"
                className="form-input"
                value={formData.followUpDate}
                onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="editAddress">
              Address *
            </label>
            <textarea
              id="editAddress"
              className="form-textarea"
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
            />
          </div>

          <div className="modal-actions">
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Update Profile
            </Button>
          </div>
        </form>
      </Modal>

      {/* CUSTOMER DETAIL & NOTES DRAWER / MODAL */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Customer Details & Interaction History"
        maxWidth="lg"
      >
        {detailLoading || !selectedCustomer ? (
          <div className="page-loading">
            <Loader2 className="spinner" size={28} />
            <p>Loading full profile...</p>
          </div>
        ) : (
          <div className="customer-detail-content">
            {/* Overview Header */}
            <div className="detail-top-card">
              <div>
                <h2 className="detail-name">{selectedCustomer.businessName}</h2>
                <div className="detail-badges-row">
                  <Badge variant="neutral">{selectedCustomer.customerType}</Badge>
                  <StatusBadge status={selectedCustomer.status} />
                  {selectedCustomer.gstNumber && (
                    <span className="text-xs font-mono text-muted">GST: {selectedCustomer.gstNumber}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Information Grid */}
            <div className="detail-info-grid">
              <div className="detail-info-item">
                <span className="info-label">Contact Person</span>
                <span className="info-val">{selectedCustomer.name}</span>
              </div>
              <div className="detail-info-item">
                <span className="info-label">Mobile Number</span>
                <span className="info-val">{selectedCustomer.mobileNumber}</span>
              </div>
              <div className="detail-info-item">
                <span className="info-label">Email</span>
                <span className="info-val">{selectedCustomer.email || '—'}</span>
              </div>
              <div className="detail-info-item">
                <span className="info-label">Follow-up Date</span>
                <span className="info-val">
                  {selectedCustomer.followUpDate
                    ? new Date(selectedCustomer.followUpDate).toLocaleDateString('en-IN')
                    : 'None scheduled'}
                </span>
              </div>
              <div className="detail-info-item full-width">
                <span className="info-label">Address</span>
                <span className="info-val">{selectedCustomer.address}</span>
              </div>
            </div>

            {/* Follow-up Notes Section */}
            <div className="notes-section">
              <h3 className="section-title">Follow-up Interaction Notes</h3>

              {canManageCustomers && (
                <form onSubmit={handleAddNote} className="add-note-box">
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Log discussion notes, next steps, quote updates..."
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    required
                  />
                  <div className="add-note-action">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      icon={<MessageSquarePlus size={16} />}
                      loading={submitting}
                      disabled={!noteInput.trim()}
                    >
                      Post Note
                    </Button>
                  </div>
                </form>
              )}

              <div className="notes-list">
                {!selectedCustomer.notes || selectedCustomer.notes.length === 0 ? (
                  <p className="text-muted text-sm py-2">No interaction notes recorded yet.</p>
                ) : (
                  selectedCustomer.notes.map((n) => (
                    <div key={n.id} className="note-card">
                      <div className="note-header">
                        <span className="note-author">
                          {n.author?.name || 'Staff Member'} ({n.author?.role || 'USER'})
                        </span>
                        <span className="note-time">
                          <Clock size={12} className="inline mr-1" />
                          {new Date(n.createdAt).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <p className="note-text">{n.note}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
