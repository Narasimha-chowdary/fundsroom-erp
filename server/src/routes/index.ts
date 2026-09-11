import { Router } from 'express';
import authRoutes from './auth.routes';
import customerRoutes from './customer.routes';
import productRoutes from './product.routes';
import inventoryRoutes from './inventory.routes';
import challanRoutes from './challan.routes';

const router = Router();

// Mount authentication routes at /auth
router.use('/auth', authRoutes);

// Mount customer CRM routes at /customers
router.use('/customers', customerRoutes);

// Mount product catalog routes at /products
router.use('/products', productRoutes);

// Mount inventory movement routes at /inventory
router.use('/inventory', inventoryRoutes);

// Mount sales challan routes at /challans
router.use('/challans', challanRoutes);

export default router;
