import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';
import { Role } from '@prisma/client';

const router = Router();

// All inventory routes require authentication
router.use(authenticate);

// 1. POST /api/v1/inventory/movements - Record IN or OUT stock movement (ADMIN, WAREHOUSE)
router.post(
  '/movements',
  requireRoles(Role.ADMIN, Role.WAREHOUSE),
  (req, res, next) => productController.recordMovement(req, res, next)
);

// 2. GET /api/v1/inventory/movements - View audit log of stock movements (ADMIN, WAREHOUSE)
router.get(
  '/movements',
  requireRoles(Role.ADMIN, Role.WAREHOUSE),
  (req, res, next) => productController.getMovements(req, res, next)
);

export default router;
