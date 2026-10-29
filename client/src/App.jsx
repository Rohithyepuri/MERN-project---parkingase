import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import ConsoleLayout from './components/ConsoleLayout';
import { NotFound, Protected, ScrollToTop, Unauthorized } from './components/Protected';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import FindParking from './pages/FindParking';
import FacilityDetail from './pages/FacilityDetail';
import Dashboard from './pages/Dashboard';
import Bookings from './pages/Bookings';
import BookingDetail from './pages/BookingDetail';
import Vehicles from './pages/Vehicles';
import Payments from './pages/Payments';
import Favorites from './pages/Favorites';
import Profile from './pages/Profile';
import StaffConsole from './pages/StaffConsole';

import AdminOverview from './admin/Overview';
import AdminFacilities from './admin/Facilities';
import FacilityEditor from './admin/FacilityEditor';
import AdminBookings from './admin/Bookings';
import AdminUsers from './admin/Users';
import AdminPayments from './admin/Payments';
import AdminReports from './admin/Reports';
import AdminAuditLogs from './admin/AuditLogs';
import Moderation from './admin/Moderation';
import AdminSettings from './admin/Settings';

function DocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const rules = [
      ['/admin/reports', 'Reports'],
      ['/admin/audit', 'Audit logs'],
      ['/admin/facilities', 'Facilities'],
      ['/admin/bookings', 'Bookings'],
      ['/admin/users', 'Users & staff'],
      ['/admin/payments', 'Payments'],
      ['/admin/moderation', 'Moderation'],
      ['/admin/settings', 'Settings'],
      ['/admin', 'Admin console'],
      ['/staff', 'Staff console'],
      ['/facilities/', 'Facility'],
      ['/facilities', 'Find parking'],
      ['/dashboard', 'Dashboard'],
      ['/bookings/', 'Booking details'],
      ['/bookings', 'My bookings'],
      ['/vehicles', 'My vehicles'],
      ['/payments', 'Payments'],
      ['/favorites', 'Saved facilities'],
      ['/profile', 'Profile'],
      ['/login', 'Sign in'],
      ['/register', 'Create account'],
      ['/forgot-password', 'Reset password'],
      ['/reset-password', 'Reset password'],
    ];
    const match = rules.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix));
    document.title = match ? `${match[1]} · ParkEase` : 'ParkEase — Find your space. Book with confidence.';
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <DocumentTitle />
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Landing />} />
          <Route path="facilities" element={<FindParking />} />
          <Route path="facilities/:id" element={<FacilityDetail />} />

          <Route
            path="dashboard"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="bookings"
            element={
              <Protected>
                <Bookings />
              </Protected>
            }
          />
          <Route
            path="bookings/:id"
            element={
              <Protected>
                <BookingDetail />
              </Protected>
            }
          />
          <Route
            path="vehicles"
            element={
              <Protected>
                <Vehicles />
              </Protected>
            }
          />
          <Route
            path="payments"
            element={
              <Protected>
                <Payments />
              </Protected>
            }
          />
          <Route
            path="favorites"
            element={
              <Protected>
                <Favorites />
              </Protected>
            }
          />
          <Route
            path="profile"
            element={
              <Protected>
                <Profile />
              </Protected>
            }
          />
          <Route path="unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/staff"
          element={
            <Protected roles={['staff', 'admin']}>
              <StaffConsole />
            </Protected>
          }
        />

        <Route
          path="/admin"
          element={
            <Protected roles={['admin']}>
              <ConsoleLayout workspace="Admin console" />
            </Protected>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="facilities" element={<AdminFacilities />} />
          <Route path="facilities/:id" element={<FacilityEditor />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="audit" element={<AdminAuditLogs />} />
          <Route path="moderation" element={<Moderation />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </>
  );
}
