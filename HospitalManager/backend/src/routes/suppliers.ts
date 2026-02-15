import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const supplierSchema = z.object({
  name: z.string().min(1).max(200),
  contact: z.string().max(100).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const search = req.query.search as string | undefined;
    const where = search ? { name: { contains: search, mode: 'insensitive' as const } } : {};
    const [data, total] = await Promise.all([
      prisma.supplier.findMany({ where, skip, take, orderBy: { name: 'asc' }, include: { _count: { select: { inventoryItems: true } } } }),
      prisma.supplier.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { id: parseInt(req.params.id) }, include: { inventoryItems: true } });
    if (!supplier) throw new AppError('Supplier not found', 404);
    res.json(supplier);
  } catch (err) { next(err); }
});

router.post('/', validate(supplierSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier = await prisma.supplier.create({ data: req.body });
    res.status(201).json(supplier);
  } catch (err) { next(err); }
});

router.put('/:id', validate(supplierSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier = await prisma.supplier.update({ where: { id: parseInt(req.params.id) }, data: req.body });
    res.json(supplier);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.supplier.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
