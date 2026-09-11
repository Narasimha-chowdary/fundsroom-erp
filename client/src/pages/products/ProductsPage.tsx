import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Plus,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  History,
  Edit2,
  AlertTriangle,
  Loader2,
  MapPin,
} from 'lucide-react';
import { productApi, inventoryApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Product, StockMovement, Pagination as PaginationType, MovementType } from '../../types';
import { Button } from '../../components/common/Button';
import { StockBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import { Alert } from '../../components/common/Alert';

export const ProductsPage: React.FC = () => {
  const { canManageProducts } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
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
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form states
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    category: '',
    unitPrice: 0,
    initialStock: 0,
    minStockAlert: 10,
    location: '',
  });

  const [movementForm, setMovementForm] = useState({
    movementType: 'IN' as MovementType,
    quantity: 1,
    reason: '',
    remarks: '',
  });

  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = useCallback(
    async (pageNumber = 1) => {
      setLoading(true);
      setError(null);
      try {
        const res = await productApi.getAll({
          page: pageNumber,
          limit: 10,
          search: search || undefined,
          category: categoryFilter || undefined,
          lowStock: lowStockFilter || undefined,
        });
        setProducts(res.products);
        setPagination(res.pagination);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch products');
      } finally {
        setLoading(false);
      }
    },
    [search, categoryFilter, lowStockFilter]
  );

  useEffect(() => {
    fetchProducts(1);
  }, [fetchProducts]);

  const handleOpenAdd = () => {
    setProductForm({
      name: '',
      sku: '',
      category: '',
      unitPrice: 0,
      initialStock: 0,
      minStockAlert: 10,
      location: '',
    });
    setError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setSelectedProduct(p);
    setProductForm({
      name: p.name,
      sku: p.sku,
      category: p.category,
      unitPrice: Number(p.unitPrice),
      initialStock: p.currentStock,
      minStockAlert: p.minStockAlert,
      location: p.location,
    });
    setError(null);
    setIsEditModalOpen(true);
  };

  const handleOpenMovement = (p: Product) => {
    setSelectedProduct(p);
    setMovementForm({
      movementType: 'IN',
      quantity: 1,
      reason: 'Purchase Receipt',
      remarks: '',
    });
    setError(null);
    setIsMovementModalOpen(true);
  };

  const handleOpenHistory = async (p: Product) => {
    setSelectedProduct(p);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const res = await inventoryApi.getMovements({ productId: p.id, limit: 50 });
      setMovements(res.movements);
    } catch (err: any) {
      setError(err.message || 'Failed to load stock movements');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await productApi.create({
        ...productForm,
        unitPrice: Number(productForm.unitPrice),
        initialStock: Number(productForm.initialStock),
        minStockAlert: Number(productForm.minStockAlert),
      });

      setIsAddModalOpen(false);
      setSuccessMsg(`Product "${productForm.name}" created successfully!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchProducts(1);
    } catch (err: any) {
      setError(err.message || 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setSubmitting(true);
    setError(null);

    try {
      await productApi.update(selectedProduct.id, {
        name: productForm.name,
        sku: productForm.sku,
        category: productForm.category,
        unitPrice: Number(productForm.unitPrice),
        minStockAlert: Number(productForm.minStockAlert),
        location: productForm.location,
      });

      setIsEditModalOpen(false);
      setSuccessMsg(`Product "${productForm.name}" updated successfully!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchProducts(pagination.page);
    } catch (err: any) {
      setError(err.message || 'Failed to update product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await inventoryApi.recordMovement({
        productId: selectedProduct.id,
        movementType: movementForm.movementType,
        quantity: Number(movementForm.quantity),
        reason: movementForm.reason,
        remarks: movementForm.remarks || undefined,
      });

      setIsMovementModalOpen(false);
      setSuccessMsg(
        `Stock movement recorded! New stock for "${selectedProduct.name}": ${res.currentStock} units.`
      );
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchProducts(pagination.page);
    } catch (err: any) {
      setError(err.message || 'Failed to record stock movement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Products & Inventory</h1>
          <p className="page-subtitle">
            Catalog management, stock movement audit trails, and minimum inventory alert monitors.
          </p>
        </div>
        {canManageProducts && (
          <Button variant="primary" icon={<Plus size={18} />} onClick={handleOpenAdd}>
            Add New Product
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
            placeholder="Search products by title or SKU code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <input
            type="text"
            className="filter-select"
            placeholder="Filter by category..."
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          />
          <button
            type="button"
            className={`filter-toggle-btn ${lowStockFilter ? 'active' : ''}`}
            onClick={() => setLowStockFilter(!lowStockFilter)}
          >
            <AlertTriangle size={16} />
            <span>Low Stock Only</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="panel-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product & SKU</th>
                <th>Category</th>
                <th>Unit Price (₹)</th>
                <th>Current Stock</th>
                <th>Min Alert</th>
                <th>Storage Location</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="table-loading-cell">
                    <Loader2 className="spinner" size={24} />
                    <span>Loading product inventory...</span>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty-cell">
                    <Package size={32} className="text-muted" />
                    <p>No products found matching the criteria.</p>
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="font-semibold text-primary">{p.name}</div>
                      <div className="text-muted text-sm font-mono">{p.sku}</div>
                    </td>
                    <td>
                      <span className="badge badge-neutral">{p.category}</span>
                    </td>
                    <td className="font-medium">₹{Number(p.unitPrice).toLocaleString('en-IN')}</td>
                    <td>
                      <StockBadge stock={p.currentStock} minAlert={p.minStockAlert} />
                    </td>
                    <td>{p.minStockAlert} units</td>
                    <td>
                      <span className="flex-center-gap text-sm">
                        <MapPin size={14} className="text-muted" />
                        {p.location}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="actions-cell">
                        {canManageProducts && (
                          <button
                            type="button"
                            className="action-btn text-accent"
                            title="Adjust Stock (IN/OUT)"
                            onClick={() => handleOpenMovement(p)}
                          >
                            <ArrowUpRight size={16} />
                          </button>
                        )}
                        {canManageProducts && (
                          <button
                            type="button"
                            className="action-btn"
                            title="Edit Product"
                            onClick={() => handleOpenEdit(p)}
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        {canManageProducts && (
                          <button
                            type="button"
                            className="action-btn"
                            title="Movement Audit Log"
                            onClick={() => handleOpenHistory(p)}
                          >
                            <History size={16} />
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
          onPageChange={(page) => fetchProducts(page)}
          disabled={loading}
        />
      </div>

      {/* ADD PRODUCT MODAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Catalog Product"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateProduct} className="modal-form">
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="prodName">
                Product Name *
              </label>
              <input
                id="prodName"
                className="form-input"
                placeholder="e.g. Industrial Drill Machine"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="prodSku">
                SKU / Item Code *
              </label>
              <input
                id="prodSku"
                className="form-input uppercase"
                placeholder="e.g. DR-8800"
                value={productForm.sku}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="prodCat">
                Category *
              </label>
              <input
                id="prodCat"
                className="form-input"
                placeholder="e.g. Power Tools"
                value={productForm.category}
                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="prodPrice">
                Unit Price (₹) *
              </label>
              <input
                id="prodPrice"
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={productForm.unitPrice}
                onChange={(e) => setProductForm({ ...productForm, unitPrice: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="prodStock">
                Initial Stock Quantity
              </label>
              <input
                id="prodStock"
                type="number"
                min="0"
                className="form-input"
                value={productForm.initialStock}
                onChange={(e) => setProductForm({ ...productForm, initialStock: parseInt(e.target.value, 10) || 0 })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="prodAlert">
                Low Stock Alert Quantity
              </label>
              <input
                id="prodAlert"
                type="number"
                min="0"
                className="form-input"
                value={productForm.minStockAlert}
                onChange={(e) => setProductForm({ ...productForm, minStockAlert: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prodLoc">
              Warehouse Storage Location *
            </label>
            <input
              id="prodLoc"
              className="form-input"
              placeholder="e.g. Bay C, Rack 4, Shelf 1"
              value={productForm.location}
              onChange={(e) => setProductForm({ ...productForm, location: e.target.value })}
              required
            />
          </div>

          <div className="modal-actions">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Create Product
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT PRODUCT MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Product Details"
        maxWidth="lg"
      >
        <form onSubmit={handleUpdateProduct} className="modal-form">
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="editProdName">
                Product Name *
              </label>
              <input
                id="editProdName"
                className="form-input"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="editProdSku">
                SKU / Code *
              </label>
              <input
                id="editProdSku"
                className="form-input uppercase"
                value={productForm.sku}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="editProdCat">
                Category *
              </label>
              <input
                id="editProdCat"
                className="form-input"
                value={productForm.category}
                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="editProdPrice">
                Unit Price (₹) *
              </label>
              <input
                id="editProdPrice"
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={productForm.unitPrice}
                onChange={(e) => setProductForm({ ...productForm, unitPrice: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="editProdAlert">
                Low Stock Alert Quantity
              </label>
              <input
                id="editProdAlert"
                type="number"
                min="0"
                className="form-input"
                value={productForm.minStockAlert}
                onChange={(e) => setProductForm({ ...productForm, minStockAlert: parseInt(e.target.value, 10) || 0 })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="editProdLoc">
                Storage Location *
              </label>
              <input
                id="editProdLoc"
                className="form-input"
                value={productForm.location}
                onChange={(e) => setProductForm({ ...productForm, location: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="modal-actions">
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Update Product
            </Button>
          </div>
        </form>
      </Modal>

      {/* QUICK INVENTORY MOVEMENT (IN / OUT) MODAL */}
      <Modal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        title={`Adjust Stock: ${selectedProduct?.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleRecordMovement} className="modal-form">
          <div className="movement-summary-card">
            <div>
              <span className="text-muted text-xs">SKU Code</span>
              <div className="font-mono font-bold text-accent">{selectedProduct?.sku}</div>
            </div>
            <div>
              <span className="text-muted text-xs">Available Stock</span>
              <div className="font-bold text-lg">{selectedProduct?.currentStock} units</div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Movement Type *</label>
            <div className="movement-type-tabs">
              <button
                type="button"
                className={`type-tab ${movementForm.movementType === 'IN' ? 'active in' : ''}`}
                onClick={() => setMovementForm({ ...movementForm, movementType: 'IN' })}
              >
                <ArrowDownRight size={18} />
                <span>IN (Restock / Receipt)</span>
              </button>
              <button
                type="button"
                className={`type-tab ${movementForm.movementType === 'OUT' ? 'active out' : ''}`}
                onClick={() => setMovementForm({ ...movementForm, movementType: 'OUT' })}
              >
                <ArrowUpRight size={18} />
                <span>OUT (Dispatch / Write-off)</span>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="movQty">
              Quantity to Adjust *
            </label>
            <input
              id="movQty"
              type="number"
              min="1"
              max={movementForm.movementType === 'OUT' ? selectedProduct?.currentStock : 99999}
              className="form-input font-bold"
              value={movementForm.quantity}
              onChange={(e) => setMovementForm({ ...movementForm, quantity: parseInt(e.target.value, 10) || 1 })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="movReason">
              Reason / Cause *
            </label>
            <input
              id="movReason"
              className="form-input"
              placeholder="e.g. Purchase order PO-1290, Damaged write-off, Bay transfer"
              value={movementForm.reason}
              onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="movRemarks">
              Remarks (Optional)
            </label>
            <textarea
              id="movRemarks"
              className="form-textarea"
              rows={2}
              placeholder="Optional notes or supplier reference"
              value={movementForm.remarks}
              onChange={(e) => setMovementForm({ ...movementForm, remarks: e.target.value })}
            />
          </div>

          <div className="modal-actions">
            <Button type="button" variant="outline" onClick={() => setIsMovementModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Apply Movement
            </Button>
          </div>
        </form>
      </Modal>

      {/* MOVEMENT AUDIT TRAIL MODAL */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Stock Movement Audit Log: ${selectedProduct?.name}`}
        maxWidth="lg"
      >
        {historyLoading ? (
          <div className="page-loading">
            <Loader2 className="spinner" size={28} />
            <p>Fetching stock audit movements...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Reason & Remarks</th>
                  <th>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted">
                      No stock movement history on record for this product.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id}>
                      <td className="text-sm font-mono text-muted">
                        {new Date(m.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            m.movementType === 'IN' ? 'badge-success' : 'badge-danger'
                          }`}
                        >
                          {m.movementType}
                        </span>
                      </td>
                      <td className="font-bold font-mono">
                        {m.movementType === 'IN' ? `+${m.quantity}` : `-${m.quantity}`}
                      </td>
                      <td>{m.reason}</td>
                      <td className="text-sm">
                        {m.createdBy?.name || 'Staff'} ({m.createdBy?.role})
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
};
