import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import UserVerifyPortal from "./user/UserVerifyPortal";
import CertificateDetailPage from "./user/CertificateDetailPage";
import AdminDashboardLayout from "./admin/AdminDashboardLayout";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Trang 4: Cổng xác minh chứng chỉ công khai */}
        <Route path="/" element={<UserVerifyPortal />} />

        {/* Trang 5: Chi tiết chứng chỉ & QR Code xác minh */}
        <Route path="/certificate/:code" element={<CertificateDetailPage />} />

        {/* Trang 1, 2, 3: Khu vực Quản trị (Dashboard, Quản lý, Cấp chứng chỉ) */}
        <Route path="/admin" element={<AdminDashboardLayout />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}