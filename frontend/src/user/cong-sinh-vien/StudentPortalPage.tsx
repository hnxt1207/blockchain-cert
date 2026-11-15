import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getCurrentUser, logoutUser } from "../../ket-noi-du-lieu/apiService";

export default function StudentPortalPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "VALID" | "REVOKED">("ALL");
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  const handleCopy = (text: string, fieldId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const filteredCerts = useMemo(() => {
    return certs.filter((c) => {
      const keyword = searchTerm.toLowerCase();
      const matchSearch =
        String(c.CourseName || "").toLowerCase().includes(keyword) ||
        String(c.CertCode || "").toLowerCase().includes(keyword) ||
        String(c.IssuerUnit || "").toLowerCase().includes(keyword);

      const matchStatus =
        filterStatus === "ALL"
          ? true
          : filterStatus === "VALID"
          ? Boolean(c.IsValid)
          : !c.IsValid;

      return matchSearch && matchStatus;
    });
  }, [certs, searchTerm, filterStatus]);

  if (!user) return null;

  const validCount = certs.filter((c) => Boolean(c.IsValid)).length;
  const revokedCount = certs.length - validCount;
  const uniqueIssuers = new Set(certs.map((c) => c.IssuerUnit).filter(Boolean)).size;

  const initials = String(user.FullName || "SV")
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-[#e8f6ff] via-[#f2faff] to-[#e6f4fe] text-slate-800 font-sans">
      {/* CSS Keyframes cho hiệu ứng Sao băng bay chéo & Vòng quỹ đạo xoay */}
      <style>{`
        @keyframes shootingStar {
          0% {
            transform: translate3d(0, 0, 0) rotate(35deg);
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          75% {
            opacity: 0.9;
          }
          100% {
            transform: translate3d(420px, 295px, 0) rotate(35deg);
            opacity: 0;
          }
        }
        @keyframes orbitSpin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes orbitSpinReverse {
          from { transform: translate(-50%, -50%) rotate(360deg); }
          to { transform: translate(-50%, -50%) rotate(0deg); }
        }
        .animate-shooting-1 {
          animation: shootingStar 4.8s linear infinite;
        }
        .animate-shooting-2 {
          animation: shootingStar 6.2s linear 1.8s infinite;
        }
        .animate-shooting-3 {
          animation: shootingStar 5.5s linear 3.4s infinite;
        }
        .animate-orbit-slow {
          animation: orbitSpin 28s linear infinite;
        }
        .animate-orbit-reverse {
          animation: orbitSpinReverse 20s linear infinite;
        }
      `}</style>

      {/* Lớp nền lưới & Hiệu ứng quỹ đạo + Sao băng */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        {/* Lưới tọa độ xanh nhạt */}
        <div
          className="absolute inset-0 opacity-45"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(56, 189, 248, 0.13) 1px, transparent 1px), linear-gradient(to bottom, rgba(56, 189, 248, 0.13) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Quầng sáng trung tâm */}
        <div className="absolute top-[28%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] rounded-full bg-sky-300/15 blur-3xl" />

        {/* Vòng tròn quỹ đạo lớn (có 2 chấm sáng xoay tròn) */}
        <div className="animate-orbit-slow absolute top-[34%] left-1/2 w-[660px] h-[660px] rounded-full border border-sky-300/45">
          {/* Chấm trắng viền xanh ở đỉnh vòng */}
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.9)]" />
          {/* Chấm xanh cyan ở đáy vòng */}
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-cyan-400 ring-4 ring-white/80 shadow-[0_0_10px_rgba(34,211,238,0.85)]" />
        </div>

        {/* Vòng tròn quỹ đạo nhỏ bên trong (xoay ngược chiều) */}
        <div className="animate-orbit-reverse absolute top-[34%] left-1/2 w-[450px] h-[450px] rounded-full border border-dashed border-sky-300/50">
          <span className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.85)]" />
          <span className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2 h-2 rounded-full bg-sky-400 ring-2 ring-white" />
        </div>

        {/* Các tia sao băng chạy chéo màn hình */}
        <div className="animate-shooting-1 opacity-0 absolute top-[12%] left-[12%] w-28 h-[2px] rounded-full bg-gradient-to-r from-transparent via-sky-400 to-white shadow-[0_0_8px_rgba(56,189,248,0.8)]">
          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#fff]" />
        </div>

        <div className="animate-shooting-2 opacity-0 absolute top-[18%] left-[55%] w-32 h-[2px] rounded-full bg-gradient-to-r from-transparent via-cyan-400 to-white shadow-[0_0_8px_rgba(34,211,238,0.8)]">
          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#fff]" />
        </div>

        <div className="animate-shooting-3 opacity-0 absolute top-[45%] left-[25%] w-24 h-[2px] rounded-full bg-gradient-to-r from-transparent via-blue-400 to-white shadow-[0_0_8px_rgba(96,165,250,0.8)]">
          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#fff]" />
        </div>
      </div>

      {/* Top Navbar đồng bộ với trang Tra cứu chung */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-sky-100/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-sky-500/25">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <span className="font-extrabold text-slate-900 tracking-tight text-lg">CERT-CHAIN</span>
          </Link>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="hidden md:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-sky-100 shadow-xs text-xs font-semibold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Ethereum Sepolia</span>
            </div>

            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 hover:brightness-105 shadow-md shadow-sky-500/25 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
              <span>Cổng tra cứu chung</span>
            </Link>

            <button
              onClick={handleLogout}
              title="Đăng xuất"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold text-rose-600 bg-white hover:bg-rose-50 border border-rose-100 shadow-xs transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1"
                />
              </svg>
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
        {/* Khối Tiêu đề & Hồ sơ Sinh viên (Glass Card trong mờ để thấy nền quỹ đạo phía sau) */}
        <section className="bg-white/75 backdrop-blur-md rounded-3xl border border-white shadow-xl shadow-sky-900/5 p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-400 text-white flex items-center justify-center text-2xl font-extrabold tracking-wider shadow-lg shadow-sky-500/25 shrink-0">
                {initials}
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-sky-50 text-sky-600 border border-sky-200/80 mb-2">
                  <span>✦ STUDENT DIGITAL WALLET</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Hồ Sơ{" "}
                  <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 bg-clip-text text-transparent">
                    Văn Bằng Cá Nhân
                  </span>
                </h1>
                <p className="text-sm text-slate-600 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    Sinh viên: <strong className="font-bold text-slate-800">{user.FullName}</strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    MSSV:{" "}
                    <span className="font-mono font-bold text-sky-600 bg-sky-50 border border-sky-200/70 px-2 py-0.5 rounded-lg">
                      {user.StudentCode}
                    </span>
                  </span>
                </p>
              </div>
            </div>

            {/* 4 Thẻ thống kê nhỏ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/80 border border-sky-100 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-slate-900 leading-none">{certs.length}</p>
                  <p className="text-[11px] font-medium text-slate-500 mt-1">Tổng văn bằng</p>
                </div>
              </div>

              <div className="bg-white/80 border border-emerald-100 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-slate-900 leading-none">{validCount}</p>
                  <p className="text-[11px] font-medium text-slate-500 mt-1">Còn hiệu lực</p>
                </div>
              </div>

              <div className="bg-white/80 border border-rose-100 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-500 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3l9 4.5v6c0 4.97-3.84 9.61-9 10.5-5.16-.89-9-5.53-9-10.5v-6L12 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-slate-900 leading-none">{revokedCount}</p>
                  <p className="text-[11px] font-medium text-slate-500 mt-1">Đã thu hồi</p>
                </div>
              </div>

              <div className="bg-white/80 border border-blue-100 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-slate-900 leading-none">{uniqueIssuers}</p>
                  <p className="text-[11px] font-medium text-slate-500 mt-1">Đơn vị cấp</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Thanh tìm kiếm & Bộ lọc */}
        {!loading && certs.length > 0 && (
          <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/75 backdrop-blur-md p-4 rounded-2xl border border-white shadow-md shadow-sky-900/5">
            <div className="relative flex-1 max-w-md">
              <svg
                className="w-4 h-4 text-sky-500 absolute left-3.5 top-1/2 -translate-y-1/2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm mã CC, tên khóa học, đơn vị cấp..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-white/80 border border-sky-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-400 focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-sky-50/80 p-1 rounded-xl border border-sky-100 self-start sm:self-auto">
              {(
                [
                  { id: "ALL", label: `Tất cả (${certs.length})` },
                  { id: "VALID", label: `Hợp lệ (${validCount})` },
                  { id: "REVOKED", label: `Thu hồi (${revokedCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    filterStatus === tab.id
                      ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-sm shadow-sky-500/25"
                      : "text-slate-600 hover:text-sky-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Danh sách thẻ văn bằng */}
        {loading ? (
          <div className="bg-white/75 backdrop-blur-md rounded-3xl border border-white p-14 text-center shadow-lg shadow-sky-900/5">
            <div className="w-9 h-9 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-600 text-sm font-medium">Đang đồng bộ dữ liệu văn bằng từ hệ thống...</p>
          </div>
        ) : certs.length === 0 ? (
          <div className="bg-white/75 backdrop-blur-md rounded-3xl border border-white p-12 text-center shadow-lg shadow-sky-900/5">
            <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-500 flex items-center justify-center mx-auto mb-3 border border-sky-100">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-slate-800 font-bold text-base">
              Chưa tìm thấy văn bằng nào gắn với MSSV <span className="text-sky-600">{user.StudentCode}</span> hoặc họ tên{" "}
              <span>{user.FullName}</span>.
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Vui lòng liên hệ Phòng Đào tạo nếu bạn vừa được cấp chứng chỉ.
            </p>
          </div>
        ) : filteredCerts.length === 0 ? (
          <div className="bg-white/75 backdrop-blur-md rounded-3xl border border-dashed border-sky-200 p-12 text-center">
            <h3 className="text-base font-bold text-slate-800">Không tìm thấy văn bằng phù hợp</h3>
            <p className="text-sm text-slate-500 mt-1">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.</p>
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCerts.map((c) => (
              <article
                key={c.CertHash}
                className="group relative bg-white/80 backdrop-blur-md rounded-3xl border border-white shadow-lg shadow-sky-900/5 hover:shadow-xl hover:shadow-sky-500/10 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col"
              >
                <div
                  className={`h-1.5 w-full ${
                    c.IsValid
                      ? "bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400"
                      : "bg-gradient-to-r from-rose-500 to-amber-500"
                  }`}
                />

                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200/80">
                      #{c.CertCode}
                    </span>

                    {c.IsValid ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500 text-white shadow-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        Hợp lệ
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500 text-white shadow-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        Đã thu hồi
                      </span>
                    )}
                  </div>

                  <div className="mb-5">
                    <h2 className="text-lg font-extrabold text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-2">
                      {c.CourseName}
                    </h2>

                    <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                        <span className="leading-relaxed">{c.IssuerUnit}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-sky-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span>
                          Ngày cấp:{" "}
                          <strong className="font-semibold text-slate-800">{String(c.IssueDate).split("T")[0]}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto bg-sky-50/75 border border-sky-100 rounded-2xl p-3.5 space-y-2.5 mb-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-slate-500">Mã bảo mật (Security Key)</p>
                        <p className="text-xs font-mono font-bold text-amber-700 truncate">
                          {c.SecurityKey || "Không có"}
                        </p>
                      </div>
                      {c.SecurityKey && (
                        <button
                          type="button"
                          onClick={() => handleCopy(c.SecurityKey, `key-${c.CertHash}`)}
                          className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white border border-sky-200/80 text-sky-700 hover:bg-sky-600 hover:text-white hover:border-sky-600 transition cursor-pointer"
                        >
                          {copiedField === `key-${c.CertHash}` ? "Đã chép ✓" : "Sao chép"}
                        </button>
                      )}
                    </div>

                    <div className="border-t border-sky-200/60" />

                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-slate-500">Cert Hash</p>
                        <p className="text-xs font-mono text-slate-700 truncate">{c.CertHash}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(c.CertHash, `hash-${c.CertHash}`)}
                        className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white border border-sky-200/80 text-sky-700 hover:bg-sky-600 hover:text-white hover:border-sky-600 transition cursor-pointer"
                      >
                        {copiedField === `hash-${c.CertHash}` ? "Đã chép ✓" : "Sao chép"}
                      </button>
                    </div>
                  </div>

                  <Link
                    to={`/certificate/${encodeURIComponent(c.CertCode)}`}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 hover:brightness-105 text-white text-sm font-bold shadow-md shadow-sky-500/25 flex items-center justify-center gap-2 transition"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                      />
                    </svg>
                    <span>Xem chi tiết & Mã QR xác minh →</span>
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}