import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Browse from './pages/Browse.jsx';
import ListingDetail from './pages/ListingDetail.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MyListings from './pages/MyListings.jsx';
import ListingForm from './pages/ListingForm.jsx';
import Offers from './pages/Offers.jsx';
import Bookings from './pages/Bookings.jsx';
import BookingDetail from './pages/BookingDetail.jsx';
import OpenJobs from './pages/OpenJobs.jsx';
import Profile from './pages/Profile.jsx';
import Admin from './pages/Admin.jsx';

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="center-note">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/listings" element={<Browse />} />
        <Route path="/listings/:id" element={<ListingDetail />} />

        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />

        <Route path="/my-listings" element={<Protected roles={['farmer']}><MyListings /></Protected>} />
        <Route path="/my-listings/new" element={<Protected roles={['farmer']}><ListingForm /></Protected>} />
        <Route path="/my-listings/:id/edit" element={<Protected roles={['farmer']}><ListingForm /></Protected>} />

        <Route path="/offers" element={<Protected roles={['farmer', 'buyer']}><Offers /></Protected>} />
        <Route path="/bookings" element={<Protected roles={['farmer', 'buyer', 'transporter']}><Bookings /></Protected>} />
        <Route path="/bookings/:id" element={<Protected><BookingDetail /></Protected>} />
        <Route path="/jobs" element={<Protected roles={['transporter']}><OpenJobs /></Protected>} />

        <Route path="/admin" element={<Protected roles={['admin']}><Admin /></Protected>} />
        <Route path="*" element={<div className="center-note">Page not found.</div>} />
      </Routes>
    </Layout>
  );
}
