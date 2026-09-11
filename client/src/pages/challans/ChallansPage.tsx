import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Eye,
  Edit2,
  Printer,
  Trash2,
  Loader2,
} from 'lucide-react';
import { challanApi, customerApi, productApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  SalesChallan,
  Customer,
  Product,
  Pagination as PaginationType,
} from '../../types';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import { Alert } from '../../components/common/Alert';

interface FormItem {
  productId: string;
  quantity: number;
  availableStock?: number;
  unitPrice?: number;
}

export const ChallansPage: React.FC = () => {
  const { canManageChallans, canConfirmChallan, canCancelChallan } = useAuth();

  const [challans, setChallans] = useState<SalesChallan[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [insufficientStockError, setInsufficientStockError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Available lookups for form
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([]);
  const [productOptions, setProductOptions] = useState<Product[]>([]);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState<SalesChallan | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form states
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [formItems, setFormItems] = useState<FormItem[]>([{ productId: '', quantity: 1 }]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchChallans = useCallback(
    async (pageNumber = 1) => {
      setLoading(true);
      setError(null);
      try {
        const res = await challanApi.getAll({
          page: pageNumber,
          limit: 10,
          status: statusFilter || undefined,
          search: search || undefined,
        });
        setChallans(res.challans);
        setPagination(res.pagination);
      } catch (err: any) {
        setError(err.message || 'Failed to load sales challans');
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, search]
  );

  useEffect(() => {
    fetchChallans(1);
  }, [fetchChallans]);

  // Load lookup data for create/edit forms
  const loadLookups = async () => {
    try {
      const [custRes, prodRes] = await Promise.all([
        customerApi.getAll({ limit: 100 }),
        productApi.getAll({ limit: 100 }),
      ]);
      setCustomerOptions(custRes.customers);
      setProductOptions(prodRes.products);
    } catch (err) {
      console.warn('Could not load lookups for challan form:', err);
    }
  };

  const handleOpenCreate = async () => {
    await loadLookups();
    setSelectedCustomerId('');
    setFormItems([{ productId: '', quantity: 1 }]);
    setNotes('');
    setError(null);
    setInsufficientStockError(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = async (ch: SalesChallan) => {
    if (ch.status !== 'DRAFT') {
      setError('Only DRAFT challans can be edited.');
      return;
    }
    await loadLookups();
    setSelectedChallan(ch);
    setSelectedCustomerId(ch.customerId);
    setNotes(ch.notes || '');

    // Pre-populate items
    if (ch.items && ch.items.length > 0) {
      setFormItems(
        ch.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: Number(it.unitPriceSnapshot),
        }))
      );
    } else {
      setFormItems([{ productId: '', quantity: 1 }]);
    }
    setError(null);
    setInsufficientStockError(null);
    setIsEditModalOpen(true);
  };

  const handleOpenDetail = async (ch: SalesChallan) => {
    setSelectedChallan(ch);
    setIsDetailModalOpen(true);
    setDetailLoading(true);
    setInsufficientStockError(null);
    try {
      const full = await challanApi.getById(ch.id);
      setSelectedChallan(full);
    } catch (err: any) {
      setError(err.message || 'Failed to load full challan details');
    } finally {
      setDetailLoading(false);
    }
  };

  // Dynamic Item Row Management
  const handleAddItemRow = () => {
    setFormItems([...formItems, { productId: '', quantity: 1 }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const handleItemProductChange = (index: number, pId: string) => {
    const prod = productOptions.find((p) => p.id === pId);
    const updated = [...formItems];
    updated[index] = {
      productId: pId,
      quantity: updated[index].quantity || 1,
      availableStock: prod ? prod.currentStock : 0,
      unitPrice: prod ? Number(prod.unitPrice) : 0,
    };
    setFormItems(updated);
  };

  const handleItemQuantityChange = (index: number, qty: number) => {
    const updated = [...formItems];
    updated[index].quantity = Math.max(1, qty || 1);
    setFormItems(updated);
  };

  // Live Totals Calculations
  const calculatedTotalQuantity = formItems.reduce(
    (sum, item) => sum + (item.productId ? item.quantity : 0),
    0
  );

  const calculatedTotalAmount = formItems.reduce((sum, item) => {
    const price = item.unitPrice || 0;
    return sum + (item.productId ? price * item.quantity : 0);
  }, 0);

  const handleCreateChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setError('Please select a customer');
      return;
    }

    const validItems = formItems.filter((it) => it.productId && it.quantity > 0);
    if (validItems.length === 0) {
      setError('Please add at least one product item to the challan');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const created = await challanApi.create({
        customerId: selectedCustomerId,
        items: validItems.map((it) => ({ productId: it.productId, quantity: it.quantity })),
        notes: notes || undefined,
      });

      setIsCreateModalOpen(false);
      setSuccessMsg(
        `Draft Challan "${created.challanNumber}" created successfully! Stock remains unchanged until confirmed.`
      );
      setTimeout(() => setSuccessMsg(null), 5000);
      fetchChallans(1);
    } catch (err: any) {
      setError(err.message || 'Failed to create challan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChallan) return;

    const validItems = formItems.filter((it) => it.productId && it.quantity > 0);
    if (validItems.length === 0) {
      setError('At least one product item is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const updated = await challanApi.update(selectedChallan.id, {
        customerId: selectedCustomerId,
        items: validItems.map((it) => ({ productId: it.productId, quantity: it.quantity })),
        notes: notes || undefined,
      });

      setIsEditModalOpen(false);
      setSuccessMsg(`Challan "${updated.challanNumber}" draft updated with fresh snapshots.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchChallans(pagination.page);
    } catch (err: any) {
      setError(err.message || 'Failed to update challan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmChallan = async (challanId: string) => {
    if (!window.confirm('Are you sure you want to confirm this challan? This will atomically reduce inventory stock!')) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setInsufficientStockError(null);

    try {
      const confirmed = await challanApi.confirm(challanId);
      setSuccessMsg(
        `Challan #${confirmed.challanNumber} CONFIRMED! Inventory stock was successfully reduced.`
      );
      setTimeout(() => setSuccessMsg(null), 5000);

      // Refresh detail modal if open
      if (isDetailModalOpen && selectedChallan?.id === challanId) {
        setSelectedChallan(confirmed);
      }

      fetchChallans(pagination.page);
    } catch (err: any) {
      // Handle HTTP 409 Insufficient Stock Error gracefully
      if (err.statusCode === 409 || err.message?.includes('Insufficient stock')) {
        setInsufficientStockError(
          `DISPATCH BLOCKED (HTTP 409): ${err.message}. No stock was deducted and the challan remains in DRAFT state.`
        );
      } else {
        setError(err.message || 'Failed to confirm challan');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelChallan = async (challanId: string) => {
    if (!window.confirm('Are you sure you want to cancel this challan?')) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const cancelled = await challanApi.cancel(challanId);
      setSuccessMsg(`Challan #${cancelled.challanNumber} marked as CANCELLED.`);
      setTimeout(() => setSuccessMsg(null), 4000);

      if (isDetailModalOpen && selectedChallan?.id === challanId) {
        setSelectedChallan(cancelled);
      }

      fetchChallans(pagination.page);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel challan');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Challans</h1>
          <p className="page-subtitle">
            Commercial delivery documentation, multi-item order snapshots, and transactional stock dispatching.
          </p>
        </div>
        {canManageChallans && (
          <Button variant="primary" icon={<Plus size={18} />} onClick={handleOpenCreate}>
            Create New Challan
          </Button>
        )}
      </div>

      {successMsg && <Alert type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}
      {insufficientStockError && (
        <Alert
          type="error"
          message={insufficientStockError}
          onClose={() => setInsufficientStockError(null)}
        />
      )}
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Filter and Search Bar */}
      <div className="filter-toolbar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by challan # (e.g. CH-202609) or customer name..."
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
            <option value="DRAFT">DRAFT</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
      </div>

      {/* Challan Table */}
      <div className="panel-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Challan Number</th>
                <th>Customer / Business</th>
                <th>Items & Qty</th>
                <th>Total Value (₹)</th>
                <th>Status</th>
                <th>Created Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="table-loading-cell">
                    <Loader2 className="spinner" size={24} />
                    <span>Loading sales challans...</span>
                  </td>
                </tr>
              ) : challans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty-cell">
                    <FileSpreadsheet size={32} className="text-muted" />
                    <p>No sales challans found.</p>
                  </td>
                </tr>
              ) : (
                challans.map((ch) => (
                  <tr key={ch.id}>
                    <td>
                      <span className="font-mono font-bold text-accent">{ch.challanNumber}</span>
                    </td>
                    <td>
                      <div className="font-semibold text-primary">
                        {ch.customer?.businessName || ch.customer?.name}
                      </div>
                      {ch.customer?.businessName && (
                        <div className="text-muted text-xs">{ch.customer.name}</div>
                      )}
                    </td>
                    <td>
                      <span className="text-sm">
                        {ch.itemsCount || ch.items?.length || 0} items ({ch.totalQuantity || '—'} units)
                      </span>
                    </td>
                    <td className="font-bold font-mono">
                      ₹{Number(ch.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <StatusBadge status={ch.status} />
                    </td>
                    <td className="text-sm text-muted">
                      {new Date(ch.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="text-right">
                      <div className="actions-cell">
                        <button
                          type="button"
                          className="action-btn"
                          title="View / Print Challan"
                          onClick={() => handleOpenDetail(ch)}
                        >
                          <Eye size={16} />
                        </button>

                        {/* Edit DRAFT (Admin, Sales) */}
                        {ch.status === 'DRAFT' && canManageChallans && (
                          <button
                            type="button"
                            className="action-btn"
                            title="Edit Draft Challan"
                            onClick={() => handleOpenEdit(ch)}
                          >
                            <Edit2 size={16} />
                          </button>
                        )}

                        {/* Confirm Dispatch (Admin, Sales, Warehouse) */}
                        {ch.status === 'DRAFT' && canConfirmChallan && (
                          <button
                            type="button"
                            className="action-btn text-success"
                            title="Confirm Dispatch & Reduce Stock"
                            onClick={() => handleConfirmChallan(ch.id)}
                            disabled={submitting}
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}

                        {/* Cancel Challan (Admin, Accounts) */}
                        {ch.status !== 'CANCELLED' && canCancelChallan && (
                          <button
                            type="button"
                            className="action-btn text-danger"
                            title="Cancel Challan"
                            onClick={() => handleCancelChallan(ch.id)}
                            disabled={submitting}
                          >
                            <XCircle size={16} />
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
          onPageChange={(page) => fetchChallans(page)}
          disabled={loading}
        />
      </div>

      {/* CREATE DRAFT CHALLAN MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Draft Sales Challan"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateChallan} className="modal-form">
          <div className="form-group">
            <label className="form-label" htmlFor="challanCustomer">
              Customer Account *
            </label>
            <select
              id="challanCustomer"
              className="form-select"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              required
            >
              <option value="">-- Choose Customer --</option>
              {customerOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName} ({c.name}) - {c.mobileNumber}
                </option>
              ))}
            </select>
          </div>

          {/* Multiple Dynamic Item Rows */}
          <div className="challan-items-box">
            <div className="items-header">
              <span className="font-semibold text-sm">Product Line Items</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Plus size={14} />}
                onClick={handleAddItemRow}
              >
                Add Another Product
              </Button>
            </div>

            <div className="items-table-wrapper">
              <table className="items-table">
                <thead>
                  <tr>
                    <th style={{ width: '45%' }}>Product Item</th>
                    <th style={{ width: '18%' }}>Price (₹)</th>
                    <th style={{ width: '18%' }}>Quantity</th>
                    <th style={{ width: '14%' }}>Line Total</th>
                    <th style={{ width: '5%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {formItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <select
                          className="form-select text-sm"
                          value={item.productId}
                          onChange={(e) => handleItemProductChange(idx, e.target.value)}
                          required
                        >
                          <option value="">-- Select Product --</option>
                          {productOptions.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} [{p.sku}] - In Stock: {p.currentStock}
                            </option>
                          ))}
                        </select>
                        {item.availableStock !== undefined && (
                          <div className="text-xs text-muted mt-1">
                            Available in inventory: {item.availableStock} units
                          </div>
                        )}
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-input text-sm font-mono text-muted"
                          value={item.unitPrice ? `₹${item.unitPrice.toFixed(2)}` : '₹0.00'}
                          readOnly
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          className="form-input text-sm font-bold"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemQuantityChange(idx, parseInt(e.target.value, 10) || 1)
                          }
                          required
                        />
                      </td>
                      <td className="font-mono font-bold text-sm text-accent">
                        ₹{((item.unitPrice || 0) * item.quantity).toFixed(2)}
                      </td>
                      <td>
                        {formItems.length > 1 && (
                          <button
                            type="button"
                            className="remove-row-btn"
                            onClick={() => handleRemoveItemRow(idx)}
                            title="Remove line item"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculated Order Summary Banner */}
            <div className="challan-summary-banner">
              <div className="summary-stat">
                <span className="stat-label">Total Quantity</span>
                <span className="stat-val">{calculatedTotalQuantity} units</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Total Amount</span>
                <span className="stat-val text-accent">
                  ₹{calculatedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="challanNotes">
              Order Notes / Delivery Instructions (Optional)
            </label>
            <textarea
              id="challanNotes"
              className="form-textarea"
              rows={2}
              placeholder="e.g. Delivery via Transporter XYZ, gate pass required"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Save Draft Challan
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT DRAFT CHALLAN MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Draft Challan: ${selectedChallan?.challanNumber}`}
        maxWidth="xl"
      >
        <form onSubmit={handleUpdateChallan} className="modal-form">
          <div className="form-group">
            <label className="form-label" htmlFor="editChallanCustomer">
              Customer *
            </label>
            <select
              id="editChallanCustomer"
              className="form-select"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              required
            >
              {customerOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName} ({c.name})
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Item Rows for Edit */}
          <div className="challan-items-box">
            <div className="items-header">
              <span className="font-semibold text-sm">Line Items (Snapshots Will Refresh)</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Plus size={14} />}
                onClick={handleAddItemRow}
              >
                Add Line Item
              </Button>
            </div>

            <div className="items-table-wrapper">
              <table className="items-table">
                <thead>
                  <tr>
                    <th style={{ width: '45%' }}>Product</th>
                    <th style={{ width: '18%' }}>Price (₹)</th>
                    <th style={{ width: '18%' }}>Quantity</th>
                    <th style={{ width: '14%' }}>Line Total</th>
                    <th style={{ width: '5%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {formItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <select
                          className="form-select text-sm"
                          value={item.productId}
                          onChange={(e) => handleItemProductChange(idx, e.target.value)}
                          required
                        >
                          <option value="">-- Select Product --</option>
                          {productOptions.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} [{p.sku}]
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-input text-sm font-mono text-muted"
                          value={item.unitPrice ? `₹${item.unitPrice.toFixed(2)}` : '₹0.00'}
                          readOnly
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          className="form-input text-sm font-bold"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemQuantityChange(idx, parseInt(e.target.value, 10) || 1)
                          }
                          required
                        />
                      </td>
                      <td className="font-mono font-bold text-sm text-accent">
                        ₹{((item.unitPrice || 0) * item.quantity).toFixed(2)}
                      </td>
                      <td>
                        {formItems.length > 1 && (
                          <button
                            type="button"
                            className="remove-row-btn"
                            onClick={() => handleRemoveItemRow(idx)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="challan-summary-banner">
              <div className="summary-stat">
                <span className="stat-label">Total Quantity</span>
                <span className="stat-val">{calculatedTotalQuantity} units</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Updated Total</span>
                <span className="stat-val text-accent">
                  ₹{calculatedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="editChallanNotes">
              Notes
            </label>
            <textarea
              id="editChallanNotes"
              className="form-textarea"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Update Draft
            </Button>
          </div>
        </form>
      </Modal>

      {/* VIEW & PRINT CHALLAN MODAL */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Sales Challan: ${selectedChallan?.challanNumber}`}
        maxWidth="xl"
      >
        {detailLoading || !selectedChallan ? (
          <div className="page-loading">
            <Loader2 className="spinner" size={28} />
            <p>Loading challan documentation...</p>
          </div>
        ) : (
          <div className="printable-challan-container" id="printable-challan">
            {insufficientStockError && (
              <Alert
                type="error"
                message={insufficientStockError}
                onClose={() => setInsufficientStockError(null)}
              />
            )}

            {/* Print Header */}
            <div className="challan-sheet-header">
              <div className="company-details">
                <h2 className="company-name">Fundsroom Distribution Services</h2>
                <p className="company-meta">Central Warehouse & Wholesale Hub</p>
                <p className="company-meta">Email: operations@fundsroom.local | GSTIN: 27AABCF1234F1Z9</p>
              </div>
              <div className="challan-sheet-badge-box">
                <div className="sheet-doc-title">DELIVERY CHALLAN</div>
                <div className="sheet-number font-mono">{selectedChallan.challanNumber}</div>
                <StatusBadge status={selectedChallan.status} />
              </div>
            </div>

            {/* Parties and Date Meta */}
            <div className="challan-meta-grid">
              <div className="meta-card">
                <span className="meta-card-label">CUSTOMER / CONSIGNEE</span>
                <div className="font-bold text-base text-primary">
                  {selectedChallan.customer?.businessName}
                </div>
                <div className="text-sm">{selectedChallan.customer?.name}</div>
                <div className="text-sm text-muted">{selectedChallan.customer?.address}</div>
                <div className="text-sm font-mono mt-1">Mobile: {selectedChallan.customer?.mobileNumber}</div>
              </div>

              <div className="meta-card">
                <span className="meta-card-label">DOCUMENT METADATA</span>
                <div className="meta-row">
                  <span>Challan Date:</span>
                  <strong className="font-mono">
                    {new Date(selectedChallan.createdAt).toLocaleDateString('en-IN')}
                  </strong>
                </div>
                <div className="meta-row">
                  <span>Prepared By:</span>
                  <span>
                    {selectedChallan.createdBy?.name} ({selectedChallan.createdBy?.role})
                  </span>
                </div>
                {selectedChallan.confirmedAt && (
                  <div className="meta-row text-success">
                    <span>Dispatched Date:</span>
                    <strong>{new Date(selectedChallan.confirmedAt).toLocaleDateString('en-IN')}</strong>
                  </div>
                )}
                {selectedChallan.confirmedBy && (
                  <div className="meta-row text-success">
                    <span>Confirmed By:</span>
                    <span>{selectedChallan.confirmedBy.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Snapshot Table */}
            <div className="challan-items-view">
              <table className="sheet-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product Description</th>
                    <th>SKU Code</th>
                    <th className="text-right">Unit Price (₹)</th>
                    <th className="text-right">Dispatched Qty</th>
                    <th className="text-right">Line Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedChallan.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td className="font-medium">{item.productNameSnapshot}</td>
                      <td className="font-mono text-muted">{item.skuSnapshot}</td>
                      <td className="text-right font-mono">
                        ₹{Number(item.unitPriceSnapshot).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right font-bold font-mono">{item.quantity}</td>
                      <td className="text-right font-mono font-bold">
                        ₹{Number(item.lineTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="sheet-total-row">
                    <td colSpan={4} className="text-right font-bold">
                      TOTAL SUMMARY:
                    </td>
                    <td className="text-right font-bold font-mono">
                      {selectedChallan.totalQuantity} units
                    </td>
                    <td className="text-right font-bold font-mono text-accent">
                      ₹{Number(selectedChallan.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {selectedChallan.notes && (
              <div className="challan-notes-display">
                <span className="font-bold text-xs">Special Instructions / Remarks:</span>
                <p className="text-sm">{selectedChallan.notes}</p>
              </div>
            )}

            {/* Signatures Area for Printing */}
            <div className="challan-signatures-grid">
              <div className="signature-line">
                <div className="line" />
                <span>Authorized Warehouse Signatory</span>
              </div>
              <div className="signature-line">
                <div className="line" />
                <span>Receiver's Seal & Signature</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="sheet-actions no-print">
              <Button type="button" variant="outline" icon={<Printer size={16} />} onClick={handlePrint}>
                Print Document
              </Button>

              {selectedChallan.status === 'DRAFT' && canConfirmChallan && (
                <Button
                  type="button"
                  variant="success"
                  icon={<CheckCircle size={16} />}
                  onClick={() => handleConfirmChallan(selectedChallan.id)}
                  loading={submitting}
                >
                  Confirm Dispatch & Deduct Stock
                </Button>
              )}

              {selectedChallan.status !== 'CANCELLED' && canCancelChallan && (
                <Button
                  type="button"
                  variant="danger"
                  icon={<XCircle size={16} />}
                  onClick={() => handleCancelChallan(selectedChallan.id)}
                  loading={submitting}
                >
                  Cancel Challan
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
