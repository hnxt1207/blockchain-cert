import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrowserProvider, Contract } from "ethers";
import * as XLSX from "xlsx";
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
  LogOut,
  Wand2,
  FileSpreadsheet,
  Download,
  Trash2,
  GraduationCap,
  Users,
  Building2,
  X,
} from "lucide-react";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../ket-noi-blockchain/cau-hinh-hop-dong/contractConfig";
import {
  type CertificateMetadata,
  generateSalt,
  hashCertificateWithSalt,
  hashMetadataWithSalt,
  encodeOnChainPayload,
} from "../ket-noi-blockchain/ma-hoa-keccak256/hashHelper";
import {
  type FullCertificateRecord,
  STORAGE_KEY,
  fetchAllCertificates,
  saveCertificateToSQL,
  revokeCertificateInSQL,
  logoutUser,
  getCurrentUser,
} from "../ket-noi-du-lieu/apiService";

declare global {
  interface Window {
    ethereum?: any;
  }
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type AdminTab = "dashboard" | "manage" | "courses" | "issue";
type IssueMode = "single" | "batch";
type DateFilterPreset = "today" | "7days" | "month" | "all" | "custom";

interface BatchPreviewRow {
  certCode: string;
  studentCode: string;
  recipientName: string;
  courseName: string;
  issueDate: string;
  issuerUnit: string;
  salt: string;
  certHash: string;
  error?: string;
}

interface CourseSummaryItem {
  courseName: string;
  issuerUnit: string;
  total: number;
  valid: number;
  revoked: number;
  latestIssueDate: string;
  certificates: FullCertificateRecord[];
}

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
  const navigate = useNavigate();
  const currentAdmin = getCurrentUser();

  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [issueMode, setIssueMode] = useState<IssueMode>("single");

  const [walletAddress, setWalletAddress] = useState("");
  const [networkName, setNetworkName] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState(false);

  const [records, setRecords] = useState<FullCertificateRecord[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [mousePos, setMousePos] = useState({ x: 300, y: 300 });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  const todayStr = useMemo(() => formatLocalDate(new Date()), []);
  const [datePreset, setDatePreset] = useState<DateFilterPreset>("all");
  const [customDate, setCustomDate] = useState<string>(todayStr);
  const [topSearch, setTopSearch] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "valid" | "revoked">("all");

  // State cho trang Khóa học cấp phát
  const [courseSearch, setCourseSearch] = useState("");
  const [selectedCourseModal, setSelectedCourseModal] = useState<CourseSummaryItem | null>(null);

  // State cấp đơn lẻ
  const [certCode, setCertCode] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [issueDate, setIssueDate] = useState(() => formatLocalDate(new Date()));
  const [issuerUnit, setIssuerUnit] = useState("Trường Đại học");
  const [issueFile, setIssueFile] = useState<File | null>(null);
  const [salt, setSalt] = useState("");
  const [issueHash, setIssueHash] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);

  // State cấp hàng loạt từ Excel
  const [batchFileName, setBatchFileName] = useState("");
  const [batchRows, setBatchRows] = useState<BatchPreviewRow[]>([]);
  const [defaultIssuerUnit, setDefaultIssuerUnit] = useState("Trường Đại học");

  const [txLoading, setTxLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string; txHash?: string } | null>(null);

  const handleAdminLogout = () => {
    logoutUser();
    navigate("/auth");
  };

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

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI.abi, provider);
      const onChainAdmin: string = await contract.admin();
      setIsAuthorizedAdmin(accounts[0].toLowerCase() === onChainAdmin.toLowerCase());
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err?.message || "Kết nối ví thất bại." });
    }
  };

  const buildUniqueCertCode = (usedSet: Set<string>, startIndex: number): string => {
    const year = new Date().getFullYear();
    let generated = "";
    let attempt = startIndex;
    do {
      const seq = String(attempt).padStart(3, "0");
      const rand = Math.floor(100 + Math.random() * 900);
      generated = `CERT-${year}-${seq}${rand}`;
      attempt++;
    } while (usedSet.has(generated));
    usedSet.add(generated);
    return generated;
  };

  const handleGenerateCertCode = () => {
    const existingCodes = new Set(records.map((r) => r.certCode.trim().toUpperCase()));
    const generated = buildUniqueCertCode(existingCodes, records.length + 1);
    setCertCode(generated);
    setStatusMsg(null);
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

  // =========================================================================
  // XỬ LÝ FILE EXCEL CHO CẤP PHÁT HÀNG LOẠT (BATCH ISSUANCE)
  // =========================================================================
  const handleDownloadExcelTemplate = () => {
    const sampleData = [
      {
        MaChungChi: "",
        MaSinhVien: "HTTT2311021",
        HoTen: "Huỳnh Nguyễn Xuân Thi",
        TenKhoaHoc: "BLOCKCHAIN CĂN BẢN 2026",
        NgayCap: todayStr,
        DonViCap: defaultIssuerUnit,
      },
      {
        MaChungChi: "",
        MaSinhVien: "HTTT2311070",
        HoTen: "Phan Thanh Trúc",
        TenKhoaHoc: "BLOCKCHAIN CĂN BẢN 2026",
        NgayCap: todayStr,
        DonViCap: defaultIssuerUnit,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 16 },
      { wch: 26 },
      { wch: 30 },
      { wch: 14 },
      { wch: 32 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "DanhSachCapBang");
    XLSX.writeFile(workbook, "Mau_Cap_Phat_Chung_Chi_CertChain.xlsx");
  };

  const normalizeExcelDate = (raw: any): string => {
    if (!raw) return todayStr;
    if (typeof raw === "number") {
      const parsed = XLSX.SSF.parse_date_code(raw);
      if (parsed) {
        return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
      }
    }
    const str = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    }
    return str || todayStr;
  };

  const handleExcelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMsg(null);
    setBatchFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: "" });

      if (rawRows.length === 0) {
        setStatusMsg({ type: "error", text: "File Excel trống hoặc không có dòng dữ liệu nào!" });
        setBatchRows([]);
        return;
      }

      if (rawRows.length > 100) {
        setStatusMsg({ type: "error", text: "Smart Contract giới hạn tối đa 100 chứng chỉ mỗi lô!" });
        return;
      }

      const existingCodes = new Set(records.map((r) => r.certCode.trim().toUpperCase()));
      const seenInFile = new Set<string>();

      const parsedRows: BatchPreviewRow[] = rawRows.map((row, idx) => {
        const rawCode = String(
          row.MaChungChi ?? row.CertCode ?? row["Mã chứng chỉ"] ?? ""
        )
          .trim()
          .toUpperCase();

        const sCode = String(
          row.MaSinhVien ?? row.StudentCode ?? row["MSSV"] ?? row["Mã số sinh viên"] ?? ""
        )
          .trim()
          .toUpperCase();

        const rName = String(
          row.HoTen ?? row.RecipientName ?? row["Họ tên"] ?? row["Họ và tên"] ?? ""
        ).trim();

        const cName = String(
          row.TenKhoaHoc ?? row.CourseName ?? row["Tên khóa học"] ?? row["Khóa học"] ?? ""
        ).trim();

        const iDate = normalizeExcelDate(
          row.NgayCap ?? row.IssueDate ?? row["Ngày cấp"]
        );

        const iUnit =
          String(
            row.DonViCap ?? row.IssuerUnit ?? row["Đơn vị cấp"] ?? defaultIssuerUnit
          ).trim() || defaultIssuerUnit;

        const finalCode = rawCode || buildUniqueCertCode(existingCodes, records.length + idx + 1);
        const rowSalt = generateSalt();
        const rowHash = hashMetadataWithSalt(
          {
            certCode: finalCode,
            studentCode: sCode,
            recipientName: rName,
            courseName: cName,
            issueDate: iDate,
            issuerUnit: iUnit,
          },
          rowSalt
        );

        let error = "";
        if (!rName || !cName) {
          error = "Thiếu Họ tên hoặc Tên khóa học";
        } else if (existingCodes.has(finalCode) && rawCode) {
          error = "Trùng mã CC đã có trên hệ thống";
        } else if (seenInFile.has(finalCode)) {
          error = "Trùng mã CC trong file Excel";
        }

        seenInFile.add(finalCode);
        existingCodes.add(finalCode);

        return {
          certCode: finalCode,
          studentCode: sCode,
          recipientName: rName,
          courseName: cName,
          issueDate: iDate,
          issuerUnit: iUnit,
          salt: rowSalt,
          certHash: rowHash,
          error: error || undefined,
        };
      });

      setBatchRows(parsedRows);
    } catch (err: any) {
      setStatusMsg({ type: "error", text: "Không thể đọc file Excel: " + (err?.message || "Định dạng không hợp lệ") });
    }
  };

  const handleRemoveBatchRow = (index: number) => {
    setBatchRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleBatchIssueSubmit = async () => {
    setStatusMsg(null);
    if (batchRows.length === 0) {
      setStatusMsg({ type: "error", text: "Vui lòng tải lên danh sách Excel trước khi ký phát hành!" });
      return;
    }

    const invalidRow = batchRows.find((r) => r.error);
    if (invalidRow) {
      setStatusMsg({
        type: "error",
        text: `Dữ liệu có dòng lỗi (${invalidRow.certCode}: ${invalidRow.error}). Vui lòng xóa dòng lỗi hoặc sửa file Excel!`,
      });
      return;
    }

    try {
      setTxLoading(true);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI.abi, signer);

      const hashes = batchRows.map((item) => item.certHash);
      const payloads = batchRows.map((item) =>
        encodeOnChainPayload({
          certCode: item.certCode,
          recipientName: item.recipientName,
          courseName: item.courseName,
          issueDate: item.issueDate,
          issuerUnit: item.issuerUnit,
        })
      );

      const tx = await contract.issueBatchCertificates(hashes, payloads);
      setStatusMsg({
        type: "success",
        text: `Đang chờ Sepolia xác nhận lô ${batchRows.length} chứng chỉ...`,
        txHash: tx.hash,
      });

      await tx.wait();

      const savedRaw = localStorage.getItem(STORAGE_KEY);
      const localMap: Record<string, CertificateMetadata> = savedRaw ? JSON.parse(savedRaw) : {};
      for (const item of batchRows) {
        localMap[item.certHash] = {
          certCode: item.certCode,
          recipientName: item.recipientName,
          courseName: item.courseName,
          issueDate: item.issueDate,
          issuerUnit: item.issuerUnit,
          salt: item.salt,
          certHash: item.certHash,
          txHash: tx.hash,
        };
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localMap));

      const batchPayload = batchRows.map((item) => ({
        certCode: item.certCode,
        studentCode: item.studentCode,
        recipientName: item.recipientName,
        courseName: item.courseName,
        issueDate: item.issueDate,
        issuerUnit: item.issuerUnit,
        securityKey: item.salt,
        certHash: item.certHash,
      }));

      const apiRes = await fetch("http://localhost:4000/api/certificates/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificates: batchPayload,
          txHash: tx.hash,
        }),
      });

      const apiData = await apiRes.json();
      if (!apiRes.ok) {
        throw new Error(apiData.message || "Lỗi đồng bộ SQL Server hàng loạt");
      }

      setStatusMsg({
        type: "success",
        text: `Cấp phát hàng loạt thành công ${batchRows.length} chứng chỉ lên Blockchain & SQL Server!`,
        txHash: tx.hash,
      });

      setBatchRows([]);
      setBatchFileName("");
      await syncBlockchainData();
    } catch (err: any) {
      const reason = err?.reason || err?.shortMessage || err?.message || "Giao dịch cấp hàng loạt thất bại.";
      setStatusMsg({ type: "error", text: reason });
    } finally {
      setTxLoading(false);
    }
  };

  // =========================================================================
  // XỬ LÝ CẤP ĐƠN LẺ
  // =========================================================================
  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    const normalizedCertCode = certCode.trim().toUpperCase();

    if (!normalizedCertCode || !recipientName.trim() || !courseName.trim() || !issueDate || !issuerUnit.trim() || !issueFile || !issueHash) {
      setStatusMsg({ type: "error", text: "Vui lòng nhập đầy đủ thông tin và tải file chứng chỉ!" });
      return;
    }

    const isDuplicateCode = records.some(
      (item) => item.certCode.trim().toUpperCase() === normalizedCertCode
    );
    if (isDuplicateCode) {
      setStatusMsg({
        type: "error",
        text: `Mã chứng chỉ "${normalizedCertCode}" đã tồn tại trên hệ thống! Vui lòng đổi mã khác hoặc bấm nút "Tạo mã".`,
      });
      return;
    }

    try {
      setTxLoading(true);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI.abi, signer);

      const payload = encodeOnChainPayload({
        certCode: normalizedCertCode,
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

      const certRecord: CertificateMetadata & { studentCode?: string } = {
        certCode: normalizedCertCode,
        studentCode: studentCode.trim().toUpperCase(),
        recipientName: recipientName.trim(),
        courseName: courseName.trim(),
        issueDate,
        issuerUnit: issuerUnit.trim(),
        salt,
        certHash: issueHash,
        txHash: tx.hash,
      };

      const savedRaw = localStorage.getItem(STORAGE_KEY);
      const localMap: Record<string, CertificateMetadata> = savedRaw ? JSON.parse(savedRaw) : {};
      localMap[issueHash] = certRecord;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localMap));

      try {
        await saveCertificateToSQL(certRecord);
        setStatusMsg({
          type: "success",
          text: `Cấp chứng chỉ ${normalizedCertCode} lên Blockchain và lưu SQL Server thành công!`,
          txHash: tx.hash,
        });
      } catch (sqlErr: any) {
        console.error("Lỗi đồng bộ SQL Server:", sqlErr);
        setStatusMsg({
          type: "success",
          text: `Đã cấp trên Blockchain, nhưng lưu SQL Server báo lỗi: ${sqlErr.message}`,
          txHash: tx.hash,
        });
      }

      setCertCode("");
      setStudentCode("");
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
    if (!window.confirm(`Xác nhận thu hồi hiệu lực chứng chỉ "${code}" trên Blockchain & SQL Server?`)) return;
    setStatusMsg(null);
    try {
      setTxLoading(true);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI.abi, signer);

      const tx = await contract.revokeCertificate(certHash);
      setStatusMsg({ type: "success", text: "Đang gửi giao dịch thu hồi lên Sepolia...", txHash: tx.hash });
      await tx.wait();

      try {
        await revokeCertificateInSQL(certHash);
      } catch (sqlErr) {
        console.warn("Không thể cập nhật trạng thái thu hồi trên SQL Server:", sqlErr);
      }

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
          item.courseName.toLowerCase().includes(q) ||
          (item.studentCode || "").toLowerCase().includes(q);
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
      const iso = formatLocalDate(d);
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

  // Tổng hợp dữ liệu cho trang "Khóa học cấp phát"
  const allCourseSummaries = useMemo<CourseSummaryItem[]>(() => {
    const map: Record<string, CourseSummaryItem> = {};
    for (const r of records) {
      const key = (r.courseName || "Chưa phân loại").trim();
      if (!map[key]) {
        map[key] = {
          courseName: key,
          issuerUnit: r.issuerUnit || "Trường Đại học",
          total: 0,
          valid: 0,
          revoked: 0,
          latestIssueDate: r.issueDate || "",
          certificates: [],
        };
      }
      map[key].total += 1;
      if (r.isValid) {
        map[key].valid += 1;
      } else {
        map[key].revoked += 1;
      }
      if (r.issueDate && r.issueDate > map[key].latestIssueDate) {
        map[key].latestIssueDate = r.issueDate;
      }
      map[key].certificates.push(r);
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [records]);

  const filteredCourseSummaries = useMemo(() => {
    const q = courseSearch.toLowerCase().trim();
    if (!q) return allCourseSummaries;
    return allCourseSummaries.filter(
      (c) =>
        c.courseName.toLowerCase().includes(q) ||
        c.issuerUnit.toLowerCase().includes(q)
    );
  }, [allCourseSummaries, courseSearch]);

  const activeModalCourse = useMemo(() => {
    if (!selectedCourseModal) return null;
    return (
      allCourseSummaries.find((c) => c.courseName === selectedCourseModal.courseName) ||
      selectedCourseModal
    );
  }, [selectedCourseModal, allCourseSummaries]);

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
      item.courseName.toLowerCase().includes(q) ||
      (item.studentCode || "").toLowerCase().includes(q);
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
            <div className="text-xs font-semibold text-blue-600">
              {currentAdmin?.FullName || "Admin Dashboard"}
            </div>
          </div>
        </div>

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
            onClick={() => setActiveTab("courses")}
            className={`flex w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
              activeTab === "courses"
                ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-lg shadow-blue-500/25"
                : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
            }`}
          >
            <GraduationCap className="h-5 w-5" />
            Khóa học cấp phát
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

        <div className="space-y-2 border-t border-blue-100 pt-4">
          <Link
            to="/"
            className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
          >
            <span>Trang xác minh công khai</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>

          <button
            type="button"
            onClick={handleAdminLogout}
            className="flex w-full items-center justify-between rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
          >
            <span>Đăng xuất tài khoản</span>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Khu vực Nội dung Chính */}
      <main className="relative z-10 flex-1 px-6 py-6 lg:px-9">
        <div className="mx-auto max-w-6xl">
          <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div className="flex w-full max-w-xs items-center gap-2.5 rounded-2xl border border-blue-200/80 bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur-xl focus-within:border-blue-500">
              <input
                type="text"
                placeholder="Tìm mã CC, MSSV, học viên..."
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
                  <span className="font-mono text-xs font-bold text-slate-900" title="Địa chỉ ví đã được ẩn để bảo mật">
                    0x••••...••••
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
                Ví hiện tại không có quyền Quản trị viên (Admin) của Smart Contract. Vui lòng kết nối đúng ví được cấp quyền!
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
                        title="Đồng bộ dữ liệu từ SQL Server & Blockchain"
                        className="flex h-9 w-9 items-center justify-center rounded-2xl border border-blue-200/80 bg-white/90 text-slate-700 shadow-sm transition hover:text-blue-600"
                      >
                        <RefreshCw className={`h-4 w-4 ${loadingData ? "animate-spin text-blue-600" : ""}`} />
                      </button>
                    </div>
                  </div>

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
                          onClick={() => setActiveTab("courses")}
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
                          placeholder="Tìm theo mã chứng chỉ, MSSV, họ tên hoặc tên khóa học..."
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
                            <th className="pb-3.5">MSSV</th>
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
                              <td className="py-3.5 font-mono text-xs font-bold text-slate-600">
                                {item.studentCode || "—"}
                              </td>
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
              {/* TRANG 3: KHÓA HỌC ĐÃ CẤP PHÁT                                         */}
              {/* ===================================================================== */}
              {activeTab === "courses" && (
                <div>
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-black text-slate-900">Khóa Học Đã Cấp Phát</h1>
                      <p className="text-xs font-medium text-slate-600">
                        Thống kê chương trình đào tạo và danh sách học viên được cấp chứng chỉ theo từng khóa
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("issue")}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:opacity-95"
                    >
                      <FilePlus2 className="h-4 w-4" />
                      + Cấp chứng chỉ mới
                    </button>
                  </div>

                  {/* 3 Thẻ thống kê nhanh */}
                  <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <div className="flex items-center gap-4 rounded-3xl border border-blue-200/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                        <GraduationCap className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-2xl font-black text-slate-900">{allCourseSummaries.length}</div>
                        <div className="text-xs font-bold text-slate-600">Tổng khóa học đã cấp</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-3xl border border-blue-200/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                        <Users className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-2xl font-black text-slate-900">{records.length}</div>
                        <div className="text-xs font-bold text-slate-600">Tổng lượt học viên nhận bằng</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-3xl border border-blue-200/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                        <Award className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-2xl font-black text-slate-900">
                          {records.filter((r) => r.isValid).length}
                        </div>
                        <div className="text-xs font-bold text-slate-600">Chứng chỉ đang hiệu lực</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-blue-200/80 bg-white/95 p-6 shadow-sm backdrop-blur-xl">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-1 min-w-[260px] items-center gap-2.5 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 focus-within:border-blue-600 focus-within:bg-white">
                        <Search className="h-4 w-4 text-blue-600" />
                        <input
                          type="text"
                          placeholder="Tìm tên khóa học hoặc đơn vị cấp..."
                          value={courseSearch}
                          onChange={(e) => setCourseSearch(e.target.value)}
                          className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
                        />
                      </div>
                      <div className="text-xs font-bold text-slate-500">
                        Hiển thị {filteredCourseSummaries.length} / {allCourseSummaries.length} khóa học
                      </div>
                    </div>

                    {filteredCourseSummaries.length === 0 ? (
                      <div className="py-12 text-center text-sm font-medium text-slate-500">
                        Chưa có dữ liệu khóa học nào phù hợp.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {filteredCourseSummaries.map((course) => {
                          const validRate =
                            course.total > 0 ? Math.round((course.valid / course.total) * 100) : 0;
                          return (
                            <div
                              key={course.courseName}
                              className="flex flex-col justify-between rounded-2xl border border-blue-100 bg-gradient-to-b from-white to-blue-50/40 p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                            >
                              <div>
                                <div className="mb-3 flex items-start justify-between gap-2">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                                    <Award className="h-5 w-5" />
                                  </div>
                                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-extrabold text-sky-800">
                                    {course.total} chứng chỉ
                                  </span>
                                </div>

                                <h3 className="line-clamp-2 text-base font-extrabold text-slate-900">
                                  {course.courseName}
                                </h3>

                                <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                  <Building2 className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                                  <span className="truncate">{course.issuerUnit}</span>
                                </div>

                                <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                  <Calendar className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                                  <span>Cấp gần nhất: {course.latestIssueDate || "—"}</span>
                                </div>

                                {/* Thanh tỷ lệ hiệu lực */}
                                <div className="mt-4">
                                  <div className="mb-1 flex justify-between text-[11px] font-bold">
                                    <span className="text-emerald-700">Hợp lệ: {course.valid}</span>
                                    <span className="text-rose-600">Thu hồi: {course.revoked}</span>
                                  </div>
                                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                                      style={{ width: `${validRate}%` }}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="mt-5 flex items-center gap-2 border-t border-blue-100 pt-3.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedCourseModal(course)}
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
                                >
                                  <Users className="h-3.5 w-3.5" />
                                  Xem học viên ({course.total})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCourseName(course.courseName);
                                    setIssuerUnit(course.issuerUnit);
                                    setIssueMode("single");
                                    setActiveTab("issue");
                                  }}
                                  title="Cấp thêm chứng chỉ cho khóa học này"
                                  className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50"
                                >
                                  + Cấp thêm
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Modal xem chi tiết danh sách học viên của khóa học */}
                  {activeModalCourse && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
                      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-sky-50 px-6 py-5">
                          <div>
                            <div className="text-xs font-extrabold tracking-wider text-blue-600 uppercase">
                              Danh sách chứng chỉ theo khóa học
                            </div>
                            <h3 className="mt-0.5 text-lg font-black text-slate-900">
                              {activeModalCourse.courseName}
                            </h3>
                            <p className="mt-0.5 text-xs font-medium text-slate-600">
                              Đơn vị cấp: <span className="font-bold">{activeModalCourse.issuerUnit}</span> • Tổng cộng:{" "}
                              <span className="font-bold text-blue-700">{activeModalCourse.total}</span> chứng chỉ
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedCourseModal(null)}
                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex-1 overflow-auto p-6">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 text-xs font-extrabold text-slate-500 uppercase">
                                <th className="pb-3">Mã CC</th>
                                <th className="pb-3">MSSV</th>
                                <th className="pb-3">Họ và tên</th>
                                <th className="pb-3">Ngày cấp</th>
                                <th className="pb-3">Trạng thái</th>
                                <th className="pb-3 text-right">Thao tác</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {activeModalCourse.certificates.map((cert) => (
                                <tr key={cert.certHash} className="hover:bg-blue-50/50">
                                  <td className="py-3 font-mono text-xs font-extrabold text-blue-700">
                                    {cert.certCode}
                                  </td>
                                  <td className="py-3 font-mono text-xs font-bold text-slate-600">
                                    {cert.studentCode || "—"}
                                  </td>
                                  <td className="py-3 font-bold text-slate-900">{cert.recipientName}</td>
                                  <td className="py-3 text-xs font-medium text-slate-600">{cert.issueDate}</td>
                                  <td className="py-3">
                                    <span
                                      className={`inline-block rounded-lg px-2.5 py-0.5 text-[11px] font-bold text-white ${
                                        cert.isValid ? "bg-emerald-600" : "bg-rose-600"
                                      }`}
                                    >
                                      {cert.isValid ? "Còn hiệu lực" : "Đã thu hồi"}
                                    </span>
                                  </td>
                                  <td className="py-3 text-right whitespace-nowrap">
                                    <Link
                                      to={`/certificate/${encodeURIComponent(cert.certCode)}`}
                                      target="_blank"
                                      className="inline-flex items-center gap-1 rounded-xl bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-200"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Xem bằng
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===================================================================== */}
              {/* TRANG 4: CẤP CHỨNG CHỈ MỚI (ĐƠN LẺ & HÀNG LOẠT EXCEL)                 */}
              {/* ===================================================================== */}
              {activeTab === "issue" && (
                <div>
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-black text-slate-900">Cấp Phát Chứng Chỉ Mới</h1>
                      <p className="text-xs font-medium text-slate-600">
                        Băm dữ liệu văn bằng, ký phát hành lên Ethereum Sepolia và lưu vào SQL Server
                      </p>
                    </div>

                    <div className="flex rounded-2xl border border-blue-200/80 bg-white/95 p-1 shadow-sm">
                      <button
                        type="button"
                        onClick={() => {
                          setIssueMode("single");
                          setStatusMsg(null);
                        }}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
                          issueMode === "single"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-700 hover:bg-blue-50"
                        }`}
                      >
                        <FilePlus2 className="h-4 w-4" />
                        Cấp đơn lẻ (Kèm tệp gốc)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIssueMode("batch");
                          setStatusMsg(null);
                        }}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
                          issueMode === "batch"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-700 hover:bg-blue-50"
                        }`}
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        Cấp hàng loạt (Import Excel)
                      </button>
                    </div>
                  </div>

                  {issueMode === "single" ? (
                    <form
                      onSubmit={handleIssueSubmit}
                      className="max-w-3xl space-y-5 rounded-3xl border border-blue-200/80 bg-white/95 p-8 shadow-lg backdrop-blur-xl"
                    >
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-extrabold text-slate-700 uppercase">Mã chứng chỉ *</label>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              placeholder="VD: CERT-2026-001"
                              value={certCode}
                              onChange={(e) => setCertCode(e.target.value.toUpperCase())}
                              className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-3.5 py-3 font-mono text-sm font-semibold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleGenerateCertCode}
                              title="Tự động tạo mã chứng chỉ duy nhất"
                              className="inline-flex shrink-0 items-center gap-1 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                            >
                              <Wand2 className="h-3.5 w-3.5" />
                              <span>Tạo mã</span>
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-extrabold text-slate-700 uppercase">Mã số sinh viên</label>
                          <input
                            type="text"
                            placeholder="VD: SV2026001"
                            value={studentCode}
                            onChange={(e) => setStudentCode(e.target.value)}
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
                  ) : (
                    /* =============================================================== */
                    /* GIAO DIỆN CẤP PHÁT HÀNG LOẠT TỪ EXCEL                           */
                    /* =============================================================== */
                    <div className="space-y-6 rounded-3xl border border-blue-200/80 bg-white/95 p-8 shadow-lg backdrop-blur-xl">
                      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
                        <div className="flex-1 min-w-[260px]">
                          <label className="mb-1.5 block text-xs font-extrabold text-slate-700 uppercase">
                            Đơn vị cấp mặc định (nếu cột DonViCap trong Excel để trống)
                          </label>
                          <input
                            type="text"
                            value={defaultIssuerUnit}
                            onChange={(e) => setDefaultIssuerUnit(e.target.value)}
                            className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleDownloadExcelTemplate}
                          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-extrabold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <Download className="h-4 w-4" />
                          Tải file Excel mẫu (.xlsx)
                        </button>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-extrabold text-slate-700 uppercase">
                          Tải lên danh sách sinh viên (.xlsx, .xls, .csv) — Tối đa 100 dòng / lô
                        </label>
                        <div className="relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/60 p-8 text-center transition hover:bg-blue-100/70">
                          <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                          <div className="text-sm font-extrabold text-blue-800">
                            {batchFileName ? `Đã chọn: ${batchFileName}` : "Bấm để chọn file Excel danh sách cấp chứng chỉ"}
                          </div>
                          <div className="text-xs font-medium text-slate-500">
                            Hệ thống tự động sinh mã chứng chỉ (nếu để trống), tạo Security Key và băm Keccak-256 cho từng dòng
                          </div>
                          <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleExcelFileUpload}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          />
                        </div>
                      </div>

                      {batchRows.length > 0 && (
                        <div>
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-extrabold text-slate-900">
                              Xem trước dữ liệu ({batchRows.length} chứng chỉ)
                            </h3>
                            <button
                              type="button"
                              onClick={() => {
                                setBatchRows([]);
                                setBatchFileName("");
                              }}
                              className="text-xs font-bold text-rose-600 hover:underline"
                            >
                              Xóa danh sách
                            </button>
                          </div>

                          <div className="max-h-96 overflow-auto rounded-2xl border border-slate-200">
                            <table className="w-full text-left text-xs">
                              <thead className="sticky top-0 bg-slate-100 font-extrabold text-slate-600 uppercase">
                                <tr>
                                  <th className="p-3">#</th>
                                  <th className="p-3">Mã CC</th>
                                  <th className="p-3">MSSV</th>
                                  <th className="p-3">Họ tên</th>
                                  <th className="p-3">Khóa học</th>
                                  <th className="p-3">Ngày cấp</th>
                                  <th className="p-3">Mã Hash (Keccak-256)</th>
                                  <th className="p-3">Trạng thái</th>
                                  <th className="p-3 text-right">Xóa</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {batchRows.map((row, idx) => (
                                  <tr key={idx} className={row.error ? "bg-rose-50/80" : "hover:bg-blue-50/50"}>
                                    <td className="p-3 font-bold text-slate-500">{idx + 1}</td>
                                    <td className="p-3 font-mono font-extrabold text-blue-700">{row.certCode}</td>
                                    <td className="p-3 font-mono font-semibold text-slate-700">{row.studentCode || "—"}</td>
                                    <td className="p-3 font-bold text-slate-900">{row.recipientName || "—"}</td>
                                    <td className="p-3 font-medium text-slate-700">{row.courseName || "—"}</td>
                                    <td className="p-3 font-medium text-slate-600">{row.issueDate}</td>
                                    <td className="p-3 font-mono text-[11px] text-slate-500">
                                      {row.certHash.slice(0, 10)}...{row.certHash.slice(-6)}
                                    </td>
                                    <td className="p-3">
                                      {row.error ? (
                                        <span className="inline-block rounded-lg bg-rose-100 px-2 py-0.5 font-bold text-rose-700">
                                          {row.error}
                                        </span>
                                      ) : (
                                        <span className="inline-block rounded-lg bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">
                                          Hợp lệ
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveBatchRow(idx)}
                                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <button
                            type="button"
                            onClick={handleBatchIssueSubmit}
                            disabled={txLoading}
                            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-blue-500/25 transition hover:opacity-95 disabled:opacity-60"
                          >
                            {txLoading
                              ? "Đang chờ xác nhận lô giao dịch từ MetaMask..."
                              : `Ký phát hành hàng loạt ${batchRows.length} chứng chỉ (1 giao dịch MetaMask)`}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}