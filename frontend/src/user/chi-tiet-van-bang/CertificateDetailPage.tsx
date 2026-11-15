import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  ExternalLink,
  Award,
  Copy,
  Check,
  Printer,
  Sparkles,
  Loader2,
  UserCircle2,
} from "lucide-react";
import {
  type FullCertificateRecord,
  fetchAllCertificates,
  getCurrentUser,
} from "../../ket-noi-du-lieu/apiService";

export default function CertificateDetailPage() {
  const { code } = useParams<{ code: string }>();
  const currentUser = getCurrentUser();
  const [cert, setCert] = useState<FullCertificateRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const certCardRef = useRef<HTMLDivElement>(null);
  const [tiltStyle, setTiltStyle] = useState(
    "perspective(1400px) rotateX(0deg) rotateY(0deg)"
  );

  useEffect(() => {
    async function loadDetail() {
      if (!code) return;
      setLoading(true);
      const all = await fetchAllCertificates();
      const found = all.find(
        (item) =>
          item.certCode.trim().toLowerCase() ===
          decodeURIComponent(code).trim().toLowerCase()
      );
      setCert(found || null);
      setLoading(false);
    }
    loadDetail();
  }, [code]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!certCardRef.current) return;
    const rect = certCardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -3.5;
    const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 3.5;
    setTiltStyle(
      `perspective(1400px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`
    );
  };

  const handleMouseLeave = () => {
    setTiltStyle("perspective(1400px) rotateX(0deg) rotateY(0deg)");
  };

  if (loading) {
    return (
      <div className="bg-luxury-grid flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f0f7ff] p-6 text-slate-700">
        <Loader2 className="h-9 w-9 animate-spin text-blue-600" />
        <p className="text-sm font-semibold">
          Đang trích xuất dữ liệu chứng chỉ từ Ethereum Sepolia...
        </p>
      </div>
    );
  }

  if (!cert) {
    return (
      <div className="bg-luxury-grid flex min-h-screen flex-col items-center justify-center bg-[#f0f7ff] p-6 text-center text-slate-900">
        <div className="max-w-md rounded-3xl border border-rose-200 bg-white/90 p-8 shadow-xl backdrop-blur-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-xl font-black text-slate-900">
            Không tìm thấy chứng chỉ
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-600">
            Mã chứng chỉ{" "}
            <strong className="font-mono text-blue-600">{code}</strong> không tồn
            tại trên hệ thống Blockchain.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-3 text-sm font-extrabold text-white shadow-md shadow-blue-500/25 transition hover:opacity-95"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại trang xác minh</span>
          </Link>
        </div>
      </div>
    );
  }

  const verifyUrl = `${window.location.origin}/certificate/${encodeURIComponent(
    cert.certCode
  )}`;

  return (
    <div className="bg-luxury-grid relative min-h-screen bg-[#f0f7ff] pb-20 text-slate-900 selection:bg-blue-600 selection:text-white">
      {/* Hiệu ứng ánh sáng nền Sky-Cyan đồng bộ toàn hệ thống */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden print:hidden">
        <div className="animate-pulse-glow absolute -top-40 left-1/2 h-[520px] w-[920px] rounded-full bg-gradient-to-b from-sky-300/35 via-blue-400/15 to-transparent blur-[110px]" />
        <div className="animate-shooting-star absolute top-16 left-1/4 h-[2px] w-28 bg-gradient-to-r from-transparent via-blue-500 to-cyan-400 opacity-0" />
        <span className="animate-particle absolute bottom-28 left-[28%] h-2 w-2 rounded-full bg-blue-500/40" />
        <span
          style={{ animationDelay: "2s" }}
          className="animate-particle absolute bottom-36 left-[74%] h-2.5 w-2.5 rounded-full bg-cyan-500/40"
        />
      </div>

      {/* Thanh điều hướng trắng kính mờ */}
      <header className="sticky top-0 z-40 border-b border-blue-200/80 bg-white/85 backdrop-blur-2xl print:hidden">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-3.5 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Trang xác minh</span>
            </Link>

            {currentUser && (
              <Link
                to={currentUser.Role === "ADMIN" ? "/admin" : "/student"}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
              >
                <UserCircle2 className="h-4 w-4 text-blue-600" />
                <span>
                  {currentUser.Role === "ADMIN" ? "Trang quản trị" : "Hồ sơ của tôi"}
                </span>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:border-blue-400 hover:text-blue-700"
            >
              <Printer className="h-3.5 w-3.5 text-blue-600" />
              <span className="hidden sm:inline">In / Lưu PDF</span>
            </button>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-extrabold tracking-wide ${
                cert.isValid
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-xs"
                  : "border-rose-200 bg-rose-50 text-rose-700 shadow-xs"
              }`}
            >
              {cert.isValid ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>ĐÃ XÁC THỰC • CÒN HIỆU LỰC</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4 text-rose-600" />
                  <span>CHỨNG CHỈ ĐÃ BỊ THU HỒI</span>
                </>
              )}
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl space-y-8 px-4 pt-10 sm:px-6">
        {/* Khung Phôi Văn Bằng 3D viền Xanh Hoàng Gia & Bạch Kim */}
        <div
          ref={certCardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ transform: tiltStyle, transformStyle: "preserve-3d" }}
          className="relative overflow-hidden rounded-[28px] border border-blue-200/80 bg-gradient-to-br from-white via-[#f5f9ff] to-[#e0efff] p-3 text-slate-900 shadow-[0_25px_70px_-15px_rgba(37,99,235,0.2)] transition-transform duration-200 ease-out sm:p-5 print:border-none print:shadow-none"
        >
          <div className="animate-shimmer pointer-events-none absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/75 to-transparent skew-x-[-25deg] print:hidden" />

          <div className="relative rounded-[20px] border-2 border-[#1d4ed8]/45 p-1.5">
            <div className="relative rounded-[15px] border border-[#2563eb]/30 bg-gradient-to-b from-white to-[#f0f7ff]/85 px-6 py-9 sm:px-12 sm:py-12">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#2563eb]/20 bg-blue-50 text-[#1d4ed8]">
                  <Award className="h-7 w-7" />
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#2563eb]/20 bg-blue-50 px-3 py-1 text-[11px] font-bold tracking-wider text-[#1e40af] uppercase">
                  <Sparkles className="h-3 w-3" />
                  <span>Blockchain Certified</span>
                </div>
              </div>

              <div className="mt-6 text-center">
                <div className="text-xs font-extrabold tracking-[0.16em] text-[#1e3a8a] uppercase sm:text-base">
                  {cert.issuerUnit.toUpperCase()}
                </div>
                <div className="mt-2 font-serif text-2xl font-extrabold text-[#1d4ed8] sm:text-3xl">
                  CHỨNG CHỈ HOÀN THÀNH KHÓA HỌC
                </div>

                <div className="mt-7 text-sm italic text-slate-600 sm:text-base">
                  Trân trọng chứng nhận học viên:
                </div>
                <div className="mt-3 font-serif text-3xl font-extrabold text-slate-950 sm:text-5xl">
                  {cert.recipientName}
                </div>

                <div className="mt-6 text-sm italic text-slate-600 sm:text-base">
                  Đã hoàn thành xuất sắc chương trình đào tạo:
                </div>
                <div className="mt-2 text-lg font-extrabold text-[#0284c7] sm:text-2xl">
                  {cert.courseName}
                </div>
              </div>

              <div className="my-8 h-[1px] w-full bg-gradient-to-r from-transparent via-[#2563eb]/35 to-transparent" />

              <div className="flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-end">
                <div className="space-y-1.5 text-center text-xs text-slate-700 sm:text-left sm:text-sm">
                  <div>
                    Mã số chứng chỉ:{" "}
                    <strong className="font-mono text-[#1e3a8a]">
                      {cert.certCode}
                    </strong>
                  </div>
                  {cert.studentCode && (
                    <div>
                      Mã số sinh viên:{" "}
                      <strong className="font-mono text-[#1e3a8a]">
                        {cert.studentCode}
                      </strong>
                    </div>
                  )}
                  <div>
                    Ngày cấp:{" "}
                    <strong className="text-[#1e3a8a]">{cert.issueDate}</strong>
                  </div>
                </div>

                <div className="flex flex-col items-center rounded-2xl border border-blue-200 bg-white p-2.5 shadow-sm">
                  <QRCodeSVG value={verifyUrl} size={92} />
                  <span className="mt-1.5 text-[10px] font-semibold text-slate-500">
                    QR Code xác minh
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bảng Thông Số Kỹ Thuật On-Chain (Light Glassmorphism đồng bộ) */}
        <div className="rounded-3xl border border-blue-200/80 bg-white/90 p-6 shadow-lg shadow-blue-500/5 backdrop-blur-2xl sm:p-8 print:hidden">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-extrabold tracking-wide text-slate-900 sm:text-lg">
              Thông tin định danh & Bằng chứng Blockchain
            </h3>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">
              Ethereum Sepolia
            </span>
          </div>

          <div className="divide-y divide-slate-200/80 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
              <span className="font-medium text-slate-500">Trạng thái hiệu lực:</span>
              <strong
                className={
                  cert.isValid
                    ? "rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700"
                    : "rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-extrabold text-rose-700"
                }
              >
                {cert.isValid ? "Còn hiệu lực" : "Đã thu hồi"}
              </strong>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
              <span className="font-medium text-slate-500">Thời gian ghi nhận On-chain:</span>
              <span className="font-mono font-bold text-slate-800">
                {new Date(cert.issuedAtOnChain * 1000).toLocaleString("vi-VN")}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
              <span className="font-medium text-slate-500">Đơn vị xác thực On-chain:</span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-right text-xs font-bold text-emerald-700">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  {cert.issuerUnit || "Đơn vị đào tạo"} (Đã xác thực)
                </span>
              </span>
            </div>

            {cert.txHash && (
              <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
                <span className="font-medium text-slate-500">Mã giao dịch Blockchain:</span>
                <a
                  href={`https://sepolia.etherscan.io/tx/${cert.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
                >
                  <span>
                    {cert.txHash.slice(0, 18)}...{cert.txHash.slice(-10)}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            <div className="pt-4">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Mã Hash chứng chỉ (Keccak-256):</span>
                <button
                  type="button"
                  onClick={() => handleCopy(cert.certHash, "hash")}
                  className="inline-flex items-center gap-1 font-bold text-blue-600 hover:underline"
                >
                  {copiedField === "hash" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {copiedField === "hash" ? "Đã sao chép" : "Sao chép"}
                  </span>
                </button>
              </div>
              <code className="block break-all rounded-xl border border-blue-200/80 bg-slate-50 px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                {cert.certHash}
              </code>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}