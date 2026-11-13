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
} from "lucide-react";
import { type FullCertificateRecord, fetchAllCertificates } from "../shared/certService";

export default function CertificateDetailPage() {
  const { code } = useParams<{ code: string }>();
  const [cert, setCert] = useState<FullCertificateRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const certCardRef = useRef<HTMLDivElement>(null);
  const [tiltStyle, setTiltStyle] = useState("perspective(1400px) rotateX(0deg) rotateY(0deg)");

  useEffect(() => {
    async function loadDetail() {
      if (!code) return;
      setLoading(true);
      const all = await fetchAllCertificates();
      const found = all.find(
        (item) => item.certCode.trim().toLowerCase() === decodeURIComponent(code).trim().toLowerCase()
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
    setTiltStyle(`perspective(1400px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`);
  };

  const handleMouseLeave = () => {
    setTiltStyle("perspective(1400px) rotateX(0deg) rotateY(0deg)");
  };

  if (loading) {
    return (
      <div className="bg-luxury-grid flex min-h-screen flex-col items-center justify-center gap-3 bg-[#020817] p-6 text-slate-300">
        <Loader2 className="h-9 w-9 animate-spin text-sky-400" />
        <p className="text-sm font-medium">Đang trích xuất dữ liệu chứng chỉ từ Ethereum Sepolia...</p>
      </div>
    );
  }

  if (!cert) {
    return (
      <div className="bg-luxury-grid flex min-h-screen flex-col items-center justify-center bg-[#020817] p-6 text-center text-slate-100">
        <div className="max-w-md rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8 backdrop-blur-2xl">
          <ShieldAlert className="mx-auto h-12 w-12 text-rose-400" />
          <h2 className="mt-4 text-xl font-black text-white">Không tìm thấy chứng chỉ</h2>
          <p className="mt-2 text-sm text-slate-400">
            Mã chứng chỉ <strong className="font-mono text-sky-300">{code}</strong> không tồn tại trên hệ thống Blockchain.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-600 px-5 py-3 text-sm font-extrabold text-white transition hover:scale-[1.02]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại trang xác minh</span>
          </Link>
        </div>
      </div>
    );
  }

  const verifyUrl = `${window.location.origin}/certificate/${encodeURIComponent(cert.certCode)}`;

  return (
    <div className="bg-luxury-grid relative min-h-screen bg-[#020817] pb-20 text-slate-100 selection:bg-sky-400 selection:text-slate-950">
      {/* Ánh sáng Spotlight xanh dương chiếu từ đỉnh */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden print:hidden">
        <div className="animate-pulse-glow absolute -top-40 left-1/2 h-[520px] w-[920px] rounded-full bg-gradient-to-b from-sky-400/25 via-blue-600/12 to-transparent blur-[120px]" />
      </div>

      {/* Thanh điều hướng */}
      <header className="sticky top-0 z-40 border-b border-sky-400/[0.08] bg-[#020817]/75 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-sky-400/20 bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-slate-200 transition hover:border-sky-400/50 hover:bg-sky-500/20 hover:text-sky-300"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Trang xác minh chứng chỉ</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/20 bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-slate-200 transition hover:border-sky-400/40 hover:text-white"
            >
              <Printer className="h-3.5 w-3.5 text-sky-400" />
              <span className="hidden sm:inline">In / Lưu PDF</span>
            </button>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-extrabold tracking-wide ${
                cert.isValid
                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.15)]"
                  : "border-rose-400/30 bg-rose-500/15 text-rose-300"
              }`}
            >
              {cert.isValid ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>ĐÃ XÁC THỰC • CÒN HIỆU LỰC</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                  <span>CHỨNG CHỈ ĐÃ BỊ THU HỒI</span>
                </>
              )}
            </span>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-4xl space-y-8 px-4 pt-10 sm:px-6">
        {/* Khung Phôi Văn Bằng 3D viền Xanh Hoàng Gia & Bạch Kim */}
        <div
          ref={certCardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ transform: tiltStyle, transformStyle: "preserve-3d" }}
          className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#f8fbff] via-[#eff6ff] to-[#dbeafe] p-3 text-slate-900 shadow-[0_30px_90px_-15px_rgba(56,189,248,0.32)] transition-transform duration-200 ease-out sm:p-5 print:shadow-none"
        >
          <div className="animate-shimmer pointer-events-none absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent skew-x-[-25deg] print:hidden" />

          <div className="relative rounded-[20px] border-2 border-[#1d4ed8]/50 p-1.5">
            <div className="relative rounded-[15px] border border-[#2563eb]/35 bg-gradient-to-b from-white to-[#eff6ff]/80 px-6 py-9 sm:px-12 sm:py-12">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#2563eb]/25 bg-sky-500/10 text-[#1d4ed8]">
                  <Award className="h-7 w-7" />
                </div>

                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#2563eb]/25 bg-sky-500/10 px-3 py-1 text-[11px] font-bold tracking-wider text-[#1e40af] uppercase">
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

              <div className="my-8 h-[1px] w-full bg-gradient-to-r from-transparent via-[#2563eb]/40 to-transparent" />

              <div className="flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-end">
                <div className="space-y-1.5 text-center text-xs text-slate-700 sm:text-left sm:text-sm">
                  <div>
                    Mã số chứng chỉ: <strong className="font-mono text-[#1e3a8a]">{cert.certCode}</strong>
                  </div>
                  <div>
                    Ngày cấp: <strong className="text-[#1e3a8a]">{cert.issueDate}</strong>
                  </div>
                </div>

                <div className="flex flex-col items-center rounded-2xl border border-sky-200 bg-white p-2.5 shadow-md">
                  <QRCodeSVG value={verifyUrl} size={92} />
                  <span className="mt-1.5 text-[10px] font-semibold text-slate-500">
                    QR Code xác minh
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bảng Thông Số Kỹ Thuật On-Chain */}
        <div className="rounded-3xl border border-sky-400/20 bg-[#061229]/75 p-6 shadow-2xl backdrop-blur-2xl sm:p-8 print:hidden">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-base font-extrabold tracking-wide text-white sm:text-lg">
              Thông tin định danh & Bằng chứng Blockchain
            </h3>
            <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-[11px] font-bold text-sky-300">
              Sepolia Testnet
            </span>
          </div>

          <div className="divide-y divide-sky-400/[0.1] text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
              <span className="text-slate-400">Trạng thái hiệu lực:</span>
              <strong className={cert.isValid ? "text-emerald-400" : "text-rose-400"}>
                {cert.isValid ? "Còn hiệu lực" : "Đã thu hồi"}
              </strong>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
              <span className="text-slate-400">Thời gian ghi nhận On-chain:</span>
              <span className="font-mono font-semibold text-slate-200">
                {new Date(cert.issuedAtOnChain * 1000).toLocaleString("vi-VN")}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
              <span className="text-slate-400">Ví cấp chứng chỉ (Admin):</span>
              <button
                type="button"
                onClick={() => handleCopy(cert.issuerWallet, "wallet")}
                className="inline-flex items-center gap-2 rounded-lg border border-sky-400/20 bg-black/45 px-3 py-1.5 font-mono text-xs text-slate-300 transition hover:border-sky-400/50 hover:text-sky-300"
              >
                <span className="max-w-[260px] truncate sm:max-w-none">{cert.issuerWallet}</span>
                {copiedField === "wallet" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {cert.txHash && (
              <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
                <span className="text-slate-400">Mã giao dịch Blockchain:</span>
                <a
                  href={`https://sepolia.etherscan.io/tx/${cert.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-sky-400 transition hover:text-cyan-300 hover:underline"
                >
                  <span>
                    {cert.txHash.slice(0, 18)}...{cert.txHash.slice(-10)}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            <div className="pt-4">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                <span>Mã Hash chứng chỉ (Keccak-256):</span>
                <button
                  type="button"
                  onClick={() => handleCopy(cert.certHash, "hash")}
                  className="inline-flex items-center gap-1 font-semibold text-sky-300 hover:underline"
                >
                  {copiedField === "hash" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedField === "hash" ? "Đã sao chép" : "Sao chép"}</span>
                </button>
              </div>
              <code className="block break-all rounded-xl border border-sky-400/20 bg-black/45 px-4 py-3 font-mono text-xs text-sky-200/90">
                {cert.certHash}
              </code>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}