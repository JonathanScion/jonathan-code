import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Image, HardDrive, Globe2, Calendar } from 'lucide-react';
import { analyticsApi } from '@/lib/api';
import { StatisticsCard } from '@/components/StatisticsCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { formatBytes } from '@/lib/utils';

const COLORS = ['#2ea3f2', '#1a8cd8', '#1570b0', '#105488', '#0b3860'];

export function AnalyticsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: analyticsApi.getStatistics,
  });

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const uploadsByMonthData = Object.entries(stats.uploadsByMonth).map(([month, count]) => ({
    month,
    uploads: count,
  }));

  const imagesByTagData = Object.entries(stats.imagesByTag).slice(0, 5).map(([tag, count]) => ({
    name: tag,
    value: count,
  }));

  const imagesBySatelliteData = Object.entries(stats.imagesBySatellite).map(([satellite, count]) => ({
    satellite,
    count,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-dark mb-2">Analytics Dashboard</h1>
          <p className="text-dark-light">Track your satellite imagery usage and coverage</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatisticsCard
            title="Total Images"
            value={stats.totalImages.toLocaleString()}
            icon={Image}
            delay={0}
          />
          <StatisticsCard
            title="Storage Used"
            value={formatBytes(stats.totalStorage)}
            icon={HardDrive}
            delay={0.1}
          />
          <StatisticsCard
            title="Coverage Area"
            value={`${stats.coverageArea.toLocaleString()} km²`}
            icon={Globe2}
            delay={0.2}
          />
          <StatisticsCard
            title="This Month"
            value={Object.values(stats.uploadsByMonth).slice(-1)[0] || 0}
            icon={Calendar}
            delay={0.3}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Uploads by Month */}
          <Card>
            <CardHeader>
              <CardTitle>Uploads by Month</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={uploadsByMonthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="uploads" fill="#2ea3f2" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Images by Tag */}
          <Card>
            <CardHeader>
              <CardTitle>Top Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={imagesByTagData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {imagesByTagData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Images by Satellite */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Images by Satellite</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={imagesBySatelliteData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="satellite" type="category" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2ea3f2" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
