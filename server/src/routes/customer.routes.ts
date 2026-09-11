import { Router } from 'express';
import { customerController } from '../controllers/customer.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';
import { Role } from '@prisma/client';

const router = Router();

// All customer routes require authentication
router.use(authenticate);

// 1. GET /api/v1/customers - List, search, filter, paginate (ADMIN, SALES, ACCOUNTS)
router.get(
  '/',
  requireRoles(Role.ADMIN, Role.SALES, Role.ACCOUNTS),
  (req, res, next) => customerController.getCustomers(req, res, next)
);

// 2. POST /api/v1/customers - Create new customer (ADMIN, SALES)
router.post(
  '/',
  requireRoles(Role.ADMIN, Role.SALES),
  (req, res, next) => customerController.createCustomer(req, res, next)
);

// 3. GET /api/v1/customers/:id - View single customer details (ADMIN, SALES, ACCOUNTS)
router.get(
  '/:id',
  requireRoles(Role.ADMIN, Role.SALES, Role.ACCOUNTS),
  (req, res, next) => customerController.getCustomerById(req, res, next)
);

// 4. PUT /api/v1/customers/:id - Edit customer details (ADMIN, SALES)
router.put(
  '/:id',
  requireRoles(Role.ADMIN, Role.SALES),
  (req, res, next) => customerController.updateCustomer(req, res, next)
);

// 5. POST /api/v1/customers/:id/notes - Add follow-up note (ADMIN, SALES)
router.post(
  '/:id/notes',
  requireRoles(Role.ADMIN, Role.SALES),
  (req, res, next) => customerController.addCustomerNote(req, res, next)
);

export default router;
