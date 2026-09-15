# Techloom.ai Software Engineer Intern Assessment — Official Submission

**Candidate Name:** Praveena  
**Repository:** [https://github.com/Praveena32/techloom-assessment](https://github.com/Praveena32/techloom-assessment)  
**Submission Date:** September 15, 2026  
**Primary Stack:** TypeScript, Node.js (Express), React 18 (Vite), Prisma ORM, SQLite / PostgreSQL  

---

## 🚀 Live Deployment & Source Code Links

| Component | Target URL | Description | Status |
| :--- | :--- | :--- | :---: |
| **GitHub Repository** | [https://github.com/Praveena32/techloom-assessment](https://github.com/Praveena32/techloom-assessment) | Full mono-repository (`/task-01` & `/task-02`) | **Active** |
| **Task 01: POS System UI** | [https://techloom-pos-one.vercel.app](https://techloom-pos-one.vercel.app) | Cashier POS Register & Concurrency Visualizer | **Active** |
| **Task 01: POS System API** | [https://techloom-pos-api-delta.vercel.app](https://techloom-pos-api-delta.vercel.app/health) | Concurrency-Safe Order & Inventory API | **Active** |
| **Task 02: E-Commerce UI** | [https://techloom-store.vercel.app](https://techloom-store.vercel.app) | Storefront with Search, Cart & Order History | **Active** |
| **Task 02: E-Commerce API** | [https://techloom-store-api.vercel.app](https://techloom-store-api.vercel.app/health) | Storefront Catalog, Reservation & Refund API | **Active** |

---

## 📌 Executive Summary

This submission covers both **Task 01 (POS Order & Inventory System)** and **Task 02 (E-Commerce Checkout & Payment System)** adhering strictly to the architectural and business criteria outlined in the assessment document.

Both systems feature:
- Currency standardized to Sri Lankan Rupees (**LKR**).
- Zero-overselling guarantee enforced via atomic conditional database updates.
- 5-minute stock hold TTL with automated sweeper workers.
- Complete idempotency and double-submission protection.
- Automated test suites (including a 50-request concurrency race condition test).
- Fully responsive, modern glassmorphism frontend user interfaces.

---

## ⚡ Task 01: Concurrency-Safe POS System (`/task-01`)

### 1. Architectural Highlights
- **Atomic Stock Decrement Guard**:
  ```sql
  UPDATE "Product" SET stock = stock - ?, reservedStock = reservedStock + ?
  WHERE id = ? AND stock >= ?
  ```
  Prevents race conditions at the database layer without slow table-wide locks.
- **5-Minute Reservation TTL & Sweeper Worker**:
  Reservations carry `expiresAt = Date.now() + 5m`. A background worker queries expired holds, cancels the order, and atomically restores inventory.
- **Mock Payment Gateway**:
  Supports `SUCCESS` (order marked `PAID`), `FAILURE` (order marked `FAILED`, inventory restored), and `TIMEOUT` (reservation held).
- **Idempotency**:
  `idempotencyKey` prevents duplicate checkout attempts and returns `409 Conflict`.

### 2. Automated Concurrency Test Results
- **Command:** `cd task-01/backend && npm run test:concurrency`
- **Condition:** 50 simultaneous parallel checkout requests for 5 limited-edition items.
- **Outcome:**
  - Total Requests: **50**
  - Successful Reservations: **5**
  - Rejections (409 Out of Stock): **45**
  - Overselling Count: **0**
  - Execution Time: **305ms**

---

## 🛍️ Task 02: E-Commerce Storefront & Payment System (`/task-02`)

### 1. Architectural Highlights
- **Product Discovery**:
  - Debounced real-time keyword search across names and descriptions.
  - Multi-category filtering (`Audio`, `Wearables`, `Gaming`, `Laptops`, `Cameras`, `Accessories`).
  - Dynamic price range slider (LKR) and "In Stock Only" toggle.
  - Product details modal with specs, customer ratings, and stock status.
- **Cart & Pre-Payment Reservation**:
  - Responsive slide-over cart drawer.
  - Stock is reserved before payment processing begins to prevent cart hijacking.
- **Mock Payment Simulator**:
  - Gateway switcher with `SUCCESS`, `FAILURE`, and `TIMEOUT` simulation modes.
- **Post-Purchase Flow & Automated Refunds**:
  - Customer order history portal ("My Orders") with status badges (`PAID`, `RESERVED`, `REFUNDED`, `CANCELLED`).
  - **1-Click Refund Execution**: Customers can request refunds on paid orders. The system logs a refund transaction and restores physical stock to the product catalog immediately.

### 2. Automated E-to-E Test Results
- **Command:** `cd task-02/backend && npx ts-node tests/ecommerce.test.ts`
- **Outcome:**
  - Product Catalog Retrieval: **Passed (8 items)**
  - Keyword Search & Filters: **Passed**
  - Stock Reservation: **Passed**
  - Payment Capture & Duplicate Prevention: **Passed**
  - Simulated Refund & Inventory Restoration: **Passed**

---

## 🛠️ Technology Stack Summary

- **Backend**: Node.js, Express, TypeScript, Zod, UUID
- **Database & ORM**: Prisma ORM, SQLite (WAL mode) / PostgreSQL compatible
- **Frontend**: React 18, Vite, TypeScript, Lucide Icons, Custom Glassmorphism CSS
- **Deployment**: Vercel Serverless Edge Functions & Static Asset CDN
- **Concurrency Strategy**: Atomic conditional database operations with ACID transactions

---

## 💻 Local Setup & Execution Guide

```bash
# 1. Clone repository
git clone https://github.com/Praveena32/techloom-assessment.git
cd techloom-assessment

# 2. Run Task 01 (POS System)
cd task-01/backend
npm install && npx prisma db push && npx ts-node prisma/seed.ts && npm run dev
# In another terminal:
cd ../frontend && npm install && npm run dev

# 3. Run Task 02 (E-Commerce Storefront)
cd task-02/backend
npm install && npx prisma db push && npx ts-node prisma/seed.ts && npm run dev
# In another terminal:
cd ../frontend && npm install && npm run dev
```

---

## 📞 Candidate Contact Details

- **Candidate Name:** Praveena  
- **Email:** Candidate Contact Email  
- **GitHub:** [https://github.com/Praveena32](https://github.com/Praveena32)  
- **Repository:** [https://github.com/Praveena32/techloom-assessment](https://github.com/Praveena32/techloom-assessment)  

*Submitted for Techloom.ai Software Engineer Intern Practical Assessment.*
