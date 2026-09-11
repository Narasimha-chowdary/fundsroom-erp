# Fundsroom ERP + CRM Operations Portal

A full-stack **Mini ERP & CRM Operations Portal** engineered for wholesale and distribution enterprises. The platform streamlines core business workflows—from customer relationship management and interaction logging to product catalog oversight, inventory tracking, and multi-item sales challan delivery execution with atomic concurrency guarantees.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Project Structure](#project-structure)
- [User Roles & Permissions Matrix](#user-roles--permissions-matrix)
- [API Endpoints Reference](#api-endpoints-reference)
- [Database Schema & Entity Relationships](#database-schema--entity-relationships)
- [Environment Variables](#environment-variables)
- [Local Development Setup](#local-development-setup)
- [Demo / Test Credentials](#demo--test-credentials)
- [Automated Testing Suite](#automated-testing-suite)
- [Core Business Rules & Data Integrity](#core-business-rules--data-integrity)
- [Deployment Guide](#deployment-guide)
- [Assumptions & Limitations](#assumptions--limitations)
- [Future Enhancements](#future-enhancements)
- [License](#license)

---

## Project Overview

In wholesale and distribution operations, physical goods move rapidly against pending orders while credit terms, lead communications, and inventory tallies change constantly. This portal unifies these mission-critical domains:

1. **Role-Gated Access Control**: Ensures distinct departmental boundaries across Administration, Sales, Warehouse Logistics, and Accounts.
2. **Customer CRM**: Centralized directory tracking wholesale tiers, GST identification, customer lifecycle statuses, and follow-up history.
3. **Inventory & Warehouse Tracking**: Catalog items with low-stock thresholds, location shelving, and immutable stock movement audit logs (`IN` and `OUT`).
4. **Sales Challan & Dispatch Operations**: Multi-product delivery challans that capture frozen item snapshots at order time and atomically deduct stock upon physical confirmation, strictly preventing negative inventory under concurrent workloads.

---

## Key Features

- **Authentication & RBAC**: JWT-based session handling with bcrypt password hashing and centralized role enforcement guards.
- **Customer CRM**:
  - Filterable by lifecycle status (`LEAD`, `ACTIVE`, `INACTIVE`) and tier (`RETAIL`, `WHOLESALE`, `DISTRIBUTOR`).
  - Searchable across customer name, business name, and mobile number.
  - Append-only follow-up notes preserving interaction history with author and timestamp audits.
- **Product & Stock Management**:
  - Real-time stock indicators (`In Stock`, `Low Stock`, `Out of Stock`).
  - Minimum stock threshold alert triggers.
  - Manual inventory adjustments (`IN` for receipts, `OUT` for write-offs/transfers) with required operational reasoning.
  - Complete chronological stock movement audit trail.
- **Sales Challans**:
  - Auto-generated sequential identifiers (`CH-YYYYMM-XXXX`).
  - Multi-product line items with live subtotal and total calculations.
  - **Catalog Snapshotting**: Line items preserve the product name, SKU, and unit price as of order placement, isolating historical orders from future price or name changes.
  - **Draft Editing**: Drafts can be revised freely; confirmed challans are locked.
  - **Atomic Confirmation**: Executes via database transactions (`prisma.$transaction`). Verifies stock across all items; if any item is deficient, aborts with **HTTP 409 Conflict** with zero partial deductions.
  - **Printable Format**: Clean invoice/challan delivery sheet supporting standard browser printing (`window.print()`).

---

## Technology Stack

### Frontend Application (`client/`)
- **Core**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Dev Server**: [Vite 6](https://vitejs.dev/)
- **Routing**: [React Router DOM v6](https://reactrouter.com/)
- **HTTP Client**: [Axios](https://axios-http.com/) with interceptors for Bearer token injection and centralized 401 redirect handling
- **Icons**: [Lucide React](https://lucide.dev/)
- **Styling**: Vanilla CSS utilizing custom properties (design tokens), responsive CSS Grid/Flexbox, and dark-slate ERP aesthetics

### Backend Service (`server/`)
- **Runtime**: [Node.js](https://nodejs.org/) (v20+ recommended) + [TypeScript](https://www.typescriptlang.org/)
- **Web Framework**: [Express.js](https://expressjs.com/) (v4)
- **Database & ORM**: [PostgreSQL](https://www.postgresql.org/) (tested with [Neon](https://neon.tech/)) via [Prisma ORM v5](https://www.prisma.io/)
- **Authentication**: [JSON Web Tokens (JWT)](https://jwt.io/) + [bcryptjs](https://github.com/dcodeIO/bcrypt.js)
- **Input Validation**: [Zod](https://zod.dev/)
- **Execution & Watcher**: [tsx](https://github.com/privatenumber/tsx)

---

## System Architecture

```text
┌─────────────────────────────────────────────────────────┐
│              Browser / Client UI (React + TS)           │
│   • AuthContext & Role Guards   • Reusable Modals/Badges│
│   • Customer CRM Views          • Product/Stock Views   │
│   • Multi-Item Challan Builder  • Printable Sheets      │
└────────────────────────────┬────────────────────────────┘
                             │ HTTP / REST (Axios)
                             ▼
┌─────────────────────────────────────────────────────────┐
│               Express.js Backend Service                │
│                                                         │
│   Routes Layer      (/routes/index.ts)                  │
│       │                                                 │
│   Middleware Stack  (auth.middleware, rbac.middleware,  │
│                      error.middleware, validate)        │
│       │                                                 │
│   Controllers Layer (Input extraction & HTTP mapping)   │
│       │                                                 │
│   Services Layer    (Business logic, calculations,      │
│                      interactive Prisma transactions)   │
└────────────────────────────┬────────────────────────────┘
                             │ Prisma Client
                             ▼
┌─────────────────────────────────────────────────────────┐
│               PostgreSQL Database (Neon)                │
│   • User, Customer, CustomerNote, Product,              │
│     StockMovement, SalesChallan, ChallanItem            │
│   • Enums, Unique Indexes, and Foreign Keys             │
└─────────────────────────────────────────────────────────┘
```

### Layer Responsibilities
1. **Frontend**: Manages user interface state, forms, client-side validation, live calculations, token persistence in `localStorage`, and role-based UI element visibility.
2. **Middleware**: Extracts Bearer tokens, validates JWT claims, checks user active status against the database, enforces role authorization guards, and formats Zod validation errors.
3. **Services**: Encapsulates core transactional business logic, deterministic sequential number generation, snapshot captures, and atomic inventory reduction.
4. **Database**: Enforces referential integrity, unique constraints (e.g. unique SKU, unique Challan number), and ACID compliance.

---

## Project Structure

```text
Fundsroom-erp/
├── client/                         # Frontend React + TypeScript application
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts           # Axios instance, interceptors, and typed API endpoints
│   │   ├── components/
│   │   │   ├── common/             # Alert, Badge, Button, Modal, Pagination
│   │   │   └── layout/             # AppLayout, ProtectedRoute
│   │   ├── context/
│   │   │   └── AuthContext.tsx     # Session management & role permission helpers
│   │   ├── pages/
│   │   │   ├── auth/LoginPage.tsx
│   │   │   ├── dashboard/DashboardPage.tsx
│   │   │   ├── customers/CustomersPage.tsx
│   │   │   ├── products/ProductsPage.tsx
│   │   │   └── challans/ChallansPage.tsx
│   │   ├── types/
│   │   │   └── index.ts            # Shared TypeScript interfaces & DTOs
│   │   ├── App.tsx                 # Client routing definitions
│   │   ├── main.tsx                # Entry DOM mount
│   │   ├── index.css               # Design system, CSS variables, print styles
│   │   └── vite-env.d.ts
│   ├── .env.example                # Frontend environment template
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts              # Vite config with /api/v1 proxy
│
├── server/                         # Backend Express + Prisma application
│   ├── prisma/
│   │   ├── migrations/             # Generated SQL migration history
│   │   ├── schema.prisma           # Prisma models, enums & relational mappings
│   │   └── seed.ts                 # Database seeder for demo users across all 4 roles
│   ├── src/
│   │   ├── controllers/            # auth, customer, product, challan controllers
│   │   ├── middlewares/            # auth, rbac, error handling middlewares
│   │   ├── routes/                 # Express route definitions
│   │   ├── services/               # Core business services & Prisma transactions
│   │   ├── types/
│   │   │   └── express.d.ts        # Express Request augmentation (req.user)
│   │   ├── utils/                  # errors, jwt, prisma singleton
│   │   ├── validators/             # Zod schemas (auth, customer, product, challan)
│   │   ├── app.ts                  # Express application setup
│   │   └── server.ts               # Server bootstrap listener
│   ├── .env.example                # Backend environment template
│   ├── test_phase2.ts              # Automated tests: Auth & RBAC
│   ├── test_phase3.ts              # Automated tests: Customer CRM
│   ├── test_phase4.ts              # Automated tests: Products & Inventory
│   ├── test_phase5.ts              # Automated tests: Sales Challans
│   ├── test_e2e_frontend_integration.ts # Automated tests: Frontend API flows
│   ├── package.json
│   └── tsconfig.json
│
├── .gitignore                      # Git ignore rules (node_modules, .env, dist)
├── package.json                    # Root workspace orchestrator
└── README.md
```

---

## User Roles & Permissions Matrix

The portal implements strict Role-Based Access Control (RBAC) enforced on both backend API routes and frontend interfaces:

| Resource / Operation | ADMIN | SALES | WAREHOUSE | ACCOUNTS |
| :--- | :---: | :---: | :---: | :---: |
| **Authenticate / View Own Profile** | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| **View Customer Directory & Details** | :white_check_mark: | :white_check_mark: | :x: | :white_check_mark: |
| **Create & Update Customers** | :white_check_mark: | :white_check_mark: | :x: | :x: |
| **Add Customer Interaction Notes** | :white_check_mark: | :white_check_mark: | :x: | :x: |
| **View Products & Stock Quantities** | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| **Create & Update Product Details** | :white_check_mark: | :x: | :white_check_mark: | :x: |
| **Record Stock Movements (IN / OUT)** | :white_check_mark: | :x: | :white_check_mark: | :x: |
| **View Stock Movement Audit Logs** | :white_check_mark: | :x: | :white_check_mark: | :x: |
| **View Sales Challans & Details** | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| **Create & Edit Draft Challans** | :white_check_mark: | :white_check_mark: | :x: | :x: |
| **Confirm Challan (Reduce Stock)** | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: |
| **Cancel Challan** | :white_check_mark: | :x: | :x: | :white_check_mark: |

---

## API Endpoints Reference

All application endpoints are prefixed with `/api/v1`.

### 1. Authentication
- `POST /api/v1/auth/login` — Public. Validates credentials, checks active status, returns JWT and safe user object.
- `GET /api/v1/auth/me` — Protected (`ALL ROLES`). Restores current user profile from Bearer token.

### 2. Customer CRM
- `GET /api/v1/customers` — Protected (`ADMIN`, `SALES`, `ACCOUNTS`). Paginated listing with search (`name`, `businessName`, `mobileNumber`) and filtering by `status` and `customerType`.
- `POST /api/v1/customers` — Protected (`ADMIN`, `SALES`). Registers customer; supports optional initial follow-up note.
- `GET /api/v1/customers/:id` — Protected (`ADMIN`, `SALES`, `ACCOUNTS`). Detailed customer profile with notes and associated challan references.
- `PUT /api/v1/customers/:id` — Protected (`ADMIN`, `SALES`). Partial update of customer details and follow-up date.
- `POST /api/v1/customers/:id/notes` — Protected (`ADMIN`, `SALES`). Appends follow-up interaction note.

### 3. Products
- `GET /api/v1/products` — Protected (`ALL ROLES`). Paginated catalog with search (`name`, `sku`), category filter, and `lowStock=true` / `outOfStock=true` flags.
- `POST /api/v1/products` — Protected (`ADMIN`, `WAREHOUSE`). Creates new product with unique SKU; creates an initial `IN` movement if `initialStock > 0`.
- `GET /api/v1/products/:id` — Protected (`ALL ROLES`). Product details with recent stock movement history.
- `PUT /api/v1/products/:id` — Protected (`ADMIN`, `WAREHOUSE`). Updates product pricing, alert quantities, location, or active status.

### 4. Inventory Movements
- `POST /api/v1/inventory/movements` — Protected (`ADMIN`, `WAREHOUSE`). Atomically adjusts stock (`IN` increases, `OUT` decreases). Returns **HTTP 409 Conflict** if requested `OUT` quantity exceeds current stock.
- `GET /api/v1/inventory/movements` — Protected (`ADMIN`, `WAREHOUSE`). Paginated audit trail of all inventory additions and deductions with user and product details.

### 5. Sales Challans
- `GET /api/v1/challans` — Protected (`ALL ROLES`). Paginated list with filters for `status`, `customerId`, and search.
- `POST /api/v1/challans` — Protected (`ADMIN`, `SALES`). Creates `DRAFT` challan, generates sequential `CH-YYYYMM-XXXX` number, snapshots line items, and calculates line/order totals. **Does not deduct stock.**
- `GET /api/v1/challans/:id` — Protected (`ALL ROLES`). Full challan sheet with line item snapshots, customer data, and audit records.
- `PUT /api/v1/challans/:id` — Protected (`ADMIN`, `SALES`). Edits `DRAFT` challans and refreshes snapshots. Rejects edits to `CONFIRMED` or `CANCELLED` challans with HTTP 400.
- `POST /api/v1/challans/:id/confirm` — Protected (`ADMIN`, `SALES`, `WAREHOUSE`). **Atomic Confirmation**: Checks inventory availability across all items; if sufficient, atomically reduces stock, logs `OUT` movements, and sets status to `CONFIRMED`. If any item is insufficient, returns **HTTP 409 Conflict** with zero stock alterations.
- `POST /api/v1/challans/:id/cancel` — Protected (`ADMIN`, `ACCOUNTS`). Cancels an existing non-cancelled challan.

---

## Database Schema & Entity Relationships

```text
 ┌─────────────┐       ┌─────────────────┐       ┌──────────────────┐
 │    User     │───┬──<│    Customer     │───┬──<│   CustomerNote   │
 └─────────────┘   │   └─────────────────┘   │   └──────────────────┘
        │          │                         │
        │          │   ┌─────────────────┐   │   ┌──────────────────┐
        │          ├──<│  SalesChallan   │>──┴──<│   ChallanItem    │
        │          │   └─────────────────┘       └──────────────────┘
        │          │                                      │
        │          │   ┌─────────────────┐                │
        └──────────┴──<│  StockMovement  │>───────────────┤
                       └─────────────────┘                │
                               │                          ▼
                               └─────────────────> ┌──────────────┐
                                                   │   Product    │
                                                   └──────────────┘
```

### Models Summary
- **User**: Portal operators (`ADMIN`, `SALES`, `WAREHOUSE`, `ACCOUNTS`) with hashed passwords.
- **Customer**: Client entities with classification (`RETAIL`, `WHOLESALE`, `DISTRIBUTOR`), GST, lifecycle status (`LEAD`, `ACTIVE`, `INACTIVE`), and follow-up dates.
- **CustomerNote**: Interaction records linked to customer and author.
- **Product**: Physical catalog goods with unique SKU, unit price, storage location, and minimum stock threshold.
- **StockMovement**: Immutable log for every stock addition or depletion (`IN` or `OUT`), tracking quantity, reason, and author.
- **SalesChallan**: Commercial delivery dispatch documents with sequential numbering, status, and financial totals.
- **ChallanItem**: Individual line items preserving immutable historical snapshots (`productNameSnapshot`, `skuSnapshot`, `unitPriceSnapshot`).

---

## Environment Variables

### Backend Configuration (`server/.env`)
Create `server/.env` based on `server/.env.example`:

| Variable Name | Required | Description |
| :--- | :---: | :--- |
| `PORT` | Yes | HTTP port the Express server listens on (default: `5000`) |
| `NODE_ENV` | Yes | Application environment (`development` or `production`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string with SSL mode if cloud-hosted |
| `JWT_SECRET` | Yes | Cryptographic secret key used to sign and verify JWT tokens (minimum 32 characters) |
| `JWT_EXPIRES_IN` | No | Token lifespan before expiration (e.g. `7d`, `24h`) |
| `CORS_ORIGIN` | No | Permitted origin for CORS requests (default: `http://localhost:5173`) |
| `DEMO_USER_PASSWORD` | No | Password used by `prisma/seed.ts` when generating demo users |

### Frontend Configuration (`client/.env`)
Create `client/.env` based on `client/.env.example`:

| Variable Name | Required | Description |
| :--- | :---: | :--- |
| `VITE_API_BASE_URL` | Yes | API v1 base URL. Use `/api/v1` in local development (proxied by Vite) or the full backend URL in production |

> [!CAUTION]
> Never commit real `.env` files containing actual passwords, database connection strings, or JWT secrets to version control.

---

## Local Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v20+ or v24+
- [npm](https://www.npmjs.com/) v10+
- An active PostgreSQL database (local instance or cloud database such as [Neon](https://neon.tech/))

### Step-by-Step Instructions

#### 1. Clone the Repository
```bash
git clone https://github.com/Narasimha-chowdary/fundsroom-erp.git
cd fundsroom-erp
```

#### 2. Install Dependencies
Install dependencies for both backend and frontend:
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install

# Return to root
cd ..
```

#### 3. Configure Environment Variables
Create the server environment file:
```bash
# In server/
copy .env.example .env
```
Update `server/.env` with your PostgreSQL `DATABASE_URL` and a secure `JWT_SECRET`.

#### 4. Apply Database Migrations & Generate Prisma Client
```bash
cd server
npx prisma migrate dev --name init
npx prisma generate
```

#### 5. Seed Demo Users
Populate the database with the four role-based accounts:
```bash
npm run prisma:seed
```

#### 6. Start the Applications
Open two terminal windows:

**Terminal 1 — Start Backend Server**:
```bash
cd server
npm run dev
# Server listens on http://localhost:5000
```

**Terminal 2 — Start Frontend Application**:
```bash
cd client
npm run dev
# Vite dev server runs at http://localhost:5173
```

Navigate to `http://localhost:5173` in your browser.

---

## Demo / Test Credentials

> [!WARNING]
> These credentials are for assessment and demonstration use only and must not be used in production environments.

The database seeder provisions four role accounts for testing (passwords securely hashed with bcrypt):

| Role | Email | Password | Assigned Permissions |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@fundsroom.local` | `Fundsroom@2026` | Full platform oversight across all modules |
| **SALES** | `sales@fundsroom.local` | `Fundsroom@2026` | Full CRM management, Challan drafting & confirmation; Product catalog view |
| **WAREHOUSE** | `warehouse@fundsroom.local` | `Fundsroom@2026` | Product creation, manual stock IN/OUT, movement audit log, Challan confirmation |
| **ACCOUNTS** | `accounts@fundsroom.local` | `Fundsroom@2026` | Customer and Product viewing; Challan auditing and cancellation |

> [!TIP]
> The login interface includes **1-click quick-fill buttons** for each role, allowing instant testing without manually typing credentials.

---

## Automated Testing Suite

The repository contains standalone, zero-dependency integration test suites covering all business requirements:

| Test Script | Target Domain | Command |
| :--- | :--- | :--- |
| `server/test_phase2.ts` | Auth, JWT signing, password verification, 401/403 RBAC checks | `npx tsx server/test_phase2.ts` |
| `server/test_phase3.ts` | Customer CRUD, search, status/type filters, notes history, pagination | `npx tsx server/test_phase3.ts` |
| `server/test_phase4.ts` | Product catalog, atomic IN/OUT stock adjustments, 409 insufficient stock, SKU uniqueness | `npx tsx server/test_phase4.ts` |
| `server/test_phase5.ts` | Multi-item challan creation, snapshots, draft editing, atomic stock deduction, 409 rollback | `npx tsx server/test_phase5.ts` |
| `server/test_e2e_frontend_integration.ts` | Full end-to-end integration flows simulating frontend client calls | `npx tsx server/test_e2e_frontend_integration.ts` |

### Running the Full Test Suite
Ensure the backend server is running on `http://localhost:5000`, then execute:
```bash
cd server
npx tsx test_phase2.ts
npx tsx test_phase3.ts
npx tsx test_phase4.ts
npx tsx test_phase5.ts
npx tsx test_e2e_frontend_integration.ts
```

All test scripts report 100% pass rates across assertions.

---

## Core Business Rules & Data Integrity

1. **Non-Negative Stock Guarantee**: Current inventory stock must never become negative.
2. **Draft Challan Non-Deduction**: Creating or updating a `DRAFT` challan does not deduct inventory stock.
3. **Atomic Confirmation**: Confirming a challan executes within an interactive database transaction (`prisma.$transaction`). Stock availability is verified across all items before any deduction is made.
4. **All-or-Nothing Rollback**: If any single line item in a challan exceeds available stock, the entire confirmation fails with **HTTP 409 Conflict**. No partial stock deductions or orphaned `StockMovement` records occur.
5. **State Immutability**: Once a challan is marked `CONFIRMED`, it cannot be edited or re-confirmed.
6. **Catalog Snapshot Integrity**: Challan line items store immutable copies of `productNameSnapshot`, `skuSnapshot`, and `unitPriceSnapshot` taken at order creation time. Subsequent price changes or product updates in the master catalog do not alter historical records.
7. **Sequential Numbering**: Challan numbers are auto-generated sequentially per month (`CH-YYYYMM-XXXX`).

---

## Deployment Guide

### Database (Neon PostgreSQL)
1. Create a PostgreSQL project on [Neon](https://neon.tech/).
2. Copy the connection string into your production environment variables as `DATABASE_URL`.
3. Run migrations against the database:
   ```bash
   npx prisma migrate deploy
   ```

### Backend Service (Render / Railway)
1. Connect your repository to [Render](https://render.com/) as a **Web Service**.
2. Set Root Directory to `server`.
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. Configure Environment Variables:
   - `DATABASE_URL`: Cloud PostgreSQL connection string
   - `JWT_SECRET`: Random 32+ character string
   - `NODE_ENV`: `production`
   - `CORS_ORIGIN`: Your deployed frontend URL

### Frontend Application (Vercel / Netlify)
1. Connect your repository to [Vercel](https://vercel.com/) as a new project.
2. Set Root Directory to `client`.
3. Framework Preset: `Vite`.
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Configure Environment Variable:
   - `VITE_API_BASE_URL`: Full URL of your deployed backend (e.g. `https://your-api.onrender.com/api/v1`)

---

## Assumptions & Limitations

- **Stock Restoration on Cancellation**: In accordance with project requirements, cancelling a challan marks its status as `CANCELLED` and logs audit metadata, but does not automatically restock inventory unless requested.
- **Sequential Reset**: Challan sequence numbers reset per calendar month (`CH-202609-0001`, `CH-202610-0001`).
- **Single Currency**: Monetary calculations assume INR (₹).

---

## Future Enhancements

The following optional extensions can be layered onto the existing architecture:
- [ ] Automated GST tax breakdown (CGST, SGST, IGST) calculation on challans
- [ ] Direct PDF export via server-side PDF generation (e.g. Puppeteer / PDFKit)
- [ ] Barcode / QR code generation for challan slips
- [ ] Automated low-stock email alerts via Nodemailer / SendGrid
- [ ] Interactive charting for sales trends and inventory turnover analytics

---

## License

This project is licensed under the ISC License.
