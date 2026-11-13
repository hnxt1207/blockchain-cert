import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { BrowserProvider, Contract } from "ethers";
import {
  LayoutDashboard,
  ListChecks,
  FilePlus2,
  Wallet,
  Globe,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Search,
  Ban,
  Eye,
  Upload,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  Calendar,
  TrendingUp,
  Award,
  Sparkles,
} from "lucide-react";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../shared/contractConfig";
import {
  type CertificateMetadata,
  generateSalt,
  hashCertificateWithSalt,
  encodeOnChainPayload,
} from "../shared/hashHelper";
import {
  type FullCertificateRecord,
  STORAGE_KEY,
  fetchAllCertificates,
} from "../shared/certService";

declare global {
  interface Window {
    ethereum?: any;
  }
}

type AdminTab = "dashboard" | "manage" | "issue";
type DateFilterPreset = "today" | "7days" | "month" | "all" | "custom";

function AdminSidebarMascot({
  mousePos,
  isAuthorized,
  txLoading,
}: {
  mousePos: { x: number; y: number };
  isAuthorized: boolean;
  txLoading: boolean;
}) {
  const botRef = useRef<HTMLDivElement>(null);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!botRef.current) return;
    const rect = botRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = mousePos.x - cx;
    const dy = mousePos.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy, dx);
    const maxMove = Math.min(3.5, dist * 0.015);
    setEyeOffset({
      x: Math.cos(angle) * maxMove,
      y: Math.sin(angle) * maxMove,
    });
  }, [mousePos]);

  const eyeColor = txLoading ? "#2563eb" : isAuthorized ? "#10b981" : "#38bdf8";

  return (
    <div
      ref={botRef}
      className="mb-4 flex items-center gap-3 rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50 via-sky-50 to-white p-3 shadow-sm"
    >
      <div className="animate-float-slow shrink-0">
        <svg width="44" height="44" viewBox="0 0 80 80">
          <line x1="40" y1="16" x2="40" y2="7" stroke="#2563eb" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="40" cy="6" r="4.5" fill={eyeColor}>
            <animate attributeName="r" values="3.5;5.5;3.5" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <rect x="9" y="30" width="6" height="16" rx="3" fill="#2563eb" />
          <rect x="65" y="30" width="6" height="16" rx="3" fill="#2563eb" />
          <rect x="15" y="16" width="50" height="42" rx="16" fill="#1e3a8a" stroke="#ffffff" strokeWidth="2.5" />
          <rect x="20" y="22" width="40" height="28" rx="11" fill="#020817" />
          <g style={{ transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`, transition: "transform 0.06s linear" }}>
            <circle cx="31.5" cy="36" r="5" fill={eyeColor} />
            <circle cx="48.5" cy="36" r="5" fill={eyeColor} />
            <circle cx="33" cy="34.2" r="1.7" fill="#ffffff" />
            <circle cx="50" cy="34.2" r="1.7" fill="#ffffff" />
          </g>
        </svg>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-blue-700 uppercase">
          <Sparkles className="h-3 w-3 text-blue-600" />
          <span>AI Sentinel</span>
        </div>
        <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-600">
          {txLoading ? "Đang ký giao dịch..." : isAuthorized ? "Quyền Admin đã bật" : "Chờ kết nối ví"}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardLayout() {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [walletAddress, setWalletAddress] = useState("");
  const [networkName, setNetworkName] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState(false);
  const [contractAdminAddress, setContractAdminAddress] = useState("");

  const [records, setRecords] = useState<FullCertificateRecord[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [mousePos, setMousePos] = useState({ x: 300, y: 300 });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [datePreset, setDatePreset] = useState<DateFilterPreset>("all");
  const [customDate, setCustomDate] = useState<string>(todayStr);
  const [topSearch, setTopSearch] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "valid" | "revoked">("all");

  const [certCode, setCertCode] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [issuerUnit, setIssuerUnit] = useState("Trường Đại học");
  const [issueFile, setIssueFile] = useState<File | null>(null);
  const [salt, setSalt] = useState("");
  const [issueHash, setIssueHash] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);

  const [txLoading, setTxLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string; txHash?: string } | null>(null);

  const syncBlockchainData = async () => {
    try {
      setLoadingData(true);
      const data = await fetchAllCertificates();
      setRecords(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isAuthorizedAdmin) {
      syncBlockchainData();
    }
  }, [isAuthorizedAdmin]);

  const connectAdminWallet = async () => {
    setStatusMsg(null);
    if (!window.ethereum) {
      setStatusMsg({ type: "error", text: "Trình duyệt chưa cài đặt ví MetaMask!" });
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      const currentChainId = Number(network.chainId);

      setWalletAddress(accounts[0]);
      setChainId(currentChainId);
      setNetworkName(
        currentChainId === 11155111
          ? "Ethereum Sepolia"
          : `${network.name} (${currentChainId})`
      );

      if (currentChainId !== 11155111) {
        setIsAuthorizedAdmin(false);
        setStatusMsg({
          type: "error",
          text: "Sai mạng Blockchain! Vui lòng chuyển MetaMask sang Sepolia Testnet.",
        });
        return;
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const onChainAdmin: string = await contract.admin();
      setContractAdminAddress(onChainAdmin);
      setIsAuthorizedAdmin(accounts[0].toLowerCase() === onChainAdmin.toLowerCase());
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err?.message || "Kết nối ví thất bại." });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIssueFile(file);
    const activeSalt = salt || generateSalt();
    setSalt(activeSalt);
    const hash = await hashCertificateWithSalt(file, activeSalt);
    setIssueHash(hash);
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!certCode.trim() || !recipientName.trim() || !courseName.trim() || !issueDate || !issuerUnit.trim() || !issueFile || !issueHash) {
      setStatusMsg({ type: "error", text: "Vui lòng nhập đầy đủ thông tin và tải file chứng chỉ!" });
      return;
    }

    try {
      setTxLoading(true);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const payload = encodeOnChainPayload({
        certCode: certCode.trim(),
        recipientName: recipientName.trim(),
        courseName: courseName.trim(),
        issueDate,
        issuerUnit: issuerUnit.trim(),
      });

      const tx = await contract.issueCertificate(issueHash, payload);
      setStatusMsg({
        type: "success",
        text: "Đang chờ mạng Sepolia xác nhận giao dịch...",
        txHash: tx.hash,
      });

      await tx.wait();

      const savedRaw = localStorage.getItem(STORAGE_KEY);
      const localMap: Record<string, CertificateMetadata> = savedRaw ? JSON.parse(savedRaw) : {};
      localMap[issueHash] = {
        certCode: certCode.trim(),
        recipientName: recipientName.trim(),
        courseName: courseName.trim(),
        issueDate,
        issuerUnit: issuerUnit.trim(),
        salt,
        certHash: issueHash,
        txHash: tx.hash,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localMap));

      setStatusMsg({
        type: "success",
        text: `Cấp chứng chỉ ${certCode.trim()} thành công!`,
        txHash: tx.hash,
      });

      setCertCode("");
      setRecipientName("");
      setCourseName("");
      setIssueFile(null);
      setSalt("");
      setIssueHash("");
      await syncBlockchainData();
    } catch (err: any) {
      const reason = err?.reason || err?.shortMessage || "Giao dịch thất bại hoặc đã hủy trên MetaMask.";
      setStatusMsg({ type: "error", text: reason });
    } finally {
      setTxLoading(false);
    }
  };

  const handleRevoke = async (certHash: string, code: string) => {
    if (!window.confirm(`Xác nhận thu hồi hiệu lực chứng chỉ "${code}" trên Blockchain?`)) return;
    setStatusMsg(null);
    try {
      setTxLoading(true);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const tx = await contract.revokeCertificate(certHash);
      setStatusMsg({ type: "success", text: "Đang gửi giao dịch thu hồi lên Sepolia...", txHash: tx.hash });
      await tx.wait();

      setStatusMsg({ type: "success", text: `Đã thu hồi chứng chỉ ${code} thành công!`, txHash: tx.hash });
      await syncBlockchainData();
    } catch (err: any) {
      const reason = err?.reason || err?.shortMessage || "Thu hồi thất bại.";
      setStatusMsg({ type: "error", text: reason });
    } finally {
      setTxLoading(false);
    }
  };

  const dashboardRecords = useMemo(() => {
    const now = new Date();
    return records.filter((item) => {
      if (topSearch.trim()) {
        const q = topSearch.toLowerCase().trim();
        const matchSearch =
          item.certCode.toLowerCase().includes(q) ||
          item.recipientName.toLowerCase().includes(q) ||
          item.courseName.toLowerCase().includes(q);
        if (!matchSearch) return false;
      }

      if (datePreset === "all") return true;
      if (datePreset === "today") return item.issueDate === todayStr;
      if (datePreset === "custom") return item.issueDate === customDate;

      const itemDate = new Date(item.issueDate);
      if (isNaN(itemDate.getTime())) return true;

      if (datePreset === "7days") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        return itemDate >= sevenDaysAgo;
      }
      if (datePreset === "month") {
        return (
          itemDate.getMonth() === now.getMonth() &&
          itemDate.getFullYear() === now.getFullYear()
        );
      }
      return true;
    });
  }, [records, datePreset, customDate, todayStr, topSearch]);

  const issuedTodayCount = records.filter((r) => r.issueDate === todayStr).length;
  const filteredTotal = dashboardRecords.length;
  const filteredValid = dashboardRecords.filter((r) => r.isValid).length;
  const filteredRevoked = dashboardRecords.filter((r) => !r.isValid).length;

  const chartData = useMemo(() => {
    const days: { label: string; fullDate: string; validCount: number; revokedCount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      const dayItems = records.filter((r) => r.issueDate === iso);
      days.push({
        label,
        fullDate: iso,
        validCount: dayItems.filter((r) => r.isValid).length,
        revokedCount: dayItems.filter((r) => !r.isValid).length,
      });
    }
    return days;
  }, [records]);

  const maxChartVal = Math.max(4, ...chartData.map((d) => Math.max(d.validCount, d.revokedCount)));

  const topCourses = useMemo(() => {
    const map: Record<string, { course: string; total: number; valid: number }> = {};
    for (const r of dashboardRecords) {
      const key = r.courseName || "Chưa phân loại";
      if (!map[key]) map[key] = { course: key, total: 0, valid: 0 };
      map[key].total += 1;
      if (r.isValid) map[key].valid += 1;
    }
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [dashboardRecords]);

  const filteredManageRecords = records.filter((item) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "valid" && item.isValid) ||
      (statusFilter === "revoked" && !item.isValid);
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      item.certCode.toLowerCase().includes(q) ||
      item.recipientName.toLowerCase().includes(q) ||
      item.courseName.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const dateFilterTitle: Record<DateFilterPreset, string> = {
    today: `Hôm nay (${todayStr})`,
    "7days": "7 ngày gần nhất",
    month: "Tháng hiện tại",
    all: "Toàn bộ thời gian",
    custom: `Ngày ${customDate}`,
  };

  return (
    <div className="bg-luxury-grid relative flex min-h-screen bg-[#f0f7ff] text-slate-900 selection:bg-blue-600 selection:text-white">
      {/* Hậu cảnh Animation Xanh Băng Sáng nhẹ nhàng */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="animate-pulse-glow absolute -top-40 left-1/2 h-[480px] w-[920px] rounded-full bg-gradient-to-b from-sky-300/30 via-blue-400/12 to-transparent blur-[110px]" />
        <div className="animate-shooting-star absolute top-14 left-1/4 h-[2px] w-28 bg-gradient-to-r from-transparent via-blue-500 to-cyan-400 opacity-0" />
        <span className="animate-particle absolute bottom-24 left-[35%] h-2 w-2 rounded-full bg-blue-500/40" />
        <span style={{ animationDelay: "2s" }} className="animate-particle absolute bottom-32 left-[72%] h-2.5 w-2.5 rounded-full bg-cyan-500/40" />
      </div>

      {/* Sidebar Trái Trắng Kính Mờ */}
      <aside className="relative z-20 flex w-64 shrink-0 flex-col border-r border-blue-200/80 bg-white/85 p-5 backdrop-blur-2xl">
        <div className="mb-6 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 shadow-md shadow-blue-500/25">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="text-lg font-extrabold tracking-tight text-slate-900">CERT-CHAIN</div>
            <div className="text-xs font-semibold text-blue-600">Admin Dashboard</div>
          </div>
        </div>

        {/* Linh vật Robot AI Sentinel trên Sidebar */}
        <AdminSidebarMascot mousePos={mousePos} isAuthorized={isAuthorizedAdmin} txLoading={txLoading} />

        <nav className="flex-1 space-y-2">
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className={`flex w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
              activeTab === "dashboard"
                ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-lg shadow-blue-500/25"
                : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            Dashboard
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("manage")}
            className={`flex w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
              activeTab === "manage"
                ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-lg shadow-blue-500/25"
                : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
            }`}
          >
            <ListChecks className="h-5 w-5" />
            Quản lý chứng chỉ
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("issue")}
            className={`flex w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
              activeTab === "issue"
                ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-lg shadow-blue-500/25"
                : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
            }`}
          >
            <FilePlus2 className="h-5 w-5" />
            Cấp chứng chỉ mới
          </button>
        </nav>

        <div className="border-t border-blue-100 pt-4">
          <Link
            to="/"
            className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
          >
            <span>Trang xác minh công khai</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </aside>

      {/* Khu vực Nội dung Chính */}
      <main className="relative z-10 flex-1 px-6 py-6 lg:px-9">
        <div className="mx-auto max-w-6xl">
          {/* Top Header Bar */}
          <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div className="flex w-full max-w-xs items-center gap-2.5 rounded-2xl border border-blue-200/80 bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur-xl focus-within:border-blue-500">
              <input
                type="text"
                placeholder="Tìm nhanh mã chứng chỉ, học viên..."
                value={topSearch}
                onChange={(e) => setTopSearch(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 outline-none"
              />
              <Search className="h-4 w-4 text-blue-600" />
            </div>

            <div className="flex items-center gap-3">
              {!walletAddress ? (
                <button
                  onClick={connectAdminWallet}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition hover:opacity-95"
                >
                  <Wallet className="h-4 w-4" />
                  Kết nối ví MetaMask
                </button>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-blue-200/80 bg-white/90 px-4 py-2 shadow-sm backdrop-blur-xl">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Globe className={`h-4 w-4 ${chainId === 11155111 ? "text-emerald-600" : "text-rose-600"}`} />
                    <span>{networkName}</span>
                  </div>
                  <div className="h-4 w-[1px] bg-slate-200" />
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      isAuthorizedAdmin
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {isAuthorizedAdmin ? "Admin" : "Sai ví"}
                  </span>
                </div>
              )}
            </div>
          </header>

          {walletAddress && !isAuthorizedAdmin && chainId === 11155111 && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
              <span>
                Ví hiện tại không phải Admin của Smart Contract (<code className="font-mono font-bold">{contractAdminAddress}</code>).
              </span>
            </div>
          )}

          {statusMsg && (
            <div
              className={`mb-6 rounded-2xl border p-4 text-sm ${
                statusMsg.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-rose-200 bg-rose-50 text-rose-900"
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {statusMsg.type === "success" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-rose-600" />
                )}
                <span>{statusMsg.text}</span>
              </div>
              {statusMsg.txHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${statusMsg.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                >
                  Xem biên lai trên Sepolia Etherscan <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}

          {!isAuthorizedAdmin ? (
            <div className="rounded-3xl border border-blue-200/80 bg-white/90 px-6 py-20 text-center shadow-lg backdrop-blur-2xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                <Wallet className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-xl font-extrabold text-slate-900">Kết nối ví Quản trị viên</h3>
              <p className="mx-auto mt-2 max-w-md text-sm font-medium text-slate-600">
                Vui lòng kết nối ví MetaMask trên mạng Ethereum Sepolia để xem thống kê Dashboard và quản lý chứng chỉ.
              </p>
              <button
                onClick={connectAdminWallet}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:opacity-95"
              >
                <Wallet className="h-4 w-4" />
                Kết nối ví ngay
              </button>
            </div>
          ) : (
            <>
              {/* ===================================================================== */}
              {/* TRANG 1: DASHBOARD                                                    */}
              {/* ===================================================================== */}
              {activeTab === "dashboard" && (
                <div>
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-black text-slate-900">Dashboard</h1>
                      <p className="text-xs font-semibold text-slate-600">
                        Đang hiển thị thống kê: <span className="font-bold text-blue-600">{dateFilterTitle[datePreset]}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex rounded-2xl border border-blue-200/80 bg-white/90 p-1 shadow-sm">
                        {(
                          [
                            { id: "today", label: "Hôm nay" },
                            { id: "7days", label: "7 ngày" },
                            { id: "month", label: "Tháng này" },
                            { id: "all", label: "Tất cả" },
                          ] as { id: DateFilterPreset; label: string }[]
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setDatePreset(tab.id)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                              datePreset === tab.id
                                ? "bg-blue-600 text-white shadow-sm"
                                : "text-slate-700 hover:bg-blue-50"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5 rounded-2xl border border-blue-200/80 bg-white/90 px-3 py-1.5 shadow-sm">
                        <Calendar className="h-3.5 w-3.5 text-blue-600" />
                        <input
                          type="date"
                          value={customDate}
                          onChange={(e) => {
                            setCustomDate(e.target.value);
                            setDatePreset("custom");
                          }}
                          className="bg-transparent text-xs font-bold text-slate-800 outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={syncBlockchainData}
                        title="Đồng bộ dữ liệu từ Blockchain"
                        className="flex h-9 w-9 items-center justify-center rounded-2xl border border-blue-200/80 bg-white/90 text-slate-700 shadow-sm transition hover:text-blue-600"
                      >
                        <RefreshCw className={`h-4 w-4 ${loadingData ? "animate-spin text-blue-600" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {/* HÀNG 1: 4 THẺ KPI + BIỂU ĐỒ */}
                  <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-6">
                      <div className="flex items-center gap-5 rounded-3xl border border-blue-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-blue-400">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                          <TrendingUp className="h-7 w-7" />
                        </div>
                        <div>
                          <div className="text-3xl font-black text-slate-900">{issuedTodayCount}</div>
                          <div className="mt-1 text-xs font-bold text-slate-600">Cấp trong hôm nay</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-5 rounded-3xl border border-blue-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-blue-400">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                          <FileText className="h-7 w-7" />
                        </div>
                        <div>
                          <div className="text-3xl font-black text-slate-900">{filteredTotal}</div>
                          <div className="mt-1 text-xs font-bold text-slate-600">Tổng chứng chỉ đã cấp</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-5 rounded-3xl border border-blue-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-emerald-400">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                          <ShieldCheck className="h-7 w-7" />
                        </div>
                        <div>
                          <div className="text-3xl font-black text-slate-900">{filteredValid}</div>
                          <div className="mt-1 text-xs font-bold text-slate-600">Chứng chỉ còn hiệu lực</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-5 rounded-3xl border border-blue-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-rose-400">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                          <ShieldAlert className="h-7 w-7" />
                        </div>
                        <div>
                          <div className="text-3xl font-black text-slate-900">{filteredRevoked}</div>
                          <div className="mt-1 text-xs font-bold text-slate-600">Chứng chỉ đã thu hồi</div>
                        </div>
                      </div>
                    </div>

                    {/* Biểu đồ 7 ngày */}
                    <div className="flex flex-col justify-between rounded-3xl border border-blue-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-xl lg:col-span-6">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900">Biểu đồ cấp phát 7 ngày gần nhất</h3>
                          <p className="text-xs font-medium text-slate-500">Bấm vào từng ngày trên biểu đồ để lọc nhanh</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold">
                          <span className="flex items-center gap-1.5 text-slate-700">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Hợp lệ
                          </span>
                          <span className="flex items-center gap-1.5 text-slate-700">
                            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Thu hồi
                          </span>
                        </div>
                      </div>

                      <div className="relative h-44 w-full pt-2">
                        <svg viewBox="0 0 420 140" className="h-full w-full overflow-visible">
                          {[0, 0.5, 1].map((ratio, idx) => {
                            const y = 110 - ratio * 90;
                            return (
                              <g key={idx}>
                                <line x1="25" y1={y} x2="405" y2={y} stroke="#e2e8f0" strokeWidth="1.5" />
                                <text x="0" y={y + 4} fontSize="10" fontWeight="600" fill="#64748b">
                                  {Math.round(ratio * maxChartVal)}
                                </text>
                              </g>
                            );
                          })}

                          <polyline
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={chartData
                              .map((d, i) => {
                                const x = 40 + i * 58;
                                const y = 110 - (d.validCount / maxChartVal) * 90;
                                return `${x},${y}`;
                              })
                              .join(" ")}
                          />

                          <polyline
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={chartData
                              .map((d, i) => {
                                const x = 40 + i * 58;
                                const y = 110 - (d.revokedCount / maxChartVal) * 90;
                                return `${x},${y}`;
                              })
                              .join(" ")}
                          />

                          {chartData.map((d, i) => {
                            const x = 40 + i * 58;
                            const yValid = 110 - (d.validCount / maxChartVal) * 90;
                            return (
                              <g
                                key={d.fullDate}
                                className="cursor-pointer"
                                onClick={() => {
                                  setCustomDate(d.fullDate);
                                  setDatePreset("custom");
                                }}
                              >
                                <circle cx={x} cy={yValid} r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                                <text
                                  x={x}
                                  y="132"
                                  textAnchor="middle"
                                  fontSize="11"
                                  fontWeight={customDate === d.fullDate && datePreset === "custom" ? "800" : "600"}
                                  fill={customDate === d.fullDate && datePreset === "custom" ? "#2563eb" : "#475569"}
                                >
                                  {d.label}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* HÀNG 2: 2 BẢNG DỮ LIỆU RÕ NÉT */}
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="flex flex-col justify-between rounded-3xl border border-blue-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-xl lg:col-span-5">
                      <div>
                        <h3 className="mb-4 text-base font-extrabold text-slate-900">Top Khóa Học Cấp Phát</h3>
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-xs font-extrabold text-slate-500">
                              <th className="pb-3">Khóa học / Chương trình</th>
                              <th className="pb-3 text-center">Số lượng</th>
                              <th className="pb-3 text-right">Hợp lệ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {topCourses.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="py-8 text-center text-xs font-medium text-slate-500">
                                  Không có dữ liệu trong khoảng ngày này
                                </td>
                              </tr>
                            ) : (
                              topCourses.map((c, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/60">
                                  <td className="py-3 pr-2 font-semibold text-slate-800">
                                    <div className="flex items-center gap-2">
                                      <Award className="h-4 w-4 shrink-0 text-blue-600" />
                                      <span className="line-clamp-1">{c.course}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 text-center font-extrabold text-slate-900">{c.total}</td>
                                  <td className="py-3 text-right font-bold text-emerald-600">{c.valid}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-3 text-center">
                        <button
                          type="button"
                          onClick={() => setActiveTab("manage")}
                          className="text-xs font-extrabold text-blue-600 hover:underline"
                        >
                          Xem tất cả
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between rounded-3xl border border-blue-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-xl lg:col-span-7">
                      <div>
                        <h3 className="mb-4 text-base font-extrabold text-slate-900">Giao Dịch Cấp Phát Mới Nhất</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 text-xs font-extrabold text-slate-500">
                                <th className="pb-3">Mã CC</th>
                                <th className="pb-3">Người nhận</th>
                                <th className="pb-3">Ngày cấp</th>
                                <th className="pb-3 text-right">Trạng thái</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {dashboardRecords.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="py-8 text-center text-xs font-medium text-slate-500">
                                    Không có chứng chỉ nào được cấp trong khoảng thời gian đã chọn
                                  </td>
                                </tr>
                              ) : (
                                dashboardRecords.slice(0, 5).map((item) => (
                                  <tr key={item.certHash} className="hover:bg-blue-50/60">
                                    <td className="py-3 font-mono text-xs font-extrabold text-blue-700">
                                      #{item.certCode}
                                    </td>
                                    <td className="py-3 font-semibold text-slate-900">{item.recipientName}</td>
                                    <td className="py-3 text-xs font-medium text-slate-600">{item.issueDate}</td>
                                    <td className="py-3 text-right">
                                      <span
                                        className={`inline-block rounded-lg px-2.5 py-1 text-[11px] font-bold text-white ${
                                          item.isValid ? "bg-emerald-600" : "bg-rose-600"
                                        }`}
                                      >
                                        {item.isValid ? "Hợp lệ" : "Thu hồi"}
                                      </span>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-3 text-center">
                        <button
                          type="button"
                          onClick={() => setActiveTab("manage")}
                          className="text-xs font-extrabold text-blue-600 hover:underline"
                        >
                          Xem tất cả
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===================================================================== */}
              {/* TRANG 2: QUẢN LÝ CHỨNG CHỈ                                            */}
              {/* ===================================================================== */}
              {activeTab === "manage" && (
                <div>
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-black text-slate-900">Quản Lý Danh Sách Chứng Chỉ</h1>
                      <p className="text-xs font-medium text-slate-600">Tra cứu, in phôi văn bằng và thu hồi hiệu lực</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("issue")}
                      className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700"
                    >
                      <FilePlus2 className="h-4 w-4" />
                      + Cấp chứng chỉ mới
                    </button>
                  </div>

                  <div className="rounded-3xl border border-blue-200/80 bg-white/95 p-6 shadow-sm backdrop-blur-xl">
                    <div className="mb-5 flex flex-wrap gap-3">
                      <div className="flex flex-1 items-center gap-2.5 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 focus-within:border-blue-600 focus-within:bg-white">
                        <Search className="h-4 w-4 text-blue-600" />
                        <input
                          type="text"
                          placeholder="Tìm theo mã chứng chỉ, họ tên hoặc tên khóa học..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
                        />
                      </div>

                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none"
                      >
                        <option value="all">Tất cả ({records.length})</option>
                        <option value="valid">Còn hiệu lực ({records.filter((r) => r.isValid).length})</option>
                        <option value="revoked">Đã thu hồi ({records.filter((r) => !r.isValid).length})</option>
                      </select>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-xs font-extrabold text-slate-500 uppercase">
                            <th className="pb-3.5">Mã chứng chỉ</th>
                            <th className="pb-3.5">Họ và tên</th>
                            <th className="pb-3.5">Khóa học</th>
                            <th className="pb-3.5">Ngày cấp</th>
                            <th className="pb-3.5">Trạng thái</th>
                            <th className="pb-3.5 text-right">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredManageRecords.map((item) => (
                            <tr key={item.certHash} className="hover:bg-blue-50/60">
                              <td className="py-3.5 font-mono font-extrabold text-blue-700">{item.certCode}</td>
                              <td className="py-3.5 font-bold text-slate-900">{item.recipientName}</td>
                              <td className="py-3.5 font-medium text-slate-700">{item.courseName}</td>
                              <td className="py-3.5 font-medium text-slate-600">{item.issueDate}</td>
                              <td className="py-3.5">
                                <span
                                  className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold text-white ${
                                    item.isValid ? "bg-emerald-600" : "bg-rose-600"
                                  }`}
                                >
                                  {item.isValid ? "Còn hiệu lực" : "Đã thu hồi"}
                                </span>
                              </td>
                              <td className="py-3.5 text-right whitespace-nowrap">
                                <Link
                                  to={`/certificate/${encodeURIComponent(item.certCode)}`}
                                  target="_blank"
                                  className="mr-2 inline-flex items-center gap-1 rounded-xl bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-200"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Chi tiết
                                </Link>

                                {item.isValid && (
                                  <button
                                    type="button"
                                    onClick={() => handleRevoke(item.certHash, item.certCode)}
                                    disabled={txLoading}
                                    className="inline-flex items-center gap-1 rounded-xl bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-200 disabled:opacity-50"
                                  >
                                    <Ban className="h-3.5 w-3.5" />
                                    Thu hồi
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ===================================================================== */}
              {/* TRANG 3: CẤP CHỨNG CHỈ MỚI                                            */}
              {/* ===================================================================== */}
              {activeTab === "issue" && (
                <div>
                  <div className="mb-6">
                    <h1 className="text-2xl font-black text-slate-900">Cấp Phát Chứng Chỉ Mới</h1>
                    <p className="text-xs font-medium text-slate-600">Băm dữ liệu văn bằng và ký phát hành lên Ethereum Sepolia</p>
                  </div>

                  <form
                    onSubmit={handleIssueSubmit}
                    className="max-w-3xl space-y-5 rounded-3xl border border-blue-200/80 bg-white/95 p-8 shadow-lg backdrop-blur-xl"
                  >
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-extrabold text-slate-700 uppercase">Mã chứng chỉ *</label>
                        <input
                          type="text"
                          placeholder="VD: CERT-2026-001"
                          value={certCode}
                          onChange={(e) => setCertCode(e.target.value)}
                          className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-sm font-semibold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-extrabold text-slate-700 uppercase">Họ tên người nhận *</label>
                        <input
                          type="text"
                          placeholder="VD: Nguyễn Văn An"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-extrabold text-slate-700 uppercase">Tên khóa học *</label>
                        <input
                          type="text"
                          placeholder="VD: Công nghệ Blockchain & Web3"
                          value={courseName}
                          onChange={(e) => setCourseName(e.target.value)}
                          className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-extrabold text-slate-700 uppercase">Ngày cấp *</label>
                        <input
                          type="date"
                          value={issueDate}
                          onChange={(e) => setIssueDate(e.target.value)}
                          className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-extrabold text-slate-700 uppercase">Đơn vị cấp *</label>
                      <input
                        type="text"
                        placeholder="VD: Trường Đại học..."
                        value={issuerUnit}
                        onChange={(e) => setIssuerUnit(e.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-extrabold text-slate-700 uppercase">Tệp chứng chỉ gốc (PDF / Ảnh) *</label>
                      <div className="relative flex cursor-pointer items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/60 p-6 text-sm font-bold text-blue-700 hover:bg-blue-100/70">
                        <Upload className="h-5 w-5" />
                        <span>{issueFile ? issueFile.name : "Bấm để chọn file chứng chỉ tạo mã Hash"}</span>
                        <input
                          type="file"
                          onChange={handleFileChange}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                      </div>
                    </div>

                    {salt && (
                      <div>
                        <label className="mb-1.5 block text-xs font-extrabold text-slate-700 uppercase">Mã xác thực đi kèm (Security Key)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={salt}
                            className="w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-2.5 font-mono text-xs font-bold text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(salt);
                              setCopiedKey(true);
                              setTimeout(() => setCopiedKey(false), 2000);
                            }}
                            className="rounded-2xl border border-slate-300 bg-slate-100 px-4 hover:bg-slate-200"
                          >
                            {copiedKey ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-700" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {issueHash && (
                      <div>
                        <label className="mb-1.5 block text-xs font-extrabold text-slate-700 uppercase">Mã Hash (Keccak-256)</label>
                        <code className="block break-all rounded-2xl border border-slate-300 bg-slate-100 p-3.5 font-mono text-xs font-semibold text-slate-900">
                          {issueHash}
                        </code>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={txLoading}
                      className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-blue-500/25 transition hover:opacity-95 disabled:opacity-60"
                    >
                      {txLoading ? "Đang chờ xác nhận từ MetaMask..." : "Tạo & Xác nhận cấp chứng chỉ bằng MetaMask"}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}