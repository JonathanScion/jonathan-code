import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const staffSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional().nullable(),
  role: z.enum(['NURSE', 'TECHNICIAN', 'RECEPTIONIST', 'ADMIN', 'JANITOR']),
  departmentId: z.number().int(),
  hireDate: z.coerce.date().optional(),
  salary: z.number().min(0),
});

// List — optional ?departmentId=X filter
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const search = req.query.search as string | undefined;
    const departmentId = req.query.departmentId ? parseInt(req.query.departmentId as string) : undefined;
    const where: any = {};
    if (departmentId) where.departmentId = departmentId;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    const [data, total] = await Promise.all([
      prisma.staff.findMany({
        where,
        skip,
        take,
        orderBy: { lastName: 'asc' },
        include: { department: true },
      }),
      prisma.staff.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

// Get by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const member = await prisma.staff.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { department: true },
    });
    if (!member) throw new AppError('Staff member not found', 404);
    res.json(member);
  } catch (err) { next(err); }
});

// Create
router.post('/', validate(staffSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const member = await prisma.staff.create({ data: req.body });
    res.status(201).json(member);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', validate(staffSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const member = await prisma.staff.update({ where: { id: parseInt(req.params.id) }, data: req.body });
    res.json(member);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.staff.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
