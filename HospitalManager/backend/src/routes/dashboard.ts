import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// Dashboard summary
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      patientCount,
      todayAppointments,
      occupiedBeds,
      totalBeds,
      pendingLabOrders,
      outstandingBillsCount,
      outstandingBillsTotal,
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.appointment.count({
        where: {
          dateTime: { gte: todayStart, lte: todayEnd },
          status: { notIn: ['CANCELLED'] },
        },
      }),
      prisma.bed.count({ where: { status: 'OCCUPIED' } }),
      prisma.bed.count(),
      prisma.labOrder.count({ where: { status: { in: ['ORDERED', 'IN_PROGRESS'] } } }),
      prisma.bill.count({ where: { status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } } }),
      prisma.bill.aggregate({
        where: { status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
        _sum: { totalAmount: true },
      }),
    ]);

    res.json({
      patientCount,
      todayAppointments,
      bedOccupancy: {
        occupied: occupiedBeds,
        total: totalBeds,
      },
      pendingLabOrders,
      outstandingBills: {
        count: outstandingBillsCount,
        total: outstandingBillsTotal._sum.totalAmount || 0,
      },
    });
  } catch (err) { next(err); }
});

export default router;
