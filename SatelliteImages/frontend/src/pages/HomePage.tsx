import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Upload, FolderOpen, Globe2, BarChart3, Zap, Shield, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { InteractiveGlobe } from '@/components/InteractiveGlobe';

export function HomePage() {
  const features = [
    {
      icon: Globe2,
      title: '3D Globe Visualization',
      description: 'View your satellite imagery on an interactive 3D globe with precise geolocation.',
    },
    {
      icon: Cloud,
      title: 'Cloud Storage',
      description: 'Secure storage on AWS S3 with automatic metadata extraction and indexing.',
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'Track coverage, usage statistics, and generate insights from your imagery.',
    },
    {
      icon: Zap,
      title: 'Fast Search',
      description: 'Find images quickly with powerful filters and full-text search capabilities.',
    },
    {
      icon: Shield,
      title: 'Secure & Scalable',
      description: 'Built on AWS serverless architecture for enterprise-grade reliability.',
    },
    {
      icon: FolderOpen,
      title: 'Collections',
      description: 'Organize related images into collections and share them with collaborators.',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-500 to-primary-700 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-6 text-white">
              Satellite Imagery Management
            </h1>
            <p className="text-xl md:text-2xl text-primary-100 mb-8 max-w-3xl mx-auto">
              Upload, catalog, and analyze satellite imagery with powerful geospatial tools.
              Built for professionals, designed for everyone.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/upload">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Images
                </Button>
              </Link>
              <Link to="/gallery">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-white text-white hover:bg-white hover:text-primary">
                  <FolderOpen className="w-5 h-5 mr-2" />
                  Browse Gallery
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Interactive 3D Globe */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-16"
          >
            <div className="mx-auto" style={{ maxWidth: '800px', height: '600px' }}>
              <InteractiveGlobe />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-dark mb-4">
              Powerful Features
            </h2>
            <p className="text-xl text-dark-light max-w-2xl mx-auto">
              Everything you need to manage and analyze satellite imagery at scale
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card hover className="h-full">
                  <CardHeader>
                    <div className="p-3 bg-primary-50 rounded-eoi w-fit mb-4">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-dark-light">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-dark mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-dark-light mb-8">
              Upload your first satellite image and experience the power of our platform
            </p>
            <Link to="/upload">
              <Button size="lg">
                <Upload className="w-5 h-5 mr-2" />
                Start Uploading
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
