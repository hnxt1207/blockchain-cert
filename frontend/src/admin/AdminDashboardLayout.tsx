import React, { useState, useEffect } from "react";
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

export default function AdminDashboardLayout() {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");

  // Trạng thái ví & mạng Blockchain
  const [walletAddress, setWalletAddress] = useState("");
  const [networkName, setNetworkName] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState(false);
  const [contractAdminAddress, setContractAdminAddress] = useState("");

  // Dữ liệu chung cho Dashboard & Quản lý chứng chỉ
  const [records, setRecords] = useState<FullCertificateRecord[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Bộ lọc & tìm kiếm ở Trang 2 (Quản lý chứng chỉ)
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "valid" | "revoked">("all");

  // Form Trang 3 (Cấp chứng chỉ)
  const [certCode, setCertCode] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [issuerUnit, setIssuerUnit] = useState("Trường Đại học");
  const [issueFile, setIssueFile] = useState<File | null>(null);
  const [salt, setSalt] = useState("");
  const [issueHash, setIssueHash] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);

  // Trạng thái giao dịch
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
          ? "Ethereum Sepolia Testnet"
          : `${network.name} (Chain ID: ${currentChainId})`
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

  // Thống kê cho Trang 1 (Dashboard)
  const totalIssued = records.length;
  const totalValid = records.filter((r) => r.isValid).length;
  const totalRevoked = records.filter((r) => !r.isValid).length;

  // Lọc danh sách cho Trang 2 (Quản lý chứng chỉ)
  const filteredRecords = records.filter((item) => {
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

  return (
    <div style={styles.layout}>
      {/* Sidebar Điều hướng 3 Trang Quản trị */}
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <ShieldCheck size={24} color="#38bdf8" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>CERT-CHAIN</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Admin Portal</div>
          </div>
        </div>

        <nav style={styles.navMenu}>
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            style={activeTab === "dashboard" ? styles.navItemActive : styles.navItem}
          >
            <LayoutDashboard size={18} /> 1. Dashboard quản trị
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("manage")}
            style={activeTab === "manage" ? styles.navItemActive : styles.navItem}
          >
            <ListChecks size={18} /> 2. Quản lý chứng chỉ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("issue")}
            style={activeTab === "issue" ? styles.navItemActive : styles.navItem}
          >
            <FilePlus2 size={18} /> 3. Cấp chứng chỉ
          </button>
        </nav>

        <div style={styles.sidebarFooter}>
          <Link to="/" style={styles.publicPortalLink}>
            Sang cổng Xác minh công khai &rarr;
          </Link>
        </div>
      </aside>

      {/* Nội dung chính */}
      <main style={styles.mainContent}>
        {/* Thanh trạng thái ví MetaMask trên cùng */}
        <div style={styles.topBar}>
          {!walletAddress ? (
            <button onClick={connectAdminWallet} style={styles.connectBtn}>
              <Wallet size={17} /> Kết nối ví Quản trị (MetaMask)
            </button>
          ) : (
            <div style={styles.walletStatusRow}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Globe size={16} color={chainId === 11155111 ? "#16a34a" : "#dc2626"} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{networkName}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <code style={styles.walletBadge}>{walletAddress}</code>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: isAuthorizedAdmin ? "#dcfce7" : "#fee2e2",
                    color: isAuthorizedAdmin ? "#166534" : "#991b1b",
                  }}
                >
                  {isAuthorizedAdmin ? "Admin hợp lệ" : "Không có quyền Admin"}
                </span>
              </div>
            </div>
          )}
        </div>

        {walletAddress && !isAuthorizedAdmin && chainId === 11155111 && (
          <div style={styles.errorBanner}>
            <AlertTriangle size={20} />
            <span>
              Ví hiện tại không khớp với địa chỉ Admin của Smart Contract (<code>{contractAdminAddress}</code>).
            </span>
          </div>
        )}

        {statusMsg && (
          <div
            style={{
              ...styles.alertBox,
              background: statusMsg.type === "success" ? "#f0fdf4" : "#fef2f2",
              borderColor: statusMsg.type === "success" ? "#bbf7d0" : "#fecaca",
              color: statusMsg.type === "success" ? "#166534" : "#991b1b",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
              {statusMsg.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              <span>{statusMsg.text}</span>
            </div>
            {statusMsg.txHash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${statusMsg.txHash}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-block", marginTop: 4, fontSize: 13, color: "#1d4ed8" }}
              >
                Xem giao dịch trên Sepolia Etherscan &rarr;
              </a>
            )}
          </div>
        )}

        {!isAuthorizedAdmin ? (
          <div style={styles.lockedCard}>
            <Wallet size={42} color="#94a3b8" />
            <h3 style={{ margin: "12px 0 6px" }}>Yêu cầu xác thực ví Quản trị</h3>
            <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
              Vui lòng kết nối đúng ví MetaMask của đơn vị cấp phát trên mạng Sepolia để truy cập Dashboard, Quản lý và Cấp chứng chỉ.
            </p>
          </div>
        ) : (
          <>
            {/* =========================================================
                TRANG 1: DASHBOARD QUẢN TRỊ
            ========================================================= */}
            {activeTab === "dashboard" && (
              <div>
                <div style={styles.pageHeader}>
                  <h1 style={styles.pageTitle}>Dashboard Quản Trị Hệ Thống</h1>
                  <button type="button" onClick={syncBlockchainData} style={styles.refreshBtn}>
                    <RefreshCw size={15} /> {loadingData ? "Đang đồng bộ..." : "Cập nhật dữ liệu"}
                  </button>
                </div>

                {/* 4 Thẻ thống kê tổng quan */}
                <div style={styles.statsGrid}>
                  <div style={styles.statCard}>
                    <div style={{ ...styles.statIcon, background: "#eff6ff", color: "#2563eb" }}>
                      <FileText size={22} />
                    </div>
                    <div>
                      <div style={styles.statNumber}>{totalIssued}</div>
                      <div style={styles.statLabel}>Tổng số chứng chỉ đã cấp</div>
                    </div>
                  </div>

                  <div style={styles.statCard}>
                    <div style={{ ...styles.statIcon, background: "#f0fdf4", color: "#16a34a" }}>
                      <ShieldCheck size={22} />
                    </div>
                    <div>
                      <div style={styles.statNumber}>{totalValid}</div>
                      <div style={styles.statLabel}>Chứng chỉ còn hiệu lực</div>
                    </div>
                  </div>

                  <div style={styles.statCard}>
                    <div style={{ ...styles.statIcon, background: "#fef2f2", color: "#dc2626" }}>
                      <ShieldAlert size={22} />
                    </div>
                    <div>
                      <div style={styles.statNumber}>{totalRevoked}</div>
                      <div style={styles.statLabel}>Chứng chỉ đã thu hồi</div>
                    </div>
                  </div>

                  <div style={styles.statCard}>
                    <div style={{ ...styles.statIcon, background: "#fff7ed", color: "#ea580c" }}>
                      <Wallet size={22} />
                    </div>
                    <div style={{ overflow: "hidden" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "#0f172a" }}>
                        {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
                      </div>
                      <div style={styles.statLabel}>Địa chỉ ví quản trị</div>
                    </div>
                  </div>
                </div>

                {/* Bảng Giao dịch gần đây */}
                <div style={styles.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h2 style={{ margin: 0, fontSize: 17 }}>Giao dịch cấp phát gần đây</h2>
                    <button type="button" onClick={() => setActiveTab("manage")} style={styles.linkBtn}>
                      Xem tất cả &rarr;
                    </button>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Mã chứng chỉ</th>
                          <th style={styles.th}>Người nhận</th>
                          <th style={styles.th}>Ngày cấp</th>
                          <th style={styles.th}>Mã giao dịch (Tx Hash)</th>
                          <th style={styles.th}>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.slice(0, 5).map((item) => (
                          <tr key={item.certHash} style={styles.tr}>
                            <td style={{ ...styles.td, fontWeight: 700 }}>{item.certCode}</td>
                            <td style={styles.td}>{item.recipientName}</td>
                            <td style={styles.td}>{item.issueDate}</td>
                            <td style={styles.td}>
                              {item.txHash ? (
                                <a
                                  href={`https://sepolia.etherscan.io/tx/${item.txHash}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: "#2563eb", textDecoration: "none", fontFamily: "monospace", fontSize: 12 }}
                                >
                                  {item.txHash.slice(0, 12)}... <ExternalLink size={12} />
                                </a>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: 12 }}>Đã ghi On-chain</span>
                              )}
                            </td>
                            <td style={styles.td}>
                              <span style={item.isValid ? styles.badgeValid : styles.badgeRevoked}>
                                {item.isValid ? "Còn hiệu lực" : "Đã thu hồi"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================
                TRANG 2: QUẢN LÝ CHỨNG CHỈ
            ========================================================= */}
            {activeTab === "manage" && (
              <div>
                <div style={styles.pageHeader}>
                  <h1 style={styles.pageTitle}>Quản Lý Danh Sách Chứng Chỉ</h1>
                  <button type="button" onClick={() => setActiveTab("issue")} style={styles.primaryActionBtn}>
                    <FilePlus2 size={16} /> + Cấp chứng chỉ mới
                  </button>
                </div>

                <div style={styles.card}>
                  {/* Thanh Tìm kiếm + Lọc trạng thái */}
                  <div style={styles.filterBar}>
                    <div style={styles.searchBox}>
                      <Search size={17} color="#64748b" />
                      <input
                        type="text"
                        placeholder="Tìm theo mã chứng chỉ, họ tên hoặc tên khóa học..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={styles.searchInput}
                      />
                    </div>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      style={styles.selectInput}
                    >
                      <option value="all">Tất cả trạng thái ({records.length})</option>
                      <option value="valid">Còn hiệu lực ({totalValid})</option>
                      <option value="revoked">Đã thu hồi ({totalRevoked})</option>
                    </select>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Mã chứng chỉ</th>
                          <th style={styles.th}>Họ và tên</th>
                          <th style={styles.th}>Khóa học</th>
                          <th style={styles.th}>Ngày cấp</th>
                          <th style={styles.th}>Trạng thái</th>
                          <th style={styles.th}>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecords.map((item) => (
                          <tr key={item.certHash} style={styles.tr}>
                            <td style={{ ...styles.td, fontWeight: 700 }}>{item.certCode}</td>
                            <td style={styles.td}>{item.recipientName}</td>
                            <td style={styles.td}>{item.courseName}</td>
                            <td style={styles.td}>{item.issueDate}</td>
                            <td style={styles.td}>
                              <span style={item.isValid ? styles.badgeValid : styles.badgeRevoked}>
                                {item.isValid ? "Còn hiệu lực" : "Đã thu hồi"}
                              </span>
                            </td>
                            <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                              {/* Mở sang Trang 5: Chi tiết chứng chỉ */}
                              <Link
                                to={`/certificate/${encodeURIComponent(item.certCode)}`}
                                target="_blank"
                                style={styles.viewDetailLink}
                              >
                                <Eye size={14} /> Xem chi tiết
                              </Link>

                              {item.isValid && (
                                <button
                                  type="button"
                                  onClick={() => handleRevoke(item.certHash, item.certCode)}
                                  disabled={txLoading}
                                  style={styles.revokeBtn}
                                >
                                  <Ban size={14} /> Thu hồi
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

            {/* =========================================================
                TRANG 3: CẤP CHỨNG CHỈ
            ========================================================= */}
            {activeTab === "issue" && (
              <div>
                <div style={styles.pageHeader}>
                  <h1 style={styles.pageTitle}>Cấp Phát Chứng Chỉ Mới</h1>
                </div>

                <form onSubmit={handleIssueSubmit} style={styles.card}>
                  <div style={styles.grid2}>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Mã chứng chỉ *</label>
                      <input
                        type="text"
                        placeholder="VD: CERT-2026-001"
                        value={certCode}
                        onChange={(e) => setCertCode(e.target.value)}
                        style={styles.input}
                      />
                    </div>

                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Họ tên người nhận *</label>
                      <input
                        type="text"
                        placeholder="VD: Nguyễn Văn An"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        style={styles.input}
                      />
                    </div>
                  </div>

                  <div style={styles.grid2}>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Tên khóa học *</label>
                      <input
                        type="text"
                        placeholder="VD: Công nghệ Blockchain & Web3"
                        value={courseName}
                        onChange={(e) => setCourseName(e.target.value)}
                        style={styles.input}
                      />
                    </div>

                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Ngày cấp *</label>
                      <input
                        type="date"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                        style={styles.input}
                      />
                    </div>
                  </div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Đơn vị cấp *</label>
                    <input
                      type="text"
                      placeholder="VD: Trường Đại học..."
                      value={issuerUnit}
                      onChange={(e) => setIssuerUnit(e.target.value)}
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Tệp chứng chỉ gốc (PDF / Ảnh) *</label>
                    <div style={styles.uploadBox}>
                      <Upload size={22} color="#0f766e" />
                      <span>{issueFile ? issueFile.name : "Chọn file chứng chỉ để tạo mã Hash"}</span>
                      <input type="file" onChange={handleFileChange} style={styles.fileInput} />
                    </div>
                  </div>

                  {salt && (
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Mã xác thực đi kèm (Security Key):</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          type="text"
                          readOnly
                          value={salt}
                          style={{ ...styles.input, fontFamily: "monospace", background: "#f8fafc" }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(salt);
                            setCopiedKey(true);
                            setTimeout(() => setCopiedKey(false), 2000);
                          }}
                          style={styles.copyBtn}
                        >
                          {copiedKey ? <Check size={16} color="#16a34a" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {issueHash && (
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Mã Hash (Keccak-256) ghi lên Smart Contract:</label>
                      <code style={styles.hashBox}>{issueHash}</code>
                    </div>
                  )}

                  <button type="submit" disabled={txLoading} style={styles.submitIssueBtn}>
                    {txLoading ? "Đang chờ xác nhận từ MetaMask..." : "Tạo & Xác nhận cấp chứng chỉ bằng MetaMask"}
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: "flex",
    minHeight: "100vh",
    background: "#f1f5f9",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#0f172a",
  },
  sidebar: {
    width: 250,
    background: "#0f172a",
    color: "#f8fafc",
    display: "flex",
    flexDirection: "column",
    padding: "24px 16px",
    flexShrink: 0,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    paddingBottom: 20,
    borderBottom: "1px solid #1e293b",
    marginBottom: 20,
  },
  navMenu: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    flex: 1,
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "11px 14px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
  },
  navItemActive: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "11px 14px",
    borderRadius: 10,
    border: "none",
    background: "#1e293b",
    color: "#38bdf8",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
  },
  sidebarFooter: {
    paddingTop: 16,
    borderTop: "1px solid #1e293b",
  },
  publicPortalLink: {
    color: "#94a3b8",
    textDecoration: "none",
    fontSize: 13,
  },
  mainContent: {
    flex: 1,
    padding: "24px 32px",
    maxWidth: 1100,
  },
  topBar: {
    background: "#ffffff",
    padding: "14px 20px",
    borderRadius: 14,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    marginBottom: 24,
  },
  connectBtn: {
    background: "#f97316",
    color: "#fff",
    border: "none",
    padding: "10px 18px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  walletStatusRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  walletBadge: {
    background: "#f1f5f9",
    padding: "4px 10px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
  },
  errorBanner: {
    background: "#fef2f2",
    color: "#b91c1c",
    padding: 14,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
    fontSize: 14,
  },
  alertBox: {
    padding: 14,
    borderRadius: 12,
    border: "1px solid",
    marginBottom: 20,
  },
  lockedCard: {
    background: "#ffffff",
    padding: "60px 20px",
    borderRadius: 16,
    textAlign: "center",
  },
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  pageTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
  },
  refreshBtn: {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    padding: "8px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  primaryActionBtn: {
    background: "#0f766e",
    color: "#fff",
    border: "none",
    padding: "10px 16px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    background: "#ffffff",
    padding: 20,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    gap: 14,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  statIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 800,
    color: "#0f172a",
  },
  statLabel: {
    fontSize: 13,
    color: "#64748b",
  },
  card: {
    background: "#ffffff",
    padding: 24,
    borderRadius: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  linkBtn: {
    background: "transparent",
    border: "none",
    color: "#2563eb",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  filterBar: {
    display: "flex",
    gap: 12,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  searchBox: {
    flex: 1,
    minWidth: 240,
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "8px 12px",
    background: "#f8fafc",
  },
  searchInput: {
    border: "none",
    outline: "none",
    background: "transparent",
    width: "100%",
    fontSize: 14,
  },
  selectInput: {
    padding: "9px 14px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    background: "#ffffff",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    borderBottom: "2px solid #e2e8f0",
    color: "#475569",
    fontSize: 13,
  },
  tr: {
    borderBottom: "1px solid #f1f5f9",
  },
  td: {
    padding: "12px",
  },
  badgeValid: {
    background: "#dcfce7",
    color: "#166534",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
  },
  badgeRevoked: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
  },
  viewDetailLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "5px 10px",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    textDecoration: "none",
    marginRight: 6,
  },
  revokeBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "5px 10px",
    background: "#fef2f2",
    color: "#dc2626",
    border: "1px solid #fecaca",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    color: "#334155",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    boxSizing: "border-box",
  },
  uploadBox: {
    position: "relative",
    border: "2px dashed #5eead4",
    background: "#f0fdfa",
    borderRadius: 10,
    padding: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    cursor: "pointer",
  },
  fileInput: {
    position: "absolute",
    inset: 0,
    opacity: 0,
    cursor: "pointer",
    width: "100%",
  },
  copyBtn: {
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    cursor: "pointer",
  },
  hashBox: {
    display: "block",
    background: "#f1f5f9",
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 12,
    wordBreak: "break-all",
  },
  submitIssueBtn: {
    width: "100%",
    padding: "13px 20px",
    background: "#0f766e",
    color: "#ffffff",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
};