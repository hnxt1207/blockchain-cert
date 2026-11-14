import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getCurrentUser, logoutUser } from "../../ket-noi-du-lieu/apiService";

export default function StudentPortalPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.Role !== "STUDENT") {
      navigate("/auth");
      return;
    }

    const fetchMyCerts = async () => {
      try {
        const params = new URLSearchParams({
          studentCode: user.StudentCode || "",
          fullName: user.FullName || "",
        });
        const res = await fetch(`/api/my-certificates?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setCerts(data);
        }
      } catch (err) {
        console.error("Lỗi tải văn bằng sinh viên:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMyCerts();
  }, []);

  const handleLogout = () => {
    logoutUser();
    navigate("/");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Hồ sơ Văn bằng Cá nhân</h1>
          <p className="text-xs text-slate-500">
            Sinh viên: <span className="font-semibold text-slate-700">{user.FullName}</span> • MSSV:{" "}
            <span className="font-mono font-semibold text-indigo-600">{user.StudentCode}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            Cổng tra cứu chung
          </Link>
          <button
            onClick={handleLogout}
            className="px-3.5 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Danh sách văn bằng */}
      <main className="max-w-5xl mx-auto p-6">
        {loading ? (
          <p className="text-center text-slate-500 py-12">Đang tải dữ liệu văn bằng từ hệ thống...</p>
        ) : certs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <p className="text-slate-600 font-medium">
              Chưa tìm thấy văn bằng nào gắn với MSSV <span className="font-bold">{user.StudentCode}</span> hoặc họ tên{" "}
              <span className="font-bold">{user.FullName}</span>.
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Vui lòng liên hệ Phòng Đào tạo nếu bạn vừa được cấp chứng chỉ.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {certs.map((c) => (
              <div
                key={c.CertHash}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700">
                      {c.CertCode}
                    </span>
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                        c.IsValid ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                      }`}
                    >
                      {c.IsValid ? "Hợp lệ trên Blockchain" : "Đã thu hồi"}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-slate-900">{c.CourseName}</h2>
                  <p className="text-sm text-slate-500 mt-1">Đơn vị cấp: {c.IssuerUnit}</p>
                  <p className="text-sm text-slate-500">
                    Ngày cấp: {String(c.IssueDate).split("T")[0]}
                  </p>

                  {/* Thông tin bảo mật dành riêng cho chủ sở hữu */}
                  <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                    <div>
                      <span className="text-slate-500">Mã bảo mật (Security Key): </span>
                      <span className="font-mono font-bold text-amber-700">
                        {c.SecurityKey || "Không có"}
                      </span>
                    </div>
                    <div className="truncate">
                      <span className="text-slate-500">Cert Hash: </span>
                      <span className="font-mono text-slate-700">{c.CertHash}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
                  <Link
                    to={`/certificate/${encodeURIComponent(c.CertCode)}`}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition"
                  >
                    Xem chi tiết & Mã QR xác minh →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}