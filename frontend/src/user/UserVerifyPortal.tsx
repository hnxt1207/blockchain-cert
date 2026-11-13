import React, { useState, useEffect } from "react";
import { JsonRpcProvider, Contract } from "ethers";
import {
  ShieldCheck,
  ShieldAlert,
  Upload,
  Search,
  FileCheck2,
  ExternalLink,
  KeyRound,
  Hash,
} from "lucide-react";
import { CONTRACT_ADDRESS, CONTRACT_ABI, SEPOLIA_RPC_URL } from "../shared/contractConfig";
import {
  type CertificateMetadata,
  hashCertificateWithSalt,
  decodeOnChainPayload,
} from "../shared/hashHelper";

const STORAGE_KEY = "blockchain_issued_certificates_v1";

interface VerifyResult {
  exists: boolean;
  certCode: string;
  recipientName: string;
  courseName: string;
  issueDate: string;
  issuerUnit: string;
  issuedAtOnChain: number;
  isValid: boolean;
  certHash: string;
}

export default function UserVerifyPortal() {
  const [mode, setMode] = useState<"code" | "file">("code");

  // Chế độ 1: Nhập Mã chứng chỉ (không cần nhớ mã bảo mật)
  const [certCodeInput, setCertCodeInput] = useState("");

  // Chế độ 2: Đối chiếu File gốc + Mã xác thực (tự điền khi quét QR)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [securityKey, setSecurityKey] = useState("");
  const [computedHash, setComputedHash] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState("");

  const verifyHashOnChain = async (hashToCheck: string) => {
    const provider = new JsonRpcProvider(SEPOLIA_RPC_URL);
    const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    const [exists, rawStudentId, issuedAt, isValid] = await contract.verifyCertificate(hashToCheck);
    if (!exists) {
      setResult({
        exists: false,
        certCode: "",
        recipientName: "",
        courseName: "",
        issueDate: "",
        issuerUnit: "",
        issuedAtOnChain: 0,
        isValid: false,
        certHash: hashToCheck,
      });
      return;
    }

    const decoded = decodeOnChainPayload(rawStudentId);
    setResult({
      exists: true,
      certCode: decoded.certCode,
      recipientName: decoded.recipientName,
      courseName: decoded.courseName,
      issueDate:
        decoded.issueDate || new Date(Number(issuedAt) * 1000).toISOString().split("T")[0],
      issuerUnit: decoded.issuerUnit,
      issuedAtOnChain: Number(issuedAt),
      isValid: Boolean(isValid),
      certHash: hashToCheck,
    });
  };

  const verifyByCertCode = async (codeToSearch: string) => {
    setError("");
    setResult(null);
    const normalizedCode = codeToSearch.trim().toLowerCase();

    if (!normalizedCode) {
      setError("Vui lòng nhập Mã chứng chỉ cần xác minh!");
      return;
    }

    try {
      setLoading(true);

      const savedRaw = localStorage.getItem(STORAGE_KEY);
      const localMap: Record<string, CertificateMetadata> = savedRaw ? JSON.parse(savedRaw) : {};
      const localMatch = Object.values(localMap).find(
        (item) => item.certCode.trim().toLowerCase() === normalizedCode
      );

      if (localMatch) {
        await verifyHashOnChain(localMatch.certHash);
        return;
      }

      const provider = new JsonRpcProvider(SEPOLIA_RPC_URL);
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const filter = contract.filters.CertificateIssued();
      const events = await contract.queryFilter(filter, -50000);

      let matchedHash = "";
      for (const ev of events) {
        if ("args" in ev && ev.args) {
          const evHash = ev.args[0] as string;
          const evPayload = ev.args[1] as string;
          const decoded = decodeOnChainPayload(evPayload);
          if (decoded.certCode.trim().toLowerCase() === normalizedCode) {
            matchedHash = evHash;
            break;
          }
        }
      }

      if (!matchedHash) {
        setResult({
          exists: false,
          certCode: codeToSearch.trim(),
          recipientName: "",
          courseName: "",
          issueDate: "",
          issuerUnit: "",
          issuedAtOnChain: 0,
          isValid: false,
          certHash: "",
        });
        return;
      }

      await verifyHashOnChain(matchedHash);
    } catch (err) {
      console.error(err);
      setError("Không thể kết nối tới mạng Blockchain Sepolia. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  // Tự động đọc dữ liệu từ Mã QR (?code=...&key=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromQr = params.get("code");
    const keyFromQr = params.get("key");

    if (keyFromQr) {
      setSecurityKey(keyFromQr);
    }
    if (codeFromQr) {
      setMode("code");
      setCertCodeInput(codeFromQr);
      verifyByCertCode(codeFromQr);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function compute() {
      if (selectedFile && securityKey.trim()) {
        const hash = await hashCertificateWithSalt(selectedFile, securityKey);
        if (active) setComputedHash(hash);
      } else if (selectedFile && !securityKey.trim()) {
        if (active) setComputedHash("");
      }
    }
    compute();
    return () => {
      active = false;
    };
  }, [selectedFile, securityKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "code") {
      await verifyByCertCode(certCodeInput);
      return;
    }

    setError("");
    setResult(null);
    if (selectedFile && !securityKey.trim()) {
      setError(
        "Vui lòng nhập Mã xác thực in kèm trên chứng chỉ (hoặc quét mã QR trên văn bằng để tự động điền)."
      );
      return;
    }

    const hashToCheck = computedHash.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(hashToCheck)) {
      setError("Vui lòng chọn file chứng chỉ kèm Mã xác thực, hoặc nhập trực tiếp mã Hash 64 ký tự (0x...).");
      return;
    }

    try {
      setLoading(true);
      await verifyHashOnChain(hashToCheck);
    } catch (err) {
      console.error(err);
      setError("Không thể truy vấn Smart Contract trên mạng Sepolia.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.badge}>HỆ THỐNG XÁC THỰC CHỨNG CHỈ BLOCKCHAIN</div>
          <h1 style={styles.title}>Cổng Xác Minh & Tra Cứu Chứng Chỉ</h1>
          <p style={styles.subtitle}>
            Người dùng không cần kết nối ví MetaMask. Nhập mã chứng chỉ, quét mã QR hoặc đối chiếu file gốc trực tiếp với Smart Contract trên Ethereum Sepolia.
          </p>
        </header>

        {/* Chuyển đổi 2 phương thức tra cứu */}
        <div style={styles.tabBar}>
          <button
            type="button"
            onClick={() => {
              setMode("code");
              setResult(null);
              setError("");
            }}
            style={mode === "code" ? styles.activeTab : styles.inactiveTab}
          >
            <Hash size={16} /> Tra cứu nhanh bằng Mã chứng chỉ
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("file");
              setResult(null);
              setError("");
            }}
            style={mode === "file" ? styles.activeTab : styles.inactiveTab}
          >
            <Upload size={16} /> Kiểm tra toàn vẹn File gốc
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.card}>
          {mode === "code" ? (
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Nhập Mã chứng chỉ (in trên góc văn bằng):</label>
              <input
                type="text"
                placeholder="Ví dụ: CERT-2026-001"
                value={certCodeInput}
                onChange={(e) => setCertCodeInput(e.target.value)}
                style={styles.input}
              />
              <p style={styles.helperText}>
                Mẹo: Bạn chỉ cần nhập Mã chứng chỉ hoặc quét mã QR in trên bằng, không cần nhớ mã bảo mật.
              </p>
            </div>
          ) : (
            <>
              <div style={styles.uploadBox}>
                <Upload size={30} color="#2563eb" />
                <p style={{ margin: "8px 0 4px", fontWeight: 600 }}>
                  {selectedFile ? `Đã chọn: ${selectedFile.name}` : "1. Chọn file chứng chỉ gốc (PDF / Hình ảnh)"}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                  File được kiểm tra trực tiếp trên trình duyệt, không tải lên máy chủ ngoài
                </p>
                <input
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setSelectedFile(f);
                      setResult(null);
                      setError("");
                    }
                  }}
                  style={styles.fileInput}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>
                  <KeyRound size={15} style={{ verticalAlign: "middle", marginRight: 5 }} />
                  2. Mã xác thực đi kèm chứng chỉ (Security Key):
                </label>
                <input
                  type="text"
                  placeholder="Nhập mã xác thực (tự động điền nếu quét từ mã QR)..."
                  value={securityKey}
                  onChange={(e) => {
                    setSecurityKey(e.target.value);
                    setResult(null);
                  }}
                  style={styles.input}
                />
                <p style={styles.helperText}>
                  Nếu quên mã xác thực, bạn có thể quét lại mã QR trên văn bằng hoặc dùng tab{" "}
                  <strong>Tra cứu nhanh bằng Mã chứng chỉ</strong> ở trên.
                </p>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Mã Hash đối chiếu trên Blockchain:</label>
                <input
                  type="text"
                  placeholder="Tự động tạo khi chọn File + Mã xác thực (hoặc dán mã 0x...)"
                  value={computedHash}
                  onChange={(e) => setComputedHash(e.target.value)}
                  style={{ ...styles.input, background: "#f8fafc" }}
                />
              </div>
            </>
          )}

          <button type="submit" disabled={loading} style={styles.primaryBtn}>
            <Search size={18} />
            {loading ? "Đang truy vấn Smart Contract..." : "Xác minh chứng chỉ"}
          </button>

          {error && <div style={styles.errorBox}>{error}</div>}
        </form>

        {/* HIỂN THỊ KẾT QUẢ XÁC MINH */}
        {result && (
          <div style={styles.resultCard}>
            {!result.exists ? (
              <div style={{ ...styles.statusBanner, background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}>
                <ShieldAlert size={36} color="#dc2626" />
                <div>
                  <h3 style={{ margin: 0 }}>CHỨNG CHỈ KHÔNG TỒN TẠI</h3>
                  <p style={{ margin: "4px 0 0", fontSize: 14 }}>
                    Không tìm thấy bản ghi hợp lệ trên Blockchain (sai mã chứng chỉ, sai mã xác thực, hoặc nội dung file đã bị chỉnh sửa).
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    ...styles.statusBanner,
                    background: result.isValid ? "#f0fdf4" : "#fffbeb",
                    borderColor: result.isValid ? "#bbf7d0" : "#fde68a",
                    color: result.isValid ? "#166534" : "#92400e",
                  }}
                >
                  {result.isValid ? (
                    <ShieldCheck size={36} color="#16a34a" />
                  ) : (
                    <ShieldAlert size={36} color="#d97706" />
                  )}
                  <div>
                    <h3 style={{ margin: 0 }}>
                      {result.isValid ? "CHỨNG CHỈ HỢP LỆ & CÒN HIỆU LỰC" : "CHỨNG CHỈ ĐÃ BỊ THU HỒI"}
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: 14 }}>
                      {result.isValid
                        ? "Thông tin và mã Hash khớp chính xác với dữ liệu bất biến trên Ethereum Sepolia."
                        : "Chứng chỉ này từng được phát hành nhưng đã bị đơn vị cấp thu hồi hiệu lực."}
                    </p>
                  </div>
                </div>

                <div style={styles.detailsGrid}>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Mã chứng chỉ:</span>
                    <strong style={styles.detailValue}>{result.certCode}</strong>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Họ và tên người nhận:</span>
                    <strong style={styles.detailValue}>{result.recipientName}</strong>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Tên khóa học:</span>
                    <span style={styles.detailValue}>{result.courseName}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Ngày cấp:</span>
                    <span style={styles.detailValue}>{result.issueDate}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Đơn vị cấp:</span>
                    <span style={styles.detailValue}>{result.issuerUnit}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Trạng thái:</span>
                    <span style={{ color: result.isValid ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                      {result.isValid ? "Còn hiệu lực" : "Đã thu hồi"}
                    </span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Mã Hash:</span>
                    <code style={styles.codeText}>{result.certHash}</code>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <footer style={styles.footer}>
          <FileCheck2 size={15} />
          <span>Smart Contract xác thực công khai tại Sepolia: </span>
          <a
            href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            style={styles.link}
          >
            {CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-8)} <ExternalLink size={13} />
          </a>
        </footer>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
    padding: "40px 16px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#0f172a",
  },
  container: { maxWidth: 680, margin: "0 auto" },
  header: { textAlign: "center", marginBottom: 24 },
  badge: {
    display: "inline-block",
    background: "#dbeafe",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 700,
    padding: "5px 12px",
    borderRadius: 999,
    marginBottom: 10,
  },
  title: { fontSize: 28, margin: "0 0 10px", fontWeight: 800, color: "#0f172a" },
  subtitle: { fontSize: 15, color: "#475569", margin: 0, lineHeight: 1.5 },
  tabBar: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginBottom: 14,
  },
  activeTab: {
    padding: "11px 14px",
    borderRadius: 10,
    border: "2px solid #2563eb",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  inactiveTab: {
    padding: "11px 14px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#475569",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  card: {
    background: "#ffffff",
    padding: 24,
    borderRadius: 16,
    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.06)",
    border: "1px solid #e2e8f0",
  },
  uploadBox: {
    position: "relative",
    border: "2px dashed #93c5fd",
    background: "#eff6ff",
    borderRadius: 12,
    padding: "20px 16px",
    textAlign: "center",
    cursor: "pointer",
    marginBottom: 18,
  },
  fileInput: {
    position: "absolute",
    inset: 0,
    opacity: 0,
    cursor: "pointer",
    width: "100%",
  },
  fieldGroup: { marginBottom: 16 },
  label: { display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6, color: "#334155" },
  input: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    fontFamily: "monospace",
    boxSizing: "border-box",
  },
  helperText: {
    margin: "6px 0 0",
    fontSize: 12.5,
    color: "#64748b",
    lineHeight: 1.4,
  },
  primaryBtn: {
    width: "100%",
    padding: "13px 20px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  errorBox: {
    marginTop: 14,
    padding: 12,
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 8,
    fontSize: 14,
  },
  resultCard: {
    marginTop: 20,
    background: "#ffffff",
    padding: 24,
    borderRadius: 16,
    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.06)",
    border: "1px solid #e2e8f0",
  },
  statusBanner: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 12,
    border: "1px solid",
  },
  detailsGrid: { marginTop: 18, display: "flex", flexDirection: "column", gap: 12 },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    borderBottom: "1px solid #f1f5f9",
    gap: 12,
    flexWrap: "wrap",
  },
  detailLabel: { fontSize: 14, color: "#64748b" },
  detailValue: { fontSize: 15, color: "#0f172a" },
  codeText: {
    fontSize: 12,
    background: "#f1f5f9",
    padding: "4px 8px",
    borderRadius: 6,
    wordBreak: "break-all",
  },
  footer: {
    marginTop: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontSize: 13,
    color: "#64748b",
    flexWrap: "wrap",
  },
  link: {
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
};