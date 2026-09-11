import { Router } from 'express';
import { challanController } from '../controllers/challan.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';
import { Role } from '@prisma/client';

const router = Router();

// All challan endpoints require authentication
router.use(authenticate);

// 1. GET /api/v1/challans - All 4 roles can view challans
router.get(
  '/',
  requireRoles(Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.ACCOUNTS),
  (req, res, next) => challanController.getChallans(req, res, next)
);

// 2. POST /api/v1/challans - Create DRAFT challan (ADMIN, SALES)
router.post(
  '/',
  requireRoles(Role.ADMIN, Role.SALES),
  (req, res, next) => challanController.createChallan(req, res, next)
);

// 3. GET /api/v1/challans/:id - View single challan with items & snapshots (All 4 roles)
router.get(
  '/:id',
  requireRoles(Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.ACCOUNTS),
  (req, res, next) => challanController.getChallanById(req, res, next)
);

// 4. PUT /api/v1/challans/:id - Edit DRAFT challan (ADMIN, SALES)
router.put(
  '/:id',
  requireRoles(Role.ADMIN, Role.SALES),
  (req, res, next) => challanController.updateChallan(req, res, next)
);

// 5. POST /api/v1/challans/:id/confirm - Confirm challan & atomically deduct stock (ADMIN, SALES, WAREHOUSE)
router.post(
  '/:id/confirm',
  requireRoles(Role.ADMIN, Role.SALES, Role.WAREHOUSE),
  (req, res, next) => challanController.confirmChallan(req, res, next)
);

// 6. POST /api/v1/challans/:id/cancel - Cancel challan (ADMIN, ACCOUNTS)
router.post(
  '/:id/cancel',
  requireRoles(Role.ADMIN, Role.ACCOUNTS),
  (req, res, next) => challanController.cancelChallan(req, res, next)
);

export default router;
