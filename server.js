require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

console.log('[STARTUP] Running prisma db push to ensure schema is synced...');
try {
  execSync('npx prisma db push 2>&1', { stdio: 'inherit', timeout: 60000 });
  console.log('[STARTUP] Prisma db push completed');
} catch (err) {
  console.error('[STARTUP] Prisma db push failed:', err.message);
}

const app = express();
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('ERROR: DATABASE_URL is not set!');
  process.exit(1);
}
const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// Pieces are the source of truth for stock.  Cartons are only a convenient
// display/unit when a product is packed in complete cartons.
function stockFromInput({ totalCartons, totalPieces }, piecesPerCarton) {
  const hasPieceCount = totalPieces !== '' && totalPieces !== null && totalPieces !== undefined;
  const pieces = Number(totalPieces);
  if (hasPieceCount && Number.isInteger(pieces) && pieces >= 0) {
    return { totalPieces: pieces, totalCartons: Math.floor(pieces / piecesPerCarton) };
  }

  const cartons = Number(totalCartons);
  const safeCartons = Number.isInteger(cartons) && cartons >= 0 ? cartons : 0;
  return { totalPieces: safeCartons * piecesPerCarton, totalCartons: safeCartons };
}

function calculateSalePricing({ quantity, saleType, piecesPerCarton, unitPrice, lineTotal, pricingMethod }) {
  const quantityNumber = Number(quantity);
  const piecesSold = saleType === 'carton' ? quantityNumber * piecesPerCarton : quantityNumber;
  if (!Number.isInteger(quantityNumber) || quantityNumber <= 0 || !Number.isFinite(piecesSold) || piecesSold <= 0) {
    throw new Error('Enter a valid quantity');
  }

  if (pricingMethod === 'line_total') {
    const totalPrice = Number(lineTotal);
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) throw new Error('Enter a valid total price for this quantity');
    return { totalPrice, unitPrice: totalPrice / piecesSold, pricingMethod };
  }

  const actualUnitPrice = Number(unitPrice);
  if (!Number.isFinite(actualUnitPrice) || actualUnitPrice <= 0) throw new Error('Enter a valid selling price');
  return { totalPrice: piecesSold * actualUnitPrice, unitPrice: actualUnitPrice, pricingMethod: 'per_piece' };
}

app.post('/api/auth/manager-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const manager = await prisma.user.findFirst({ where: { email, role: 'MANAGER' } });
    if (!manager) return res.status(401).json({ error: 'Invalid credentials' });
    const validPassword = await bcrypt.compare(password, manager.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true, manager: { id: manager.id, name: manager.name, email: manager.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function createDefaultManager() {
  try {
    const existingManager = await prisma.user.findFirst({ where: { role: 'MANAGER' } });
    if (!existingManager) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await prisma.user.create({ 
        data: { name: 'Admin', email: 'admin@store.com', password: hashedPassword, role: 'MANAGER' }
      });
      console.log('Default manager created: admin@store.com / admin123');
    }
  } catch (error) {
    console.log('Manager setup note:', error.message);
  }
}

app.get('/api/salesreps', async (req, res) => {
  try {
    const reps = await prisma.user.findMany({
      where: { role: 'SALES_REP' },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { name: 'asc' }
    });
    res.json(reps);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/salesreps', async (req, res) => {
  try {
    const { name, email } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already exists' });
    const rep = await prisma.user.create({
      data: { name, email, password: 'temp123', role: 'SALES_REP' },
      select: { id: true, name: true, email: true, createdAt: true }
    });
    res.status(201).json(rep);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/salesreps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;
    const rep = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { name, email },
      select: { id: true, name: true, email: true, createdAt: true }
    });
    res.json(rep);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/salesreps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.sale.deleteMany({ where: { userId: parseInt(id) } });
    await prisma.user.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Sales rep deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { inventory: true, variants: { include: { inventory: true } } }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, price, piecesPerCarton, colorCode, lowStockThreshold, totalCartons, totalPieces, hasVariants, variants } = req.body;
    const product = await prisma.product.create({
      data: {
        name, price, piecesPerCarton, colorCode,
        lowStockThreshold: lowStockThreshold || 5,
        hasVariants: hasVariants || false
      }
    });

    if (hasVariants && variants && variants.length > 0) {
      for (const v of variants) {
        const variant = await prisma.variant.create({
          data: { productId: product.id, name: v.name, colorCode: v.colorCode || null }
        });
        const stock = stockFromInput(v, piecesPerCarton);
        await prisma.variantInventory.create({
          data: {
            variantId: variant.id, totalCartons: stock.totalCartons,
            remainingCartons: stock.totalCartons, totalPieces: stock.totalPieces, remainingPieces: stock.totalPieces
          }
        });
      }
    } else {
      const stock = stockFromInput({ totalCartons, totalPieces }, piecesPerCarton);
      await prisma.inventory.create({
        data: {
          productId: product.id, totalCartons: stock.totalCartons,
          remainingCartons: stock.totalCartons, totalPieces: stock.totalPieces, remainingPieces: stock.totalPieces
        }
      });
    }

    const result = await prisma.product.findUnique({
      where: { id: product.id },
      include: { inventory: true, variants: { include: { inventory: true } } }
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, piecesPerCarton, colorCode, lowStockThreshold, totalCartons, totalPieces } = req.body;
    const stockWasProvided = totalCartons !== '' && totalCartons !== null && totalCartons !== undefined ||
      totalPieces !== '' && totalPieces !== null && totalPieces !== undefined;

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: parseInt(id) },
        data: { name, price, piecesPerCarton, colorCode, lowStockThreshold }
      });

      // Variant quantities are managed per variant; single-product stock can
      // be updated directly from this form in either cartons or pieces.
      if (!updated.hasVariants) {
        const inventory = await tx.inventory.findUnique({ where: { productId: updated.id } });
        if (inventory) {
          const stock = stockWasProvided
            ? stockFromInput({ totalCartons, totalPieces }, updated.piecesPerCarton)
            : { totalPieces: inventory.totalPieces, totalCartons: Math.floor(inventory.totalPieces / updated.piecesPerCarton) };
          const remainingPieces = stockWasProvided
            ? Math.max(0, inventory.remainingPieces + stock.totalPieces - inventory.totalPieces)
            : inventory.remainingPieces;
          await tx.inventory.update({
            where: { productId: updated.id },
            data: {
              totalCartons: stock.totalCartons,
              totalPieces: stock.totalPieces,
              remainingPieces,
              remainingCartons: Math.floor(remainingPieces / updated.piecesPerCarton)
            }
          });
        }
      }
      return updated;
    });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    await prisma.saleItem.updateMany({ where: { productId }, data: { productId: null } });
    await prisma.saleItem.updateMany({ where: { variant: { productId } }, data: { variantId: null } });
    const variants = await prisma.variant.findMany({ where: { productId } });
    for (const v of variants) {
      await prisma.variantInventory.deleteMany({ where: { variantId: v.id } });
    }
    await prisma.variant.deleteMany({ where: { productId } });
    await prisma.inventory.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    res.json({ message: 'Product deleted. Sales history preserved.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products', async (req, res) => {
  try {
    await prisma.saleItem.updateMany({ where: { productId: { not: null } }, data: { productId: null } });
    await prisma.saleItem.updateMany({ where: { variantId: { not: null } }, data: { variantId: null } });
    await prisma.variantInventory.deleteMany();
    await prisma.variant.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.product.deleteMany();
    res.json({ message: 'All products deleted. Sales history preserved.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products/:productId/variants', async (req, res) => {
  try {
    const { productId } = req.params;
    const { name, colorCode, totalCartons, totalPieces } = req.body;
    const product = await prisma.product.findUnique({ where: { id: parseInt(productId) } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const variant = await prisma.variant.create({
      data: { productId: parseInt(productId), name, colorCode: colorCode || null }
    });
    const stock = stockFromInput({ totalCartons, totalPieces }, product.piecesPerCarton);
    await prisma.variantInventory.create({
      data: {
        variantId: variant.id, totalCartons: stock.totalCartons,
        remainingCartons: stock.totalCartons, totalPieces: stock.totalPieces, remainingPieces: stock.totalPieces
      }
    });
    const result = await prisma.variant.findUnique({ where: { id: variant.id }, include: { inventory: true } });
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/variants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, colorCode } = req.body;
    const variant = await prisma.variant.update({
      where: { id: parseInt(id) }, data: { name, colorCode }
    });
    res.json(variant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/variants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const variantId = parseInt(id);
    await prisma.saleItem.updateMany({ where: { variantId }, data: { variantId: null } });
    await prisma.variantInventory.deleteMany({ where: { variantId } });
    await prisma.variant.delete({ where: { id: variantId } });
    res.json({ message: 'Variant deleted. Sales history preserved.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/inventory/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { totalCartons, totalPieces } = req.body;
    const inventory = await prisma.inventory.findUnique({ where: { productId: parseInt(productId) } });
    if (!inventory) return res.status(404).json({ error: 'Inventory not found' });
    const product = await prisma.product.findUnique({ where: { id: parseInt(productId) } });
    const stock = stockFromInput({ totalCartons, totalPieces }, product.piecesPerCarton);
    const piecesDiff = stock.totalPieces - inventory.totalPieces;
    const updated = await prisma.inventory.update({
      where: { productId: parseInt(productId) },
      data: {
        totalCartons: stock.totalCartons, totalPieces: stock.totalPieces,
        remainingPieces: Math.max(0, inventory.remainingPieces + piecesDiff),
        remainingCartons: Math.floor(Math.max(0, inventory.remainingPieces + piecesDiff) / product.piecesPerCarton)
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/variant-inventory/:variantId', async (req, res) => {
  try {
    const { variantId } = req.params;
    const { totalCartons, totalPieces } = req.body;
    const vInv = await prisma.variantInventory.findUnique({ where: { variantId: parseInt(variantId) } });
    if (!vInv) return res.status(404).json({ error: 'Variant inventory not found' });
    const variant = await prisma.variant.findUnique({ where: { id: parseInt(variantId) } });
    const product = await prisma.product.findUnique({ where: { id: variant.productId } });
    const stock = stockFromInput({ totalCartons, totalPieces }, product.piecesPerCarton);
    const piecesDiff = stock.totalPieces - vInv.totalPieces;
    const updated = await prisma.variantInventory.update({
      where: { variantId: parseInt(variantId) },
      data: {
        totalCartons: stock.totalCartons, totalPieces: stock.totalPieces,
        remainingPieces: Math.max(0, vInv.remainingPieces + piecesDiff),
        remainingCartons: Math.floor(Math.max(0, vInv.remainingPieces + piecesDiff) / product.piecesPerCarton)
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function deductInventory(productId, variantId, saleType, quantity, piecesPerCarton) {
  if (variantId) {
    const vInv = await prisma.variantInventory.findUnique({ where: { variantId } });
    if (saleType === 'carton') {
      if (vInv.remainingCartons < quantity) throw new Error('Not enough cartons in stock');
      const piecesSold = quantity * piecesPerCarton;
      await prisma.variantInventory.update({
        where: { variantId },
        data: { remainingCartons: vInv.remainingCartons - quantity, remainingPieces: vInv.remainingPieces - piecesSold }
      });
      return piecesSold;
    } else {
      if (vInv.remainingPieces < quantity) throw new Error('Not enough pieces in stock');
      await prisma.variantInventory.update({
        where: { variantId },
        data: {
          remainingPieces: vInv.remainingPieces - quantity,
          remainingCartons: Math.floor((vInv.remainingPieces - quantity) / piecesPerCarton)
        }
      });
      return quantity;
    }
  } else {
    const inv = await prisma.inventory.findUnique({ where: { productId } });
    if (saleType === 'carton') {
      if (inv.remainingCartons < quantity) throw new Error('Not enough cartons in stock');
      const piecesSold = quantity * piecesPerCarton;
      await prisma.inventory.update({
        where: { productId },
        data: { remainingCartons: inv.remainingCartons - quantity, remainingPieces: inv.remainingPieces - piecesSold }
      });
      return piecesSold;
    } else {
      if (inv.remainingPieces < quantity) throw new Error('Not enough pieces in stock');
      await prisma.inventory.update({
        where: { productId },
        data: {
          remainingPieces: inv.remainingPieces - quantity,
          remainingCartons: Math.floor((inv.remainingPieces - quantity) / piecesPerCarton)
        }
      });
      return quantity;
    }
  }
}

app.get('/api/sales', async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    let where = {};
    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.saleDate.lte = new Date(`${endDate}T23:59:59.999Z`);
    }
    if (userId) where.userId = parseInt(userId);
    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: { include: { product: true, variant: true } },
        user: { select: { name: true, id: true } }
      },
      orderBy: { saleDate: 'desc' }
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sales', async (req, res) => {
  try {
    const { productId, variantId, userId, quantity, saleType, paymentMode, notes, unitPrice, lineTotal, pricingMethod } = req.body;
    const product = await prisma.product.findUnique({ where: { id: parseInt(productId) } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const pricing = calculateSalePricing({ quantity, saleType, piecesPerCarton: product.piecesPerCarton, unitPrice, lineTotal, pricingMethod });
    const vId = variantId ? parseInt(variantId) : null;
    if (vId) {
      const variant = await prisma.variant.findUnique({ where: { id: vId } });
      if (!variant) return res.status(404).json({ error: 'Variant not found' });
    }
    const piecesSold = await deductInventory(parseInt(productId), vId, saleType, quantity, product.piecesPerCarton);
    const totalAmount = pricing.totalPrice;

    const variantLabel = vId ? (await prisma.variant.findUnique({ where: { id: vId } }))?.name : null;

    const sale = await prisma.sale.create({
      data: {
        userId: parseInt(userId), paymentMode, saleCategory: 'retail',
        totalAmount, totalQuantity: piecesSold, notes,
        items: {
          create: [{
            productId: parseInt(productId), variantId: vId,
            productName: product.name + (variantLabel ? ` - ${variantLabel}` : ''),
            quantity, saleType, pricingMethod: pricing.pricingMethod, listPrice: product.price,
            unitPrice: pricing.unitPrice, totalPrice: totalAmount
          }]
        }
      },
      include: {
        items: { include: { product: true, variant: true } },
        user: { select: { name: true } }
      }
    });
    res.status(201).json(sale);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { inventory: true, variants: { include: { inventory: true } } }
    });
    const totalProducts = products.length;
    const totalInventoryValue = products.reduce((sum, p) => {
      if (p.hasVariants) {
        return sum + p.variants.reduce((vSum, v) => vSum + (v.inventory?.remainingPieces || 0) * p.price, 0);
      }
      return sum + (p.inventory?.remainingPieces || 0) * p.price;
    }, 0);

    const lowStockProducts = [];
    for (const p of products) {
      if (p.hasVariants) {
        for (const v of p.variants) {
          const remaining = v.inventory?.remainingPieces || 0;
          if (remaining <= p.lowStockThreshold) {
            lowStockProducts.push({ ...p, variantName: v.name, remainingPieces: remaining });
          }
        }
      } else {
        const remaining = p.inventory?.remainingPieces || 0;
        if (remaining <= p.lowStockThreshold) {
          lowStockProducts.push({ ...p, variantName: null, remainingPieces: remaining });
        }
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySales = await prisma.sale.findMany({
      where: { saleDate: { gte: today } },
      include: { items: { include: { product: true, variant: true } }, user: { select: { name: true } } }
    });
    const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const todayPiecesSold = todaySales.reduce((sum, sale) => sum + sale.totalQuantity, 0);
    const totalSales = await prisma.sale.aggregate({ _sum: { totalAmount: true, totalQuantity: true } });
    const paymentBreakdown = await prisma.sale.groupBy({
      by: ['paymentMode'], _sum: { totalAmount: true }, _count: true
    });
    const dailyByRep = await prisma.sale.groupBy({
      by: ['userId'], where: { saleDate: { gte: today } },
      _sum: { totalAmount: true, totalQuantity: true }, _count: true
    });
    const reps = await prisma.user.findMany({
      where: { id: { in: dailyByRep.map(r => r.userId) } }, select: { id: true, name: true }
    });
    const dailyRepStats = dailyByRep.map(stat => ({
      ...stat, repName: reps.find(r => r.id === stat.userId)?.name || 'Unknown'
    }));
    res.json({
      totalProducts, totalInventoryValue, lowStockProducts,
      todayStats: { revenue: todayRevenue, piecesSold: todayPiecesSold, transactions: todaySales.length },
      totalStats: { revenue: totalSales._sum.totalAmount || 0, piecesSold: totalSales._sum.totalQuantity || 0 },
      paymentBreakdown, dailyRepStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/monthly', async (req, res) => {
  try {
    const { month, year, userId } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    let where = { saleDate: { gte: startDate, lte: endDate } };
    if (userId) where.userId = parseInt(userId);
    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: { include: { product: true, variant: true } },
        user: { select: { name: true, id: true } }
      },
      orderBy: { saleDate: 'asc' }
    });
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalQuantity = sales.reduce((sum, sale) => sum + sale.totalQuantity, 0);
    const paymentBreakdown = await prisma.sale.groupBy({
      by: ['paymentMode'], where, _sum: { totalAmount: true }, _count: true
    });
    const repBreakdown = await prisma.sale.groupBy({
      by: ['userId'], where, _sum: { totalAmount: true, totalQuantity: true }, _count: true
    });
    const reps = await prisma.user.findMany({
      where: { id: { in: repBreakdown.map(r => r.userId) } }, select: { id: true, name: true }
    });
    const repStats = repBreakdown.map(stat => ({
      ...stat, repName: reps.find(r => r.id === stat.userId)?.name || 'Unknown'
    }));
    res.json({
      period: { month: parseInt(month), year: parseInt(year) }, sales,
      summary: { totalRevenue, totalQuantity, totalTransactions: sales.length },
      paymentBreakdown, repStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/customers', async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        sales: {
          include: { items: { include: { product: true, variant: true } } },
          orderBy: { saleDate: 'desc' }
        }
      },
      orderBy: { name: 'asc' }
    });
    const customersWithStats = customers.map(customer => ({
      ...customer,
      totalPurchases: customer.sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
      totalItems: customer.sales.reduce((sum, sale) => sum + sale.totalQuantity, 0),
      purchaseCount: customer.sales.length
    }));
    res.json(customersWithStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const customer = await prisma.customer.create({ data: { name, phone, address } });
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address } = req.body;
    const customer = await prisma.customer.update({ where: { id: parseInt(id) }, data: { name, phone, address } });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.customer.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Customer deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/wholesale-sales', async (req, res) => {
  try {
    const { customerId, startDate, endDate } = req.query;
    let where = { saleCategory: 'wholesale' };
    if (customerId) where.customerId = parseInt(customerId);
    if (startDate && endDate) {
      where.saleDate = { gte: new Date(startDate), lte: new Date(endDate + 'T23:59:59.999Z') };
    }
    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: { include: { product: true, variant: true } },
        user: { select: { name: true } },
        customer: true
      },
      orderBy: { saleDate: 'desc' }
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/wholesale-sales', async (req, res) => {
  try {
    const { userId, customerId, paymentMode, notes, items } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items in the sale' });
    }
    let totalAmount = 0;
    let totalQuantity = 0;
    const saleItems = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) return res.status(400).json({ error: `Product not found: ${item.productId}` });
      const pricing = calculateSalePricing({ ...item, piecesPerCarton: product.piecesPerCarton });
      const vId = item.variantId || null;
      if (vId) {
        const variant = await prisma.variant.findUnique({ where: { id: vId } });
        if (!variant) return res.status(400).json({ error: `Variant not found: ${vId}` });
      }
      const piecesSold = await deductInventory(item.productId, vId, item.saleType, item.quantity, product.piecesPerCarton);
      const itemTotal = pricing.totalPrice;
      totalAmount += itemTotal;
      totalQuantity += piecesSold;
      const effectivePerPiece = piecesSold > 0 ? itemTotal / piecesSold : 0;
      const priceAdjusted = Math.abs(effectivePerPiece - product.price) > 0.01;
      const variantLabel = vId ? (await prisma.variant.findUnique({ where: { id: vId } }))?.name : null;
      saleItems.push({
        productId: item.productId, variantId: vId,
        productName: product.name + (variantLabel ? ` - ${variantLabel}` : ''),
        quantity: item.quantity, saleType: item.saleType, pricingMethod: pricing.pricingMethod,
        listPrice: product.price, unitPrice: pricing.unitPrice, totalPrice: itemTotal, priceAdjusted
      });
    }

    const sale = await prisma.sale.create({
      data: {
        userId: parseInt(userId), customerId: customerId ? parseInt(customerId) : null,
        paymentMode, saleCategory: 'wholesale', totalAmount, totalQuantity, notes,
        items: { create: saleItems }
      },
      include: {
        items: { include: { product: true, variant: true } },
        user: { select: { name: true } },
        customer: true
      }
    });
    res.status(201).json(sale);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/customers/:id/purchases', async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({ where: { id: parseInt(id) } });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const sales = await prisma.sale.findMany({
      where: { customerId: parseInt(id) },
      include: {
        items: { include: { product: true, variant: true } },
        user: { select: { name: true } }
      },
      orderBy: { saleDate: 'desc' }
    });
    const totalSpent = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalItems = sales.reduce((sum, sale) => sum + sale.totalQuantity, 0);
    res.json({ customer, purchases: sales, summary: { totalSpent, totalItems, totalTransactions: sales.length } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/template', (req, res) => {
  const csvContent = 'name,price,piecesPerCarton,colorCode,lowStockThreshold,totalCartons,totalPieces,hasVariants,variantName,variantCartons,variantPieces\n' +
    'Lush Wow Braid,500,25,,5,10\n' +
    'Ankara Fabric,1500,20,RED,3,5\n' +
    'Lush Jumbo,800,30,,5,,,true,Color 33,1,\n' +
    'Lush Jumbo,800,30,,5,,,true,Color 25,,15\n' +
    'Mega growth relax,1200,12,,,5\n' +
    'Karen Paris,1800,48,,,10';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=products_template.csv');
  res.send(csvContent);
});

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

app.get('/api/products/export', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { inventory: true, variants: { include: { inventory: true } } },
      orderBy: { id: 'asc' }
    });
    const headers = ['name', 'price', 'piecesPerCarton', 'colorCode', 'lowStockThreshold', 'totalCartons', 'totalPieces', 'hasVariants', 'variantName', 'variantCartons', 'variantPieces'];
    const rows = products.flatMap((product) => {
      if (product.hasVariants) {
        return product.variants.map((variant) => [
          product.name, product.price, product.piecesPerCarton, variant.colorCode || product.colorCode,
          product.lowStockThreshold, '', '', 'true', variant.name,
          variant.inventory?.totalCartons ?? 0, variant.inventory?.totalPieces ?? 0
        ]);
      }
      return [[
        product.name, product.price, product.piecesPerCarton, product.colorCode, product.lowStockThreshold,
        product.inventory?.totalCartons ?? 0, product.inventory?.totalPieces ?? 0, 'false', '', '', ''
      ]];
    });
    const csvContent = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=current_products.csv');
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products/bulk', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const results = [];
    const errors = [];
    let rowNumber = 1;

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (row) => {
        rowNumber++;
        try {
          if (!row.name || !row.price || !row.piecesPerCarton) {
            errors.push(`Row ${rowNumber}: Missing required fields`);
            return;
          }
          const price = parseFloat(row.price);
          const piecesPerCarton = parseInt(row.piecesPerCarton);
          const lowStockThreshold = row.lowStockThreshold ? parseInt(row.lowStockThreshold) : 5;
          const totalCartons = row.totalCartons ? parseInt(row.totalCartons) : 0;
          const totalPiecesOverride = row.totalPieces === '' || row.totalPieces == null ? null : parseInt(row.totalPieces);
          const hasVariants = row.hasVariants?.toString().trim().toLowerCase() === 'true';
          const variantName = row.variantName?.trim() || null;
          const variantCartons = row.variantCartons ? parseInt(row.variantCartons) : 0;
          // `totalPieces` is also accepted for variant rows so older files can
          // add loose pieces without needing a new column name.
          const variantPieces = row.variantPieces === '' || row.variantPieces == null
            ? (hasVariants ? totalPiecesOverride : null)
            : parseInt(row.variantPieces);

          if (isNaN(price) || price <= 0) { errors.push(`Row ${rowNumber}: Invalid price`); return; }
          if (isNaN(piecesPerCarton) || piecesPerCarton <= 0) { errors.push(`Row ${rowNumber}: Invalid piecesPerCarton`); return; }

          results.push({
            name: row.name.trim(), price, piecesPerCarton,
            colorCode: row.colorCode?.trim() || null,
            lowStockThreshold, totalCartons, totalPiecesOverride, hasVariants, variantName, variantCartons, variantPieces
          });
        } catch (err) {
          errors.push(`Row ${rowNumber}: ${err.message}`);
        }
      })
      .on('end', async () => {
        try {
          const productMap = new Map();
          for (const r of results) {
            if (!productMap.has(r.name)) {
              productMap.set(r.name, { ...r, variants: [] });
            }
            const entry = productMap.get(r.name);
            if (r.hasVariants && r.variantName) {
              entry.variants.push({ name: r.variantName, colorCode: r.colorCode, totalCartons: r.variantCartons, totalPieces: r.variantPieces });
              entry.hasVariants = true;
            } else if (r.totalCartons > 0) {
              entry.totalCartons = r.totalCartons;
            }
          }

          const createdProducts = [];
          const errors = [];
          for (const [name, data] of productMap) {
            try {
              const hasVariants = data.hasVariants && data.variants.length > 0;
              console.log(`[BULK] Creating "${name}": hasVariants=${hasVariants}, variants=${data.variants.length}`);
              const product = await prisma.$transaction(async (tx) => {
                const created = await tx.product.create({
                  data: {
                    name: data.name, price: data.price, piecesPerCarton: data.piecesPerCarton,
                    colorCode: data.colorCode, lowStockThreshold: data.lowStockThreshold,
                    hasVariants
                  }
                });
                if (hasVariants) {
                  for (const v of data.variants) {
                    const stock = stockFromInput(v, data.piecesPerCarton);
                    const variant = await tx.variant.create({
                      data: { productId: created.id, name: v.name, colorCode: v.colorCode || null }
                    });
                    await tx.variantInventory.create({
                      data: { variantId: variant.id, totalCartons: stock.totalCartons, remainingCartons: stock.totalCartons, totalPieces: stock.totalPieces, remainingPieces: stock.totalPieces }
                    });
                  }
                } else {
                  const stock = stockFromInput({ totalCartons: data.totalCartons, totalPieces: data.totalPiecesOverride }, data.piecesPerCarton);
                  await tx.inventory.create({
                    data: { productId: created.id, totalCartons: stock.totalCartons, remainingCartons: stock.totalCartons, totalPieces: stock.totalPieces, remainingPieces: stock.totalPieces }
                  });
                }
                return created;
              });
              createdProducts.push(product);
            } catch (err) {
              console.error(`[BULK] Error creating "${name}":`, err.message);
              errors.push(`Product "${name}": ${err.message}`);
            }
          }
          fs.unlinkSync(req.file.path);
          res.status(201).json({
            message: `${createdProducts.length} products uploaded successfully`,
            products: createdProducts,
            errors: errors.length > 0 ? errors : undefined
          });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      })
      .on('error', (err) => {
        res.status(500).json({ error: err.message });
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production' || fs.existsSync(path.join(__dirname, 'client', 'dist'))) {
  app.use(express.static(path.join(__dirname, 'client', 'dist')));
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 3002;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
    await createDefaultManager();
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
});
