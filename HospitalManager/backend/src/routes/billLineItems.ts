import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const billLineItemSchema = z.object({
  billId: z.number().int().positive(),
  description: z.string().min(1).max(500),
  category: z.enum(['CONSULTATION', 'PROCEDURE', 'MEDICATION', 'LAB', 'ROOM', 'OTHER']),
  quantity: z.number().int().positive(),
  unitPrice: z.number().min(0),
});

async function recalculateBillTotal(billId: number) {
  const aggregate = await prisma.billLineItem.aggregate({
    where: { billId },
    _sum: { total: true },
  });
  await prisma.bill.update({
    where: { id: billId },
    data: { totalAmount: aggregate._sum.total || 0 },
  });
}

// List
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const where: any = {};
    if (req.query.billId) where.billId = parseInt(req.query.billId as string);
    const [data, total] = await Promise.all([
      prisma.billLineItem.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.billLineItem.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

// Get by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.billLineItem.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { bill: true },
    });
    if (!item) throw new AppError('Bill line item not found', 404);
    res.json(item);
  } catch (err) { next(err); }
});

// Create
router.post('/', validate(billLineItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const total = req.body.quantity * req.body.unitPrice;
    const item = await prisma.billLineItem.create({
      data: { ...req.body, total },
    });
    await recalculateBillTotal(item.billId);
    res.status(201).json(item);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', validate(billLineItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const total = req.body.quantity * req.body.unitPrice;
    const item = await prisma.billLineItem.update({
      where: { id: parseInt(req.params.id) },
      data: { ...req.body, total },
    });
    await recalculateBillTotal(item.billId);
    res.json(item);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.billLineItem.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!item) throw new AppError('Bill line item not found', 404);
    await prisma.billLineItem.delete({ where: { id: parseInt(req.params.id) } });
    await recalculateBillTotal(item.billId);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
