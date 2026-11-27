import { Navigate, Route, Routes } from 'react-router-dom';
import { LayoutDashboard, UtensilsCrossed, ReceiptText, Users, UserCog, Settings as SettingsIcon, Building2, ScrollText, Gauge, TrendingUp, Boxes, ArrowLeftRight, ClipboardCheck, ShoppingCart, Truck, Landmark, Wallet, BookOpen, QrCode, History } from 'lucide-react';
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
import SalesReport from './pages/sales/SalesReport.jsx';
import InventoryOverview from './pages/inventory/InventoryOverview.jsx';
import StockMoves from './pages/inventory/StockMoves.jsx';
import StockCount from './pages/inventory/StockCount.jsx';
import PurchaseOrders from './pages/purchases/PurchaseOrders.jsx';
import Suppliers from './pages/purchases/Suppliers.jsx';
import AccountingOverview from './pages/accounting/AccountingOverview.jsx';
import Expenses from './pages/accounting/Expenses.jsx';
import Journal from './pages/accounting/Journal.jsx';
import QRMenu from './pages/admin/QRMenu.jsx';
import Activity from './pages/admin/Activity.jsx';
import Menu from './pages/Menu.jsx';

export const ADMIN_NAV = [
  { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { section: 'Sales' },
  { to: '/admin/sales', label: 'Sales report', icon: TrendingUp },
  { to: '/admin/orders', label: 'Orders', icon: ReceiptText },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { section: 'Inventory' },
  { to: '/admin/inventory', end: true, label: 'Stock overview', icon: Boxes },
  { to: '/admin/products', label: 'Products', icon: UtensilsCrossed },
  { to: '/admin/inventory/moves', label: 'Movements', icon: ArrowLeftRight },
  { to: '/admin/inventory/count', label: 'Stock count', icon: ClipboardCheck },
  { section: 'Purchases' },
  { to: '/admin/purchases', label: 'Purchase orders', icon: ShoppingCart },
  { to: '/admin/suppliers', label: 'Suppliers', icon: Truck },
  { section: 'Accounting' },
  { to: '/admin/accounting', end: true, label: 'Profit & VAT', icon: Landmark },
  { to: '/admin/accounting/expenses', label: 'Expenses', icon: Wallet },
  { to: '/admin/accounting/journal', label: 'Journal', icon: BookOpen },
  { section: 'Admin' },
  { to: '/admin/staff', label: 'Team', icon: UserCog },
  { to: '/admin/qr-menu', label: 'QR menu', icon: QrCode },
  { to: '/admin/activity', label: 'Activity log', icon: History },
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
      <Route path="/m/:slug" element={<Menu />} />
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
        <Route path="sales" element={<SalesReport />} />
        <Route path="inventory" element={<InventoryOverview />} />
        <Route path="inventory/moves" element={<StockMoves />} />
        <Route path="inventory/count" element={<StockCount />} />
        <Route path="purchases" element={<PurchaseOrders />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="accounting" element={<AccountingOverview />} />
        <Route path="accounting/expenses" element={<Expenses />} />
        <Route path="accounting/journal" element={<Journal />} />
        <Route path="qr-menu" element={<QRMenu />} />
        <Route path="activity" element={<Activity />} />
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
