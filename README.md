# MrMobile (ShopFlow) - Shop Management and POS System

A production-quality Shop Management and Point of Sale (POS) system designed for retail shop owners and cashiers. Engineered for multi-tenant shop management, inventory management, product catalogs, barcode generation & scanning, high-speed billing, sales tracking, and analytical reporting.

---

## 🛠 Technology Stack

- **Frontend**: React (v19) + React Router (v7)
- **Frontend Build Tool**: Vite
- **Backend**: Node.js & Express.js
- **Database**: Cloud Firestore
- **Authentication**: Firebase Authentication (Email/Password)
- **Admin Security**: Firebase Admin SDK
- **Language**: JavaScript (ES Modules for Frontend, CommonJS for Backend)
- **API Style**: RESTful API with token verification and centralized error handling

---

## 🏛 Architecture Diagram

```text
+-----------------------------------------------------------------------------------+
|                                  CLIENT (React)                                   |
|                                                                                   |
|  /register                  /login                   /setup-shop      /dashboard  |
|      |                         |                          |                |      |
+------|-------------------------|--------------------------|----------------|------+
       | (Email/Password)        | (Email/Password)         | (Shop Form)    |
       v                         v                          |                |
+----------------------------------------------------+      |                |
|               Firebase Authentication              |      |                |
|                                                    |      |                |
|  - Creates user credential (UID)                   |      |                |
|  - Issues cryptographically signed Firebase ID JWT |      |                |
|  - Listens via onAuthStateChanged()                |      |                |
+----------------------------------------------------+      |                |
       |                                                    |                |
       | 1. Create users/{uid}                              |                |
       |    role: "owner", shopId: null                     |                |
       v                                                    v                |
+------------------------------------+             +-------------------+     |
|          Cloud Firestore           |             |    Express API    |     |
|                                    |             |                   |     |
|  users/{uid}                       |<------------| POST /api/shops   |<----+
|    - uid: string                   | 2. Updates  | GET /api/shops/me | (Bearer ID Token)
|    - name: string                  |    shopId   |                   |
|    - email: string                 |             | 1. Verify token   |
|    - role: "owner"                 |             | 2. Extract UID    |
|    - shopId: string ---------------+             | 3. Create shop    |
|                                    |             | 4. Return shop    |
|  shops/{shopId}                    |<------------+                   |
|    - id: string                    | Creates shop                    |
|    - name: string                  |                                 |
|    - ownerId: string (UID)         |                                 |
|    - ownerName: string             |                                 |
|    - phone: string                 |                                 |
|    - address: string               |                                 |
+------------------------------------+---------------------------------+
```

---

## 🏬 User → Shop Relationship

Every business record in ShopFlow belongs strictly to a shop (`shopId`), establishing strict multi-tenant data isolation:

```text
User (users/{uid})
  ├── uid (Firebase Auth UID)
  ├── name
  ├── email
  ├── role: "owner"
  └── shopId: "{created-shop-id}"
         │
         ▼
      Shop (shops/{shopId})
        ├── id (Firestore-generated ID)
        ├── name
        ├── ownerId (UID)
        ├── ownerName
        ├── phone
        └── address
               │
               ▼ (Future Extensions)
            Products, Inventory, Sales, Customers, Suppliers
```

---

## 🔄 Application Flows

### 1. Registration Flow
```text
Register (/register)
  ↓ [1. User submits name, email, password]
Firebase Authentication account created
  ↓ [2. Auth UID generated]
User Firestore document created (users/{uid})
  [role = "owner", shopId = null]
  ↓ [3. Redirect]
Shop Setup (/setup-shop)
  ↓ [4. Owner enters shop name, phone, address]
Shop created via POST /api/shops
  ↓ [5. Backend creates shops/{shopId} & updates users/{uid}.shopId]
Dashboard (/dashboard)
```

### 2. Login Flow (Existing User)
```text
Login (/login)
  ↓ [1. User submits email and password]
Firebase Authentication validates credentials
  ↓ [2. onAuthStateChanged fetches users/{uid}]
Inspect shopId in Firestore:
  ├── If shopId == null  → Redirect to /setup-shop
  └── If shopId exists   → Redirect to /dashboard
```

### 3. Logout Flow
```text
Dashboard (/dashboard)
  ↓ [User clicks "Log Out"]
signOut(auth)
  ↓
User session cleared
  ↓
Redirect to /login
```

---

## 📡 Backend API Endpoints

All shop endpoints require an active Firebase ID token passed in the `Authorization` header (`Bearer <Firebase ID Token>`).

| Method | Endpoint | Protection | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Server liveness and health status check |
| `GET` | `/api/auth/me` | Protected | Returns authenticated user claims from verified token |
| `POST` | `/api/shops` | Protected | Creates a new shop; sets `ownerId` strictly from token; updates `users/{uid}.shopId` |
| `GET` | `/api/shops/me` | Protected | Returns the current shop associated with the authenticated user |
| `GET` | `/api/shops/:id` | Protected | Returns shop by ID; rejects with `403 Forbidden` if caller is not the owner |

### `POST /api/shops`
- **Headers**: `Authorization: Bearer <idToken>`, `Content-Type: application/json`
- **Request Body**:
```json
{
  "name": "ABC Grocery",
  "ownerName": "Mohamed Al-Farsi",
  "phone": "0771234567",
  "address": "Jaffna, Sri Lanka"
}
```
- **Response** (`201 Created`):
```json
{
  "success": true,
  "message": "Shop created successfully",
  "shop": {
    "id": "shop_1790457161712_0c3bo2g",
    "name": "ABC Grocery",
    "ownerId": "3VD753CIRPSi9biAJ3kYYWbxUbJ2",
    "ownerName": "Mohamed Al-Farsi",
    "phone": "0771234567",
    "address": "Jaffna, Sri Lanka",
    "createdAt": "2026-09-26T21:12:41.367Z",
    "updatedAt": "2026-09-26T21:12:41.367Z"
  }
}
```

### `GET /api/shops/me`
- **Headers**: `Authorization: Bearer <idToken>`
- **Response** (`200 OK` - With shop):
```json
{
  "success": true,
  "shop": {
    "id": "shop_1790457161712_0c3bo2g",
    "name": "ABC Grocery",
    "ownerId": "3VD753CIRPSi9biAJ3kYYWbxUbJ2",
    "ownerName": "Mohamed Al-Farsi",
    "phone": "0771234567",
    "address": "Jaffna, Sri Lanka"
  },
  "requiresSetup": false
}
```
- **Response** (`200 OK` - Setup Required):
```json
{
  "success": true,
  "shop": null,
  "requiresSetup": true,
  "message": "No shop is currently associated with this account. Shop setup is required."
}
```

---

## 📦 Product & Inventory Management

ShopFlow provides a multi-tenant product catalog and real-time inventory management foundation.

### 1. Product Data Model
Each product document is stored in the top-level Firestore collection `products/{productId}` with the internal Firestore document ID serving as the product's primary identifier:

```json
{
  "id": "prod_1790490760150_7310lje",
  "shopId": "shop_1790490736297_yx9vyvy",
  "name": "Coca Cola 500ml",
  "category": "Beverages",
  "sku": "COKE500",
  "barcode": "200000000001",
  "buyingPrice": 150,
  "sellingPrice": 180,
  "stockQuantity": 50,
  "lowStockLevel": 10,
  "unit": "piece",
  "description": "Chilled soft drink",
  "imageUrl": null,
  "createdAt": "2026-09-27T06:32:40.150Z",
  "updatedAt": "2026-09-27T06:32:40.150Z"
}
```

### 2. Shop Isolation Strategy
- **Backend Authority**: Products strictly belong to a single shop (`shopId`). The backend extracts and validates the caller's `shopId` from their authenticated profile (`users/{uid}`) and rejects unassigned users (`403 Forbidden`).
- **No Frontend Shop Tampering**: `shopId` is never accepted from the request body or parameters.
- **Tenant Partitioning**: All queries (`GET /api/products`, lookup by barcode, ID retrieval, updates, and deletions) are strictly scoped by `shopId`. Users from one shop can never view, update, or delete products belonging to another shop.

### 3. SKU Strategy
- **Shop-Level Uniqueness**: SKUs are strictly unique within each shop (case-insensitive, e.g., `COKE500`).
- **Multi-Tenant Flexibility**: Different shops can use identical SKUs without conflict.
- **Update Validation**: When editing a product, changing the SKU verifies that the new SKU is not already claimed by another product in that shop.

### 4. Barcode Generation Strategy & Image Rendering
- **Internal Shop Barcodes**: An automated barcode utility ([`server/utils/barcodeGenerator.js`](file:///c:/Users/Moham/OneDrive/Desktop/MrMobile/server/utils/barcodeGenerator.js)) generates unique numeric string barcodes in the format `200000 + 6-digit zero-padded sequential number` (e.g. `200000000001`, `200000000002`, `200000000003`).
- **Collision Resistance & Retries**: Scans existing barcodes within the shop to determine the sequence and guarantee uniqueness; retries automatically if a collision occurs.
- **Server Authority**: Frontend-supplied barcode values on product creation are strictly ignored; the backend generates and persists the barcode.
- **String Storage**: Stored as a string to preserve leading zeros.
- **Read-Only / Protected**: Existing product barcodes cannot be changed after creation.
- **On-The-Fly Code 128 Image Generation**: Uses `bwip-js` to render high-contrast 1D Code 128 PNG barcodes with human-readable numbers underneath without storing image blobs in Firestore.
- **Printable Labels**: Reusable React component ([`client/src/components/BarcodeLabel.jsx`](file:///c:/Users/Moham/OneDrive/Desktop/MrMobile/client/src/components/BarcodeLabel.jsx)) renders compact retail barcode stickers (Shop Name, Product Name, SKU, Barcode, Price) with `@media print` CSS isolating the sticker and suppressing page chrome.

### 5. Inventory Rules
- **Non-Negative Stock**: `stockQuantity` must always be `>= 0`. Any attempt to set a negative stock on creation or update is rejected with `400 Bad Request`.
- **Low-Stock Alerting**: A product is classified as low stock when `stockQuantity <= lowStockLevel`. The API supports filtering low-stock products via `?lowStock=true`.

---

## 📡 Product API Endpoints

All endpoints require an active Firebase ID token in the `Authorization` header (`Bearer <Firebase ID Token>`) or `?token=<idToken>` query param for media endpoints.

| Method | Endpoint | Protection | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/products` | Protected | Creates a new product; automatically assigns shopId and generates internal barcode |
| `GET` | `/api/products` | Protected | Lists shop products; supports search (`?search=`), category filter (`?category=`), and low stock filter (`?lowStock=true`) |
| `GET` | `/api/products/barcode/:barcode` | Protected | Looks up a product by its barcode within the user's shop |
| `GET` | `/api/products/:id` | Protected | Fetches product details by ID with shop ownership verification |
| `GET` | `/api/products/:id/barcode-image` | Protected | Streams on-the-fly Code 128 PNG barcode image with human-readable text |
| `PUT` | `/api/products/:id` | Protected | Updates product fields; verifies SKU uniqueness and protects `id`, `shopId`, `barcode`, `createdAt` |
| `DELETE` | `/api/products/:id` | Protected | Permanently deletes a product belonging to the caller's shop |

---

## 💡 API Usage Examples

### 1. Create Product (`POST /api/products`)
**Request:**
```http
POST /api/products HTTP/1.1
Host: localhost:5000
Authorization: Bearer <Firebase ID Token>
Content-Type: application/json

{
  "name": "Coca Cola 500ml",
  "category": "Beverages",
  "sku": "COKE500",
  "buyingPrice": 150,
  "sellingPrice": 180,
  "stockQuantity": 50,
  "lowStockLevel": 10,
  "unit": "piece",
  "description": "Cold refreshment"
}
```
**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Product created successfully",
  "product": {
    "id": "prod_1790490760150_7310lje",
    "shopId": "shop_1790490736297_yx9vyvy",
    "name": "Coca Cola 500ml",
    "category": "Beverages",
    "sku": "COKE500",
    "barcode": "200000000001",
    "buyingPrice": 150,
    "sellingPrice": 180,
    "stockQuantity": 50,
    "lowStockLevel": 10,
    "unit": "piece",
    "description": "Cold refreshment",
    "imageUrl": null,
    "createdAt": "2026-09-27T06:32:40.150Z",
    "updatedAt": "2026-09-27T06:32:40.150Z"
  }
}
```

### 2. Barcode Lookup (`GET /api/products/barcode/:barcode`)
**Request:**
```http
GET /api/products/barcode/200000000001 HTTP/1.1
Host: localhost:5000
Authorization: Bearer <Firebase ID Token>
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "product": {
    "id": "prod_1790490760150_7310lje",
    "shopId": "shop_1790490736297_yx9vyvy",
    "name": "Coca Cola 500ml",
    "category": "Beverages",
    "sku": "COKE500",
    "barcode": "200000000001",
    "buyingPrice": 150,
    "sellingPrice": 180,
    "stockQuantity": 50,
    "lowStockLevel": 10,
    "unit": "piece"
  }
}
```

### 3. Retrieve Barcode Image (`GET /api/products/:id/barcode-image`)
**Request:**
```http
GET /api/products/prod_1790490760150_7310lje/barcode-image HTTP/1.1
Host: localhost:5000
Authorization: Bearer <Firebase ID Token>
```
*(Also supports direct query token authentication: `?token=<idToken>` for image elements)*

**Response (`200 OK`):**
- **Content-Type**: `image/png`
- **Cache-Control**: `private, no-cache, no-store, must-revalidate`
- **X-Barcode-Value**: `200000000001`
- **Body**: Binary PNG image containing Code 128 barcode bars and centered human-readable numbers.

### 4. Update Product (`PUT /api/products/:id`)
**Request:**
```http
PUT /api/products/prod_1790490760150_7310lje HTTP/1.1
Host: localhost:5000
Authorization: Bearer <Firebase ID Token>
Content-Type: application/json

{
  "name": "Coca Cola 500ml Bottle (Updated)",
  "sellingPrice": 195,
  "stockQuantity": 45
}
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Product updated successfully",
  "product": {
    "id": "prod_1790490760150_7310lje",
    "shopId": "shop_1790490736297_yx9vyvy",
    "name": "Coca Cola 500ml Bottle (Updated)",
    "category": "Beverages",
    "sku": "COKE500",
    "barcode": "200000000001",
    "buyingPrice": 150,
    "sellingPrice": 195,
    "stockQuantity": 45,
    "lowStockLevel": 10,
    "unit": "piece",
    "updatedAt": "2026-09-27T06:33:15.000Z"
  }
}
```

---

## 💳 POS / Billing Cart Interface (`/pos`)

ShopFlow includes a high-speed, keyboard-friendly Point of Sale (POS) and Billing Cart interface designed for retail operations.

### 1. Key Features
- **USB Barcode Scanner Workflow**: Dedicated scanner input field remains automatically focused. Rapid input followed by Enter looks up products via `GET /api/products/barcode/:barcode` and instantly increments cart quantities without touching the mouse.
- **Real-Time Product Search**: As cashiers type names, SKUs, or barcodes, matching shop products appear with live prices and available stock.
- **Cart Management & Quantity Controls**: Plus/minus buttons, direct quantity entry, line item discount inputs, line total calculations, and item removal.
- **Stock Limit Protection**: Prevents adding or increasing quantities beyond currently available stock (`availableStock`), alerting with `"Insufficient stock"`. Rejects out-of-stock items (`stockQuantity <= 0`).
- **Billing Discounts**: Supports both fixed amount discounts and percentage discounts with strict boundary validation (non-negative, <= 100%, <= subtotal).
- **Payment & Cash Tender Calculation**: Supports Cash, Card, and Other payment methods. For cash transactions, entering the amount received automatically calculates and formats the change due in real time.
- **Responsive Scaffolding**: Dual-column desktop layout (Left: Search/Scanner & Catalog; Right: Cart, Summary, Payment) that cleanly stacks on mobile/tablet devices.

---

## 🔒 Firestore Security Principles

The [`firestore.rules`](file:///c:/Users/Moham/OneDrive/Desktop/MrMobile/firestore.rules) file enforces the following security model:

1. **User Data Isolation (`/users/{userId}`)**:
   - Each authenticated user can read, create, and update only their own document where `request.auth.uid == userId`.
   - Direct user deletions are denied.
2. **Shop Multi-Tenant Isolation (`/shops/{shopId}`)**:
   - Only authenticated users can create a shop, and the `ownerId` must equal `request.auth.uid`.
   - Only the shop owner or users assigned to that shop can read the shop's data.
   - Only the shop owner can update or delete their shop.
   - Users cannot access another shop's business records.
3. **Product Multi-Tenant Isolation (`/products/{productId}`)**:
   - Only authenticated users can read and write products.
   - Read, update, and delete operations enforce that the user belongs to the shop specified in the product record (`resource.data.shopId`).
   - Creation enforces that `stockQuantity >= 0`, `buyingPrice >= 0`, `sellingPrice >= 0`, and the assigned `shopId` matches the caller's assigned shop.
4. **Default Deny All**:
   - All other unmatched collection and document paths are blocked (`allow read, write: if false;`).

---

## ⚙️ Environment Variables

### Client (`client/.env`)
```env
# Backend REST API Base URL
VITE_API_URL=http://localhost:5000/api

# Client Environment
VITE_APP_ENV=development

# Firebase Web Client Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Server (`server/.env`)
```env
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Firebase Project & Admin SDK Configuration
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project_id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## 🚀 Running the Project

### 1. Start Backend API Server
```bash
cd server
npm run dev
# Server runs on http://localhost:5000
# Health check: http://localhost:5000/api/health
```

### 2. Start Frontend Client
```bash
cd client
npm run dev
# Client runs on http://localhost:5173
# POS / Billing: http://localhost:5173/pos
# Products page: http://localhost:5173/products
# Sales & Invoices: http://localhost:5173/sales
# Add Product: http://localhost:5173/products/add
```

---

## 🧾 Sales & Checkout Engine

### 1. Firestore `sales` Collection
Completed sales are stored in the top-level `sales` collection with an immutable snapshot of all product details:
```json
{
  "id": "firestore-doc-id",
  "shopId": "shop-id",
  "invoiceNumber": "INV-000001",
  "cashierId": "firebase-uid",
  "cashierName": "Cashier Name",
  "items": [
    {
      "productId": "product-id",
      "name": "Coca Cola 500ml",
      "sku": "COKE500",
      "barcode": "200000000001",
      "quantity": 2,
      "unitPrice": 180.00,
      "itemDiscount": 0.00,
      "lineTotal": 360.00
    }
  ],
  "subtotal": 360.00,
  "discountType": "percentage",
  "discountValue": 10,
  "discountAmount": 36.00,
  "grandTotal": 324.00,
  "paymentMethod": "cash",
  "amountReceived": 350.00,
  "changeAmount": 26.00,
  "createdAt": "serverTimestamp"
}
```

### 2. Atomic Inventory Deduction via Firestore Transactions
- **Zero Stock Race Conditions**: All product lookups, ownership verifications, and stock sufficiency checks are executed inside a single Firestore `db.runTransaction()`.
- **Pre-execution Stock Guard**: If any requested item has `requestedQuantity > currentStock`, the transaction aborts with `{ success: false, message: "Insufficient stock", product, availableStock, requestedQuantity }`.
- **Authoritative Calculations**: Frontend prices, totals, cashier identity, and shop ownership are strictly ignored; prices and stock levels are read directly from Firestore documents.
- **Cart Preservation on Failure**: If checkout fails, the POS cart remains intact so the cashier can adjust quantities without re-scanning items.

### 3. Concurrency-Safe Invoice Generation
- Invoices are sequential and unique per shop: `INV-000001`, `INV-000002`, `INV-000003`...
- Counter document: `shops/{shopId}/counters/sales` tracking `lastInvoiceNumber`.
- Incremented atomically inside the checkout transaction so simultaneous sales never receive conflicting invoice numbers.

### 4. Sales API Endpoints
- `POST /api/sales`: Atomic checkout, stock reduction, invoice generation.
- `GET /api/sales`: Retrieve sales history for authenticated shop (newest first).
- `GET /api/sales/:id`: View detailed sale receipt snapshot (enforces cross-shop tenant isolation).

### 5. Running the 12-Test Verification Suite
Run the automated test runner validating all 12 test specifications:
```bash
cd server
node test_checkout_flow.mjs
# Validates single sales, multi-item atomic deductions, insufficient stock rejections,
# cash change calculations, fixed & percentage discounts, sequential invoice numbers,
# price change snapshot immutability, cross-shop isolation, fake price rejection,
# concurrent stock safety, and existing endpoints.
```
