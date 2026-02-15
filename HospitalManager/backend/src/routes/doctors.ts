import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const doctorSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional().nullable(),
  licenseNumber: z.string().min(1).max(50),
  specialization: z.string().min(1).max(100),
  yearsExperience: z.number().int().min(0).optional(),
  consultationFee: z.number().min(0).optional(),
});

// List
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const search = req.query.search as string | undefined;
    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { specialization: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [data, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        skip,
        take,
        orderBy: { lastName: 'asc' },
        include: { _count: { select: { appointments: true } } },
      }),
      prisma.doctor.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

// Get by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        departments: { include: { department: true } },
        appointments: true,
      },
    });
    if (!doctor) throw new AppError('Doctor not found', 404);
    res.json(doctor);
  } catch (err) { next(err); }
});

// Create
router.post('/', validate(doctorSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctor = await prisma.doctor.create({ data: req.body });
    res.status(201).json(doctor);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', validate(doctorSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctor = await prisma.doctor.update({ where: { id: parseInt(req.params.id) }, data: req.body });
    res.json(doctor);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.doctor.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
