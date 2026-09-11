export type Role = 'ADMIN' | 'SALES' | 'WAREHOUSE' | 'ACCOUNTS';

export type CustomerType = 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR';

export type CustomerStatus = 'LEAD' | 'ACTIVE' | 'INACTIVE';

export type MovementType = 'IN' | 'OUT';

export type ChallanStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt?: string;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  note: string;
  authorId: string;
  author?: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  mobileNumber: string;
  email?: string | null;
  businessName: string;
  gstNumber?: string | null;
  customerType: CustomerType;
  address: string;
  status: CustomerStatus;
  followUpDate?: string | null;
  createdById?: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
  notes?: CustomerNote[];
  challans?: {
    id: string;
    challanNumber: string;
    status: ChallanStatus;
    totalAmount: number | string;
    createdAt: string;
  }[];
  _count?: {
    notes: number;
    challans: number;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    category: string;
  };
  movementType: MovementType;
  quantity: number;
  reason: string;
  referenceId?: string | null;
  createdById: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitPrice: number | string;
  currentStock: number;
  minStockAlert: number;
  location: string;
  isActive: boolean;
  isLowStock?: boolean;
  isOutOfStock?: boolean;
  movements?: StockMovement[];
  createdAt: string;
  updatedAt?: string;
}

export interface ChallanItem {
  id?: string;
  challanId?: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    category?: string;
    currentStock?: number;
  };
  productNameSnapshot: string;
  skuSnapshot: string;
  unitPriceSnapshot: number | string;
  quantity: number;
  lineTotal: number | string;
}

export interface SalesChallan {
  id: string;
  challanNumber: string;
  customerId: string;
  customer?: {
    id: string;
    name: string;
    businessName: string;
    mobileNumber: string;
    email?: string;
    address?: string;
  };
  status: ChallanStatus;
  totalAmount: number | string;
  totalQuantity?: number;
  itemsCount?: number;
  notes?: string | null;
  createdById: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
  confirmedById?: string | null;
  confirmedBy?: {
    id: string;
    name: string;
    email: string;
    role: Role;
  } | null;
  confirmedAt?: string | null;
  cancelledById?: string | null;
  cancelledAt?: string | null;
  items?: ChallanItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  pagination?: Pagination;
  error?: {
    statusCode: number;
    message: string;
    details?: { field: string; message: string }[];
  };
}
