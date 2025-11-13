import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './ui/Card';

interface StatisticsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  delay?: number;
}

export function StatisticsCard({ title, value, icon: Icon, trend, delay = 0 }: StatisticsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card hover className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 opacity-5">
          <Icon className="w-full h-full" />
        </div>

        <CardContent className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-dark-light">{title}</span>
            <div className="p-2 bg-primary-50 rounded-eoi">
              <Icon className="w-5 h-5 text-primary" />
            </div>
          </div>

          <div className="text-3xl font-bold text-dark mb-1">{value}</div>

          {trend && (
            <div className={`text-sm ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              <span className="text-dark-light ml-1">vs last month</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
