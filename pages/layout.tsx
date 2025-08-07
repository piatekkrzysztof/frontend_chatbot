import { withAuth } from '@/lib/withAuth';
import AdminLayout from '@/components/layout/AdminLayout';

function DashboardPage() {
  return (
    <AdminLayout>
      <h2 className="text-2xl font-semibold mb-4">Dashboard</h2>
      <p>Witaj w panelu administratora.</p>
    </AdminLayout>
  );
}

export default withAuth(DashboardPage);
