import { Router, Request, Response } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Public Authentication Endpoints
router.post('/login', (req, res, next) => authController.login(req, res, next));

// Protected Profile Endpoint
router.get('/me', authenticate, (req, res, next) => authController.getMe(req, res, next));

// RBAC Verification Endpoints for Testing (Demonstrates RBAC enforcement for all 4 roles)
router.get('/test/admin', authenticate, requireRoles(Role.ADMIN), (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: `Welcome Admin! User '${req.user?.name}' (${req.user?.email}) has ADMIN privileges.`,
    user: req.user,
  });
});

router.get('/test/sales', authenticate, requireRoles(Role.SALES), (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: `Welcome Sales! User '${req.user?.name}' (${req.user?.email}) has SALES privileges.`,
    user: req.user,
  });
});

router.get('/test/warehouse', authenticate, requireRoles(Role.WAREHOUSE), (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: `Welcome Warehouse! User '${req.user?.name}' (${req.user?.email}) has WAREHOUSE privileges.`,
    user: req.user,
  });
});

router.get('/test/accounts', authenticate, requireRoles(Role.ACCOUNTS), (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: `Welcome Accounts! User '${req.user?.name}' (${req.user?.email}) has ACCOUNTS privileges.`,
    user: req.user,
  });
});

export default router;
