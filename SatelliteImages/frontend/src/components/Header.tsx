import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Satellite, Upload, FolderOpen, BarChart3, GitCompare, Calendar, AlertTriangle, Ship, X, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Header() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { path: '/', label: 'Home', icon: Satellite },
    { path: '/gallery', label: 'Gallery', icon: FolderOpen },
    { path: '/upload', label: 'Upload', icon: Upload },
    { path: '/disasters', label: 'Disasters', icon: AlertTriangle },
    { path: '/maritime', label: 'Maritime', icon: Ship },
    { path: '/scheduling', label: 'Scheduling', icon: Calendar },
    { path: '/collections', label: 'Collections', icon: FolderOpen },
    { path: '/compare', label: 'Compare', icon: GitCompare },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <header className="bg-white shadow-eoi sticky top-0 z-50">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <Satellite className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-dark">
              Jonathan Space
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex space-x-1 xl:space-x-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center space-x-1 px-2 xl:px-3 py-2 rounded-eoi text-sm font-medium transition-all duration-eoi whitespace-nowrap',
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

          {/* Mobile/tablet menu button */}
          <button
            className="lg:hidden p-2 rounded-eoi hover:bg-gray-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile/tablet dropdown menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white">
          <nav className="px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center space-x-3 px-4 py-3 rounded-lg text-base font-medium transition-colors',
                    isActive
                      ? 'text-primary bg-primary-50'
                      : 'text-dark-light hover:text-primary hover:bg-gray-50'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
