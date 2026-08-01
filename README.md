# Gravity Mart - Warehouse & Billing Management System

A secure, full-stack employee dashboard to manage warehouse operations, view inventory transactions, audit product movement, perform Point-of-Sale (POS) cashier billing, and generate printable invoice receipts.

## Features

- **Relational SQLite Database**: Backed by a relational database tracking employees, warehouse stock levels, purchase invoices, and movement logs.
- **Two-Factor Authentication (2FA)**: Two-step verification using a secure, email-based 6-digit OTP code (interceptable on the login interface for easy sandbox evaluation).
- **Role-Based Privilege Enforcement**:
  - `Admin`: Full access, including employee records control, item deletions, and report audit tables.
  - `Warehouse Manager`: Product definitions control, catalog listings, restocking inventory, and stock movement reports.
  - `Cashier`: Checkout terminal billing, manual/simulated barcode scans, and receipt logs.
- **Dynamic Inventory Updating**:
  - Fixed-package items reduce count by integer values.
  - Loose products accept decimal values and reduce stock by weight/volume (`kg`, `L`, etc.).
- **Live Reports & Analytics**: Daily sales revenue calculators, stock movement audit trail ledgers, and critical low-stock alert warnings.

## Getting Started

### Installation
From the root folder:
```bash
npm run install-all
```

### Running Locally
To launch both the Node.js API server (port 5000) and Vite React app dev server (port 5173) concurrently:
```bash
npm run dev
```

### Default Credentials
1. **Admin**: `admin` / `admin123` (OTP generated can be autofilled using the dev tools helper pane).
2. **Warehouse Manager**: `manager` / `manager123`
3. **Cashier**: `cashier` / `cashier123`
