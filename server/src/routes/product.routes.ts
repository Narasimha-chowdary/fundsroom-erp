import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';
import { Role } from '@prisma/client';

const router = Router();

// All product routes require authentication
router.use(authenticate);

// 1. GET /api/v1/products - All 4 roles can view products
router.get(
  '/',
  requireRoles(Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.ACCOUNTS),
  (req, res, next) => productController.getProducts(req, res, next)
);

// 2. POST /api/v1/products - Only ADMIN and WAREHOUSE can create products
router.post(
  '/',
  requireRoles(Role.ADMIN, Role.WAREHOUSE),
  (req, res, next) => productController.createProduct(req, res, next)
);

// 3. GET /api/v1/products/:id - All 4 roles can view product details & stock movement history
router.get(
  '/:id',
  requireRoles(Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.ACCOUNTS),
  (req, res, next) => productController.getProductById(req, res, next)
);

// 4. PUT /api/v1/products/:id - Only ADMIN and WAREHOUSE can edit products
router.put(
  '/:id',
  requireRoles(Role.ADMIN, Role.WAREHOUSE),
  (req, res, next) => productController.updateProduct(req, res, next)
);

export default router;
