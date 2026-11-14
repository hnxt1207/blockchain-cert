import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { saveCurrentUser } from "./apiService";

export default function AuthPage() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      if (isRegister) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, fullName, studentCode }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        setSuccessMsg(data.message);
        setIsRegister(false);
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        saveCurrentUser(data.user);
        if (data.user.Role === "ADMIN") {
          navigate("/admin");
        } else {
          navigate("/student");
        }
      }
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
        <div className="text-center mb-6">
          <Link to="/" className="text-sm text-indigo-600 hover:underline font-medium">
            ← Quay lại cổng tra cứu công khai
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-3">
            {isRegister ? "Đăng ký tài khoản Sinh viên" : "Đăng nhập Hệ thống"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isRegister
              ? "Tạo tài khoản để quản lý toàn bộ văn bằng & mã xác thực của bạn"
              : "Dành cho Sinh viên tra cứu hồ sơ & Cán bộ quản trị"}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Họ và tên đầy đủ</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mã số sinh viên</label>
                <input
                  type="text"
                  required
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  placeholder="VD: SV2026001"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sinhvien@edu.vn hoặc admin@certchain.edu.vn"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition disabled:opacity-50"
          >
            {loading ? "Đang xử lý..." : isRegister ? "Đăng ký tài khoản" : "Đăng nhập"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          {isRegister ? (
            <>
              Đã có tài khoản?{" "}
              <button
                type="button"
                onClick={() => setIsRegister(false)}
                className="text-indigo-600 font-semibold hover:underline"
              >
                Đăng nhập ngay
              </button>
            </>
          ) : (
            <>
              Sinh viên chưa có tài khoản?{" "}
              <button
                type="button"
                onClick={() => setIsRegister(true)}
                className="text-indigo-600 font-semibold hover:underline"
              >
                Đăng ký tại đây
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}