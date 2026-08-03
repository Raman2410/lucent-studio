import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { NotificationProvider } from "@/context/NotificationContext";
import NotificationToasts from "@/components/notifications/NotificationToasts";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ProtectedRoute from "@/components/routing/ProtectedRoute";
import AdminRoute from "@/components/routing/AdminRoute";
import ChatWidget from "@/components/chat/ChatWidget";
import ErrorBoundary from "@/components/ErrorBoundary";
import ScrollToTop from "@/components/ScrollToTop";

import Home from "@/pages/Home";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import VerifyEmail from "@/pages/auth/VerifyEmail";
import Account from "@/pages/Account";
import Portfolio from "@/pages/Portfolio";
import Packages from "@/pages/Packages";
import Cameras from "@/pages/Cameras";
import About from "@/pages/About";
import Availability from "@/pages/Availability";
import Booking from "@/pages/Booking";
import Pay from "@/pages/Pay";
import MyBookings from "@/pages/MyBookings";
import BookingDetail from "@/pages/BookingDetail";
import HelpCenter from "@/pages/HelpCenter";
import QueryDetail from "@/pages/QueryDetail";
import NotFound from "@/pages/NotFound";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminBookings from "@/pages/admin/AdminBookings";
import AdminPhotos from "@/pages/admin/AdminPhotos";
import AdminPackages from "@/pages/admin/AdminPackages";
import AdminCameras from "@/pages/admin/AdminCameras";
import AdminAvailability from "@/pages/admin/AdminAvailability";

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
      <NotificationProvider>
        <ErrorBoundary>
          <ScrollToTop />
          <NotificationToasts />
          <div className="min-h-screen flex flex-col bg-paper selection:bg-signature selection:text-paper">
            <Header />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/packages" element={<Packages />} />
                <Route path="/cameras" element={<Cameras />} />
                <Route path="/about" element={<About />} />
                <Route path="/availability" element={<Availability />} />

                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <Account />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/book/session/:packageId"
                  element={
                    <ProtectedRoute>
                      <Booking type="photography" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/book/rental/:cameraId"
                  element={
                    <ProtectedRoute>
                      <Booking type="rental" />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/pay/:bookingId"
                  element={
                    <ProtectedRoute>
                      <Pay />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/my-bookings"
                  element={
                    <ProtectedRoute>
                      <MyBookings />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/bookings/:id"
                  element={
                    <ProtectedRoute>
                      <BookingDetail />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/help"
                  element={
                    <ProtectedRoute>
                      <HelpCenter />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/help/:id"
                  element={
                    <ProtectedRoute>
                      <QueryDetail />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminLayout />
                    </AdminRoute>
                  }
                >
                  <Route index element={<AdminDashboard />} />
                  <Route path="bookings" element={<AdminBookings />} />
                  <Route path="availability" element={<AdminAvailability />} />
                  <Route path="photos" element={<AdminPhotos />} />
                  <Route path="packages" element={<AdminPackages />} />
                  <Route path="cameras" element={<AdminCameras />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
            <ChatWidget />
          </div>
        </ErrorBoundary>
      </NotificationProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
