import { Link, useLocation } from 'react-router-dom';
import { Satellite, Upload, FolderOpen, BarChart3, GitCompare, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Header() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Home', icon: Satellite },
    { path: '/gallery', label: 'Gallery', icon: FolderOpen },
    { path: '/upload', label: 'Upload', icon: Upload },
    { path: '/scheduling', label: 'Scheduling', icon: Calendar },
    { path: '/collections', label: 'Collections', icon: FolderOpen },
    { path: '/compare', label: 'Compare', icon: GitCompare },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <header className="bg-white shadow-eoi sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <Satellite className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-dark">
              Jonathan Space
            </span>
          </Link>

          <nav className="hidden md:flex space-x-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center space-x-1 px-3 py-2 rounded-eoi text-sm font-medium transition-all duration-eoi',
                    isActive
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-dark-light hover:text-primary hover:bg-gray-50'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Mobile menu button */}
          <button className="md:hidden p-2 rounded-eoi hover:bg-gray-100">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
