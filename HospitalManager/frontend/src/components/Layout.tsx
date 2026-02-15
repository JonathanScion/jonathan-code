import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItemButton,
  ListItemIcon, ListItemText, Collapse, IconButton, Divider,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  LocalHospital as HospitalIcon,
  MeetingRoom as RoomIcon,
  EventNote as AppointmentIcon,
  Hotel as AdmissionIcon,
  Science as LabIcon,
  MedicalServices as MedIcon,
  Receipt as BillIcon,
  LocalPharmacy as PharmacyIcon,
  Business as DeptIcon,
  Inventory as InventoryIcon,
  HealthAndSafety as InsuranceIcon,
  LocalShipping as SupplierIcon,
  Groups as StaffIcon,
  ExpandLess, ExpandMore,
  Menu as MenuIcon,
} from '@mui/icons-material';

const DRAWER_WIDTH = 260;

interface NavGroup {
  label: string;
  items: { label: string; path: string; icon: React.ReactNode }[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
    ],
  },
  {
    label: 'Patients',
    items: [
      { label: 'Patients', path: '/patients', icon: <PeopleIcon /> },
      { label: 'Appointments', path: '/appointments', icon: <AppointmentIcon /> },
      { label: 'Admissions', path: '/admissions', icon: <AdmissionIcon /> },
    ],
  },
  {
    label: 'Clinical',
    items: [
      { label: 'Doctors', path: '/doctors', icon: <HospitalIcon /> },
      { label: 'Visits', path: '/visits', icon: <MedIcon /> },
      { label: 'Lab Orders', path: '/lab-orders', icon: <LabIcon /> },
    ],
  },
  {
    label: 'Facility',
    items: [
      { label: 'Departments', path: '/departments', icon: <DeptIcon /> },
      { label: 'Rooms', path: '/rooms', icon: <RoomIcon /> },
      { label: 'Staff', path: '/staff', icon: <StaffIcon /> },
    ],
  },
  {
    label: 'Pharmacy',
    items: [
      { label: 'Medications', path: '/medications', icon: <PharmacyIcon /> },
      { label: 'Inventory', path: '/inventory', icon: <InventoryIcon /> },
      { label: 'Suppliers', path: '/suppliers', icon: <SupplierIcon /> },
    ],
  },
  {
    label: 'Billing',
    items: [
      { label: 'Bills', path: '/bills', icon: <BillIcon /> },
      { label: 'Insurance Plans', path: '/insurance-plans', icon: <InsuranceIcon /> },
    ],
  },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(navGroups.map(g => [g.label, true]))
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleGroup = (label: string) =>
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));

  const drawer = (
    <Box>
      <Toolbar sx={{ px: 2 }}>
        <HospitalIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" noWrap sx={{ fontWeight: 700, color: 'primary.main' }}>
          Hospital Mgr
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1 }}>
        {navGroups.map((group) => (
          <Box key={group.label}>
            <ListItemButton onClick={() => toggleGroup(group.label)} sx={{ borderRadius: 1, py: 0.5 }}>
              <ListItemText
                primary={group.label}
                primaryTypographyProps={{ variant: 'caption', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}
              />
              {openGroups[group.label] ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </ListItemButton>
            <Collapse in={openGroups[group.label]}>
              <List disablePadding>
                {group.items.map((item) => (
                  <ListItemButton
                    key={item.path}
                    onClick={() => { navigate(item.path); setMobileOpen(false); }}
                    selected={location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))}
                    sx={{ pl: 3, borderRadius: 1, py: 0.5, mb: 0.25 }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.875rem' }} />
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
          </Box>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, ml: { md: `${DRAWER_WIDTH}px` }, bgcolor: 'white', color: 'text.primary', boxShadow: 1 }}>
        <Toolbar>
          <IconButton edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 2, display: { md: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ fontWeight: 500 }}>
            Hospital Management System
          </Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, mt: 8, minHeight: '100vh', bgcolor: 'background.default' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
