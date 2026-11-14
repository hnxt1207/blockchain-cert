import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import UserVerifyPortal from "./user/tra-cuu-xac-thuc/UserVerifyPortal";
import CertificateDetailPage from "./user/chi-tiet-van-bang/CertificateDetailPage";
import StudentPortalPage from "./user/cong-sinh-vien/StudentPortalPage";
import AdminDashboardLayout from "./admin/AdminDashboardLayout";
import AuthPage from "./ket-noi-du-lieu/AuthPage";
import { getCurrentUser } from "./ket-noi-du-lieu/apiService";

function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser();
  if (!user || user.Role !== "ADMIN") {
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Trang 4: Cổng xác minh chứng chỉ công khai */}
        <Route path="/" element={<UserVerifyPortal />} />

        {/* Trang 5: Chi tiết chứng chỉ & QR Code xác minh */}
        <Route path="/certificate/:code" element={<CertificateDetailPage />} />

        {/* Cổng Đăng nhập / Đăng ký chung cho Sinh viên & Quản trị viên */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Hồ sơ văn bằng dành riêng cho Sinh viên đã đăng nhập */}
        <Route path="/student" element={<StudentPortalPage />} />

        {/* Trang 1, 2, 3: Khu vực Quản trị (Tự động chuyển sang /auth nếu chưa đăng nhập Admin) */}
        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <AdminDashboardLayout />
            </ProtectedAdminRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}