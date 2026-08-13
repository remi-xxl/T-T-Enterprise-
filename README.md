# Sales Tracker

A simple sales tracking system for small businesses to track product inventory and sales.

## Features

- **Dashboard**: Overview of sales, inventory value, and low stock alerts
- **Products**: Add, edit, and delete products with carton/piece tracking
- **Sales**: Record sales by piece or carton with date filtering
- **Inventory**: Visual inventory management with stock level indicators

## Tech Stack

- **Backend**: Node.js, Express, Prisma ORM
- **Database**: PostgreSQL
- **Frontend**: React, Tailwind CSS, Vite

## Setup Instructions

### 1. Database Setup

Make sure PostgreSQL is running and create the database:

```sql
CREATE DATABASE tracker_db;
```

### 2. Install Dependencies

```bash
# Backend
npm install

# Frontend
cd client
npm install
```

### 3. Configure Database

Update the `.env` file with your PostgreSQL credentials:

```
DATABASE_URL="postgresql://postgres:admin@localhost:5432/tracker_db"
```

### 4. Run Database Migrations

```bash
npx prisma db push
```

### 5. Start the Application

Open two terminals:

**Terminal 1 (Backend):**
```bash
npm start
```

**Terminal 2 (Frontend):**
```bash
cd client
npm run dev
```

### 6. Access the Application

Open your browser and go to: `http://localhost:5173`

## How to Use

### Adding Products

1. Go to **Products** page
2. Click **+ Add Product**
3. Fill in:
   - Product name
   - Price per piece
   - Pieces per carton
   - Color code (optional)
   - Low stock threshold
   - Initial cartons in stock

### Recording Sales

1. Go to **Sales** page
2. Click **+ Record Sale**
3. Select product
4. Choose sale type (Piece or Carton)
5. Enter quantity
6. Add optional notes
7. Click **Record Sale**

### Managing Inventory

1. Go to **Inventory** page
2. View all products with stock levels
3. Click **Edit** to update carton counts
4. Low stock items are highlighted in red

## API Endpoints

- `GET /api/products` - List all products
- `POST /api/products` - Create new product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `PUT /api/inventory/:productId` - Update inventory
- `GET /api/sales` - List all sales (with optional date filter)
- `POST /api/sales` - Record new sale
- `GET /api/dashboard` - Get dashboard statistics
