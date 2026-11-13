import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck, ShieldAlert, ArrowLeft, ExternalLink, Award } from "lucide-react";
import { type FullCertificateRecord, fetchAllCertificates } from "../shared/certService";

export default function CertificateDetailPage() {
  const { code } = useParams<{ code: string }>();
  const [cert, setCert] = useState<FullCertificateRecord | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div style={styles.centerScreen}>
        <p style={{ fontSize: 16, color: "#475569" }}>Đang trích xuất dữ liệu chứng chỉ từ Ethereum Sepolia...</p>
      </div>
    );
  }

  if (!cert) {
    return (
      <div style={styles.centerScreen}>
        <ShieldAlert size={48} color="#dc2626" />
        <h2 style={{ margin: "12px 0 8px" }}>Không tìm thấy chứng chỉ</h2>
        <p style={{ color: "#64748b", marginBottom: 20 }}>
          Mã chứng chỉ <strong>{code}</strong> không tồn tại trên hệ thống Blockchain.
        </p>
        <Link to="/" style={styles.backBtn}>
          <ArrowLeft size={16} /> Quay lại trang xác minh
        </Link>
      </div>
    );
  }

  const verifyUrl = `${window.location.origin}/certificate/${encodeURIComponent(cert.certCode)}`;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topActions}>
          <Link to="/" style={styles.backBtn}>
            <ArrowLeft size={16} /> Trang xác minh chứng chỉ
          </Link>
          <span style={cert.isValid ? styles.statusValid : styles.statusRevoked}>
            {cert.isValid ? (
              <>
                <ShieldCheck size={16} /> ĐÃ XÁC THỰC • CÒN HIỆU LỰC
              </>
            ) : (
              <>
                <ShieldAlert size={16} /> CHỨNG CHỈ ĐÃ BỊ THU HỒI
              </>
            )}
          </span>
        </div>

        {/* Khung Phôi Văn Bằng Trang Trọng (Giống mẫu Trang 5) */}
        <div style={styles.certificateFrame}>
          <div style={styles.innerBorder}>
            <div style={styles.issuerHeader}>
              <Award size={36} color="#b45309" />
              <div style={styles.universityName}>{cert.issuerUnit.toUpperCase()}</div>
              <div style={styles.certTitle}>CHỨNG CHỈ HOÀN THÀNH KHÓA HỌC</div>
            </div>

            <div style={styles.bodyCenter}>
              <div style={styles.presentedText}>Trân trọng chứng nhận học viên:</div>
              <div style={styles.recipientName}>{cert.recipientName}</div>
              <div style={styles.presentedText}>Đã hoàn thành xuất sắc chương trình đào tạo:</div>
              <div style={styles.courseName}>{cert.courseName}</div>
            </div>

            <div style={styles.certFooter}>
              <div>
                <div style={styles.metaSmall}>Mã số chứng chỉ: <strong>{cert.certCode}</strong></div>
                <div style={styles.metaSmall}>Ngày cấp: <strong>{cert.issueDate}</strong></div>
              </div>

              <div style={styles.qrBox}>
                <QRCodeSVG value={verifyUrl} size={96} />
                <span style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>QR Code xác minh</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bảng Thông Số Kỹ Thuật On-chain bên dưới phôi bằng */}
        <div style={styles.techCard}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Thông tin định danh & Bằng chứng Blockchain</h3>

          <div style={styles.techRow}>
            <span style={styles.techLabel}>Trạng thái hiệu lực:</span>
            <strong style={{ color: cert.isValid ? "#16a34a" : "#dc2626" }}>
              {cert.isValid ? "Còn hiệu lực" : "Đã thu hồi"}
            </strong>
          </div>

          <div style={styles.techRow}>
            <span style={styles.techLabel}>Thời gian ghi nhận On-chain:</span>
            <span>{new Date(cert.issuedAtOnChain * 1000).toLocaleString("vi-VN")}</span>
          </div>

          <div style={styles.techRow}>
            <span style={styles.techLabel}>Ví cấp chứng chỉ (Admin):</span>
            <code style={styles.codeInline}>{cert.issuerWallet}</code>
          </div>

          {cert.txHash && (
            <div style={styles.techRow}>
              <span style={styles.techLabel}>Mã giao dịch Blockchain:</span>
              <a
                href={`https://sepolia.etherscan.io/tx/${cert.txHash}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#2563eb", textDecoration: "none", fontFamily: "monospace", fontSize: 13 }}
              >
                {cert.txHash.slice(0, 18)}...{cert.txHash.slice(-10)} <ExternalLink size={13} />
              </a>
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>Mã Hash chứng chỉ (Keccak-256):</div>
            <code style={styles.hashFull}>{cert.certHash}</code>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  centerScreen: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: 20,
    textAlign: "center",
  },
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "32px 16px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#0f172a",
  },
  container: {
    maxWidth: 780,
    margin: "0 auto",
  },
  topActions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 10,
  },
  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    textDecoration: "none",
    color: "#334155",
    background: "#ffffff",
    padding: "8px 14px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    border: "1px solid #cbd5e1",
  },
  statusValid: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#dcfce7",
    color: "#166534",
    padding: "8px 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
  },
  statusRevoked: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#fee2e2",
    color: "#991b1b",
    padding: "8px 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
  },
  certificateFrame: {
    background: "#fffbeb",
    padding: 16,
    borderRadius: 16,
    boxShadow: "0 15px 30px -10px rgba(0,0,0,0.12)",
    marginBottom: 24,
  },
  innerBorder: {
    border: "3px double #b45309",
    borderRadius: 10,
    padding: "36px 28px",
    background: "linear-gradient(180deg, #fffdf7 0%, #fef3c7 100%)",
  },
  issuerHeader: {
    textAlign: "center",
    marginBottom: 24,
  },
  universityName: {
    fontSize: 18,
    fontWeight: 800,
    color: "#78350f",
    letterSpacing: 1,
    marginTop: 8,
  },
  certTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: "#92400e",
    marginTop: 6,
    fontFamily: "Georgia, serif",
  },
  bodyCenter: {
    textAlign: "center",
    margin: "24px 0",
  },
  presentedText: {
    fontSize: 15,
    color: "#78350f",
    fontStyle: "italic",
  },
  recipientName: {
    fontSize: 32,
    fontWeight: 800,
    color: "#0f172a",
    margin: "10px 0 18px",
    fontFamily: "Georgia, serif",
  },
  courseName: {
    fontSize: 20,
    fontWeight: 700,
    color: "#1e3a8a",
    marginTop: 8,
  },
  certFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 32,
    paddingTop: 16,
    borderTop: "1px solid #fde68a",
    flexWrap: "wrap",
    gap: 16,
  },
  metaSmall: {
    fontSize: 13,
    color: "#78350f",
    marginBottom: 4,
  },
  qrBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    background: "#ffffff",
    padding: 8,
    borderRadius: 8,
    border: "1px solid #fde68a",
  },
  techCard: {
    background: "#ffffff",
    padding: 24,
    borderRadius: 16,
    boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
  },
  techRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    marginBottom: 10,
    borderBottom: "1px solid #f1f5f9",
    fontSize: 14,
    flexWrap: "wrap",
    gap: 8,
  },
  techLabel: {
    color: "#64748b",
  },
  codeInline: {
    background: "#f1f5f9",
    padding: "3px 8px",
    borderRadius: 6,
    fontSize: 12,
  },
  hashFull: {
    display: "block",
    background: "#f1f5f9",
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 12,
    wordBreak: "break-all",
  },
};