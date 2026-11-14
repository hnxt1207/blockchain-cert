import { Contract, JsonRpcProvider } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI, SEPOLIA_RPC_URL } from "../ket-noi-blockchain/cau-hinh-hop-dong/contractConfig";
import { type CertificateMetadata, decodeOnChainPayload } from "../ket-noi-blockchain/ma-hoa-keccak256/hashHelper";

export const STORAGE_KEY = "blockchain_issued_certificates_v1";
export const AUTH_STORAGE_KEY = "certchain_current_user_v1";

export interface AuthUser {
  Id: number;
  Email: string;
  FullName: string;
  Role: "ADMIN" | "STUDENT";
  StudentCode?: string | null;
}

export interface FullCertificateRecord extends CertificateMetadata {
  studentCode?: string;
  issuedAtOnChain: number;
  isValid: boolean;
  issuerWallet: string;
}

/**
 * Quản lý phiên đăng nhập người dùng (Admin & Sinh viên)
 */
export function getCurrentUser(): AuthUser | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveCurrentUser(user: AuthUser): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function logoutUser(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

/**
 * Lưu thông tin chứng chỉ mới cấp phát vào SQL Server
 */
export async function saveCertificateToSQL(
  cert: CertificateMetadata & { studentCode?: string }
): Promise<void> {
  const res = await fetch("/api/certificates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      certCode: cert.certCode,
      studentCode: cert.studentCode || "",
      recipientName: cert.recipientName,
      courseName: cert.courseName,
      issueDate: cert.issueDate,
      issuerUnit: cert.issuerUnit,
      securityKey: cert.salt,
      certHash: cert.certHash,
      txHash: cert.txHash,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Lỗi lưu chứng chỉ vào SQL Server");
  }
}

/**
 * Cập nhật trạng thái thu hồi chứng chỉ trong SQL Server
 */
export async function revokeCertificateInSQL(certHash: string): Promise<void> {
  const res = await fetch(`/api/certificates/${certHash}/revoke`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Lỗi cập nhật trạng thái thu hồi trong SQL Server");
  }
}

/**
 * Quét sự kiện theo từng cụm 9.000 block để tránh giới hạn của RPC công khai Sepolia
 */
async function queryEventsInChunks(contract: Contract, provider: JsonRpcProvider, totalBlocksBack = 45000) {
  const latestBlock = await provider.getBlockNumber();
  const startBlock = Math.max(0, latestBlock - totalBlocksBack);
  const chunkSize = 9000;
  const filter = contract.filters.CertificateIssued();
  const allEvents: any[] = [];

  for (let from = startBlock; from <= latestBlock; from += chunkSize) {
    const to = Math.min(from + chunkSize - 1, latestBlock);
    try {
      const chunkEvents = await contract.queryFilter(filter, from, to);
      allEvents.push(...chunkEvents);
    } catch (err) {
      console.warn(`Bỏ qua cụm block ${from}-${to}:`, err);
    }
  }
  return allEvents;
}

/**
 * Tải danh sách chứng chỉ hợp nhất từ SQL Server + Smart Contract Sepolia
 */
export async function fetchAllCertificates(): Promise<FullCertificateRecord[]> {
  const savedRaw = localStorage.getItem(STORAGE_KEY);
  const localMap: Record<string, CertificateMetadata & { studentCode?: string }> = savedRaw
    ? JSON.parse(savedRaw)
    : {};

  // 1. Lấy metadata từ SQL Server
  const sqlMap: Record<string, any> = {};
  try {
    const sqlRes = await fetch("/api/certificates");
    if (sqlRes.ok) {
      const sqlRows = await sqlRes.json();
      for (const row of sqlRows) {
        sqlMap[row.CertHash] = row;
      }
    }
  } catch (err) {
    console.warn("Không thể tải dữ liệu từ SQL Server, dùng bộ nhớ đệm cục bộ:", err);
  }

  // 2. Lấy dữ liệu xác thực bất biến từ Blockchain Sepolia
  const provider = new JsonRpcProvider(SEPOLIA_RPC_URL);
  const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI.abi, provider);

  const onChainAdmin: string = await contract.admin();
  const events = await queryEventsInChunks(contract, provider, 45000);

  const allHashes = new Set<string>([...Object.keys(sqlMap), ...Object.keys(localMap)]);
  const eventPayloadMap: Record<string, string> = {};
  const eventTxMap: Record<string, string> = {};

  for (const ev of events) {
    if ("args" in ev && ev.args) {
      const h = ev.args[0] as string;
      const rawStudentId = ev.args[1] as string;
      allHashes.add(h);
      eventPayloadMap[h] = rawStudentId;
      if (ev.transactionHash) {
        eventTxMap[h] = ev.transactionHash;
      }
    }
  }

  const records: FullCertificateRecord[] = [];
  let hasNewCache = false;

  for (const hash of allHashes) {
    try {
      const [exists, rawStudentId, issuedAt, isValid] = await contract.verifyCertificate(hash);
      if (!exists) continue;

      const decoded = decodeOnChainPayload(rawStudentId || eventPayloadMap[hash] || "");
      const sqlInfo = sqlMap[hash];
      const localInfo = localMap[hash];

      const issueDateStr =
        (sqlInfo?.IssueDate ? String(sqlInfo.IssueDate).split("T")[0] : "") ||
        localInfo?.issueDate ||
        decoded.issueDate ||
        new Date(Number(issuedAt) * 1000).toISOString().split("T")[0];

      const mergedRecord: FullCertificateRecord = {
        certCode: sqlInfo?.CertCode || localInfo?.certCode || decoded.certCode,
        studentCode: sqlInfo?.StudentCode || localInfo?.studentCode || "",
        recipientName: sqlInfo?.RecipientName || localInfo?.recipientName || decoded.recipientName,
        courseName: sqlInfo?.CourseName || localInfo?.courseName || decoded.courseName,
        issueDate: issueDateStr,
        issuerUnit: sqlInfo?.IssuerUnit || localInfo?.issuerUnit || decoded.issuerUnit,
        salt: sqlInfo?.SecurityKey || localInfo?.salt || "",
        certHash: hash,
        txHash: sqlInfo?.TxHash || localInfo?.txHash || eventTxMap[hash] || "",
        issuedAtOnChain: Number(issuedAt),
        isValid: Boolean(isValid),
        issuerWallet: onChainAdmin,
      };

      // Tự động đồng bộ lại vào localStorage để tăng tốc độ tải dự phòng
      if (!localInfo || (sqlInfo && !localInfo.salt && sqlInfo.SecurityKey)) {
        localMap[hash] = {
          certCode: mergedRecord.certCode,
          studentCode: mergedRecord.studentCode,
          recipientName: mergedRecord.recipientName,
          courseName: mergedRecord.courseName,
          issueDate: mergedRecord.issueDate,
          issuerUnit: mergedRecord.issuerUnit,
          salt: mergedRecord.salt,
          certHash: mergedRecord.certHash,
          txHash: mergedRecord.txHash,
        };
        hasNewCache = true;
      }

      records.push(mergedRecord);
    } catch (err) {
      console.error("Lỗi đọc chứng chỉ:", hash, err);
    }
  }

  if (hasNewCache) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localMap));
  }

  records.sort((a, b) => b.issuedAtOnChain - a.issuedAtOnChain);
  return records;
}