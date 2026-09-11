import axios, { AxiosError } from 'axios';
import {
  ApiResponse,
  Customer,
  CustomerNote,
  Product,
  StockMovement,
  SalesChallan,
  User,
  Pagination,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token from localStorage
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('fundsroom_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Extract clean backend error message & handle 401
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    if (error.response?.status === 401) {
      // Don't auto-redirect if on login endpoint
      if (!error.config?.url?.includes('/auth/login')) {
        localStorage.removeItem('fundsroom_token');
        localStorage.removeItem('fundsroom_user');
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }

    const backendMessage =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';

    // Enhance error object with readable message
    const enhancedError = new Error(backendMessage);
    (enhancedError as any).response = error.response;
    (enhancedError as any).statusCode = error.response?.status;
    (enhancedError as any).details = error.response?.data?.error?.details;

    return Promise.reject(enhancedError);
  }
);

/* =========================================================================
   API SERVICES
   ========================================================================= */

// Auth
export const authApi = {
  login: async (credentials: { email: string; password: string }) => {
    const res = await apiClient.post<ApiResponse<{ token: string; user: User }>>('/auth/login', credentials);
    return res.data.data;
  },
  getMe: async () => {
    const res = await apiClient.get<ApiResponse<{ user: User }>>('/auth/me');
    return res.data.data.user;
  },
};

// Customers
export const customerApi = {
  getAll: async (params?: { page?: number; limit?: number; search?: string; status?: string; customerType?: string }) => {
    const res = await apiClient.get<ApiResponse<Customer[]>>('/customers', { params });
    return {
      customers: res.data.data,
      pagination: res.data.pagination as Pagination,
    };
  },
  getById: async (id: string) => {
    const res = await apiClient.get<ApiResponse<{ customer: Customer }>>(`/customers/${id}`);
    return res.data.data.customer;
  },
  create: async (data: Partial<Customer> & { initialNote?: string }) => {
    const res = await apiClient.post<ApiResponse<{ customer: Customer }>>('/customers', data);
    return res.data.data.customer;
  },
  update: async (id: string, data: Partial<Customer>) => {
    const res = await apiClient.put<ApiResponse<{ customer: Customer }>>(`/customers/${id}`, data);
    return res.data.data.customer;
  },
  addNote: async (id: string, note: string) => {
    const res = await apiClient.post<ApiResponse<{ note: CustomerNote }>>(`/customers/${id}/notes`, { note });
    return res.data.data.note;
  },
};

// Products
export const productApi = {
  getAll: async (params?: { page?: number; limit?: number; search?: string; category?: string; lowStock?: boolean; outOfStock?: boolean }) => {
    const res = await apiClient.get<ApiResponse<Product[]>>('/products', { params });
    return {
      products: res.data.data,
      pagination: res.data.pagination as Pagination,
    };
  },
  getById: async (id: string) => {
    const res = await apiClient.get<ApiResponse<{ product: Product }>>(`/products/${id}`);
    return res.data.data.product;
  },
  create: async (data: {
    name: string;
    sku: string;
    category: string;
    unitPrice: number;
    initialStock?: number;
    minStockAlert?: number;
    location: string;
  }) => {
    const res = await apiClient.post<ApiResponse<{ product: Product }>>('/products', data);
    return res.data.data.product;
  },
  update: async (id: string, data: Partial<Product>) => {
    const res = await apiClient.put<ApiResponse<{ product: Product }>>(`/products/${id}`, data);
    return res.data.data.product;
  },
};

// Inventory Movements
export const inventoryApi = {
  recordMovement: async (data: {
    productId: string;
    movementType: 'IN' | 'OUT';
    quantity: number;
    reason: string;
    remarks?: string;
  }) => {
    const res = await apiClient.post<ApiResponse<{ movement: StockMovement; currentStock: number }>>(
      '/inventory/movements',
      data
    );
    return res.data.data;
  },
  getMovements: async (params?: { page?: number; limit?: number; productId?: string; movementType?: string }) => {
    const res = await apiClient.get<ApiResponse<StockMovement[]>>('/inventory/movements', { params });
    return {
      movements: res.data.data,
      pagination: res.data.pagination as Pagination,
    };
  },
};

// Sales Challans
export const challanApi = {
  getAll: async (params?: { page?: number; limit?: number; status?: string; customerId?: string; search?: string }) => {
    const res = await apiClient.get<ApiResponse<SalesChallan[]>>('/challans', { params });
    return {
      challans: res.data.data,
      pagination: res.data.pagination as Pagination,
    };
  },
  getById: async (id: string) => {
    const res = await apiClient.get<ApiResponse<{ challan: SalesChallan }>>(`/challans/${id}`);
    return res.data.data.challan;
  },
  create: async (data: {
    customerId: string;
    items: { productId: string; quantity: number }[];
    notes?: string;
  }) => {
    const res = await apiClient.post<ApiResponse<{ challan: SalesChallan }>>('/challans', data);
    return res.data.data.challan;
  },
  update: async (
    id: string,
    data: {
      customerId?: string;
      items?: { productId: string; quantity: number }[];
      notes?: string;
    }
  ) => {
    const res = await apiClient.put<ApiResponse<{ challan: SalesChallan }>>(`/challans/${id}`, data);
    return res.data.data.challan;
  },
  confirm: async (id: string) => {
    const res = await apiClient.post<ApiResponse<{ challan: SalesChallan }>>(`/challans/${id}/confirm`);
    return res.data.data.challan;
  },
  cancel: async (id: string) => {
    const res = await apiClient.post<ApiResponse<{ challan: SalesChallan }>>(`/challans/${id}/cancel`);
    return res.data.data.challan;
  },
};
