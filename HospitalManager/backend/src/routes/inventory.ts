import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const inventorySchema = z.object({
  supplierId: z.number().int(),
  medicationId: z.number().int().optional().nullable(),
  name: z.string().min(1).max(200),
  quantity: z.number().int().min(0).optional(),
  unit: z.enum(['PIECES', 'BOTTLES', 'BOXES', 'VIALS']),
  reorderLevel: z.number().int().min(0).optional(),
  unitCost: z.number().min(0),
  expiryDate: z.coerce.date().optional().nullable(),
});

// List — optional ?supplierId=X filter
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const search = req.query.search as string | undefined;
    const supplierId = req.query.supplierId ? parseInt(req.query.supplierId as string) : undefined;
    const where: any = {};
    if (supplierId) where.supplierId = supplierId;
    if (search) where.name = { contains: search, mode: 'insensitive' as const };
    const [data, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: { supplier: true, medication: true },
      }),
      prisma.inventoryItem.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

// Get by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { supplier: true, medication: true },
    });
    if (!item) throw new AppError('Inventory item not found', 404);
    res.json(item);
  } catch (err) { next(err); }
});

// Create
router.post('/', validate(inventorySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.inventoryItem.create({ data: req.body });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', validate(inventorySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.inventoryItem.update({ where: { id: parseInt(req.params.id) }, data: req.body });
    res.json(item);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.inventoryItem.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
