import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const doctorDepartmentSchema = z.object({
  doctorId: z.number().int().positive(),
  departmentId: z.number().int().positive(),
  isPrimary: z.boolean(),
  startDate: z.string().datetime({ offset: true }).or(z.string().date()),
});

// List
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const where: any = {};
    if (req.query.doctorId) where.doctorId = parseInt(req.query.doctorId as string);
    const [data, total] = await Promise.all([
      prisma.doctorDepartment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { department: true },
      }),
      prisma.doctorDepartment.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

// Get by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await prisma.doctorDepartment.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { department: true, doctor: true },
    });
    if (!record) throw new AppError('Doctor-department link not found', 404);
    res.json(record);
  } catch (err) { next(err); }
});

// Create
router.post('/', validate(doctorDepartmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = {
      ...req.body,
      startDate: new Date(req.body.startDate),
    };
    const record = await prisma.doctorDepartment.create({
      data,
      include: { department: true },
    });
    res.status(201).json(record);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', validate(doctorDepartmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = {
      ...req.body,
      startDate: new Date(req.body.startDate),
    };
    const record = await prisma.doctorDepartment.update({
      where: { id: parseInt(req.params.id) },
      data,
      include: { department: true },
    });
    res.json(record);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.doctorDepartment.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
