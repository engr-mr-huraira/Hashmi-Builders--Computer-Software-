import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import ModulePage from './pages/ModulePage.jsx'
import Settings from './pages/Settings.jsx'
import { useAuthStore } from './store/authStore.js'

const modules = [
  { path: 'colonies', title: 'Colony Management', endpoint: '/colonies', description: 'Manage colonies, blocks, sectors, maps, and project inventory.' },
  { path: 'plots', title: 'Plot Management', endpoint: '/plots', description: 'Track plot numbers, sizes, prices, tags, status, booking, and ownership.' },
  { path: 'customers', title: 'Customer Management', endpoint: '/customers', description: 'Maintain customer profiles, CNIC, contacts, documents, and transaction history.' },
  { path: 'sales', title: 'Sale Management', endpoint: '/sales', description: 'Create bookings, allotments, installment plans, transfers, and cancellations.' },
  { path: 'payments', title: 'Payment Management', endpoint: '/payments', description: 'Record installments, receipts, ledgers, partial, advance, and due payments.' },
  { path: 'refunds', title: 'Refund Management', endpoint: '/refunds', description: 'Process refund requests, approvals, deductions, history, and receipts.' },
  { path: 'financial', title: 'Financial Management', endpoint: '/financial/transactions', description: 'Manage income, expenses, accounts, categories, cashflow, and P/L reports.' },
  { path: 'documents', title: 'Document Management', endpoint: '/documents', description: 'Upload, preview, download, and export agreements, NOCs, registry files, and IDs.' },
  { path: 'reports', title: 'Reporting System', endpoint: '/reports/sales', description: 'Generate sales, payment, defaulter, financial, and customer reports.' },
  { path: 'notifications', title: 'Notification System', endpoint: '/notifications', description: 'Track reminders, due alerts, booking updates, and internal admin notifications.' },
  { path: 'users', title: 'User & Role Management', endpoint: '/users', description: 'Manage users, roles, custom permissions, and secure access control.' },
]

function PrivateRoute({ children }) {
  const token = useAuthStore((state) => state.token)
  return token ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const token = useAuthStore((state) => state.token)
  return token ? <Navigate to="/" replace /> : children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        {modules.map((module) => (
          <Route key={module.path} path={module.path} element={<ModulePage {...module} />} />
        ))}
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
