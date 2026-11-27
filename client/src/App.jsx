import { Navigate, Route, Routes } from 'react-router-dom';
import { LayoutDashboard, UtensilsCrossed, ReceiptText, Users, UserCog, Settings as SettingsIcon, Building2, ScrollText, Gauge } from 'lucide-react';
import { useAuth, homeFor } from './lib/auth.jsx';
import AppShell from './components/AppShell.jsx';
import Login from './pages/Login.jsx';
import POS from './pages/pos/POS.jsx';
import Kitchen from './pages/Kitchen.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import Products from './pages/admin/Products.jsx';
import Orders from './pages/admin/Orders.jsx';
import Customers from './pages/admin/Customers.jsx';
import Staff from './pages/admin/Staff.jsx';
import Settings from './pages/admin/Settings.jsx';
import Overview from './pages/super/Overview.jsx';
import Tenants from './pages/super/Tenants.jsx';
import Audit from './pages/super/Audit.jsx';

const ADMIN_NAV = [
  { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/orders', label: 'Orders', icon: ReceiptText },
  { to: '/admin/products', label: 'Menu & stock', icon: UtensilsCrossed },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { section: 'Manage' },
  { to: '/admin/staff', label: 'Team', icon: UserCog },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
];
const SUPER_NAV = [
  { to: '/super', end: true, label: 'Overview', icon: Gauge },
  { to: '/super/tenants', label: 'Businesses', icon: Building2 },
  { to: '/super/audit', label: 'Audit log', icon: ScrollText },
];

function Guard({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homeFor(user.role)} replace /> : <Login />} />
      <Route path="/pos" element={<Guard roles={['owner', 'manager', 'cashier']}><POS /></Guard>} />
      <Route path="/kitchen" element={<Guard roles={['owner', 'manager', 'cashier', 'kitchen']}><Kitchen /></Guard>} />
      <Route path="/admin" element={<Guard roles={['owner', 'manager']}><AppShell items={ADMIN_NAV} area="admin" /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="products" element={<Products />} />
        <Route path="customers" element={<Customers />} />
        <Route path="staff" element={<Staff />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="/super" element={<Guard roles={['superadmin']}><AppShell items={SUPER_NAV} area="super" /></Guard>}>
        <Route index element={<Overview />} />
        <Route path="tenants" element={<Tenants />} />
        <Route path="audit" element={<Audit />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? homeFor(user.role) : '/login'} replace />} />
    </Routes>
  );
}
