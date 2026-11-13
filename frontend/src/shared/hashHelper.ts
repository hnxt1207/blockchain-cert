import { keccak256, toUtf8Bytes } from "ethers";

export interface CertificateMetadata {
  certCode: string;      // Mã chứng chỉ (VD: CERT-2026-001)
  recipientName: string; // Họ và tên người nhận
  courseName: string;    // Tên khóa học
  issueDate: string;     // Ngày cấp (YYYY-MM-DD)
  issuerUnit: string;    // Đơn vị cấp
  salt: string;          // Mã muối bảo mật
  certHash: string;      // Mã Hash Keccak-256
  txHash?: string;       // Mã giao dịch Blockchain
}

export function generateSalt(): string {
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashCertificateWithSalt(file: File, salt: string): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);
  const saltBytes = toUtf8Bytes(salt.trim());

  const combined = new Uint8Array(fileBytes.length + saltBytes.length);
  combined.set(fileBytes, 0);
  combined.set(saltBytes, fileBytes.length);

  return keccak256(combined);
}

/**
 * Đóng gói 5 trường thông tin văn bằng vào tham số _studentId của Smart Contract
 */
export function encodeOnChainPayload(
  meta: Omit<CertificateMetadata, "salt" | "certHash" | "txHash">
): string {
  return JSON.stringify({
    c: meta.certCode,
    n: meta.recipientName,
    k: meta.courseName,
    d: meta.issueDate,
    u: meta.issuerUnit,
  });
}

/**
 * Giải mã thông tin từ Smart Contract (tương thích cả dữ liệu cũ chỉ có MSSV)
 */
export function decodeOnChainPayload(rawString: string): {
  certCode: string;
  recipientName: string;
  courseName: string;
  issueDate: string;
  issuerUnit: string;
} {
  try {
    const parsed = JSON.parse(rawString);
    if (parsed && typeof parsed === "object" && parsed.c) {
      return {
        certCode: parsed.c || "",
        recipientName: parsed.n || "",
        courseName: parsed.k || "",
        issueDate: parsed.d || "",
        issuerUnit: parsed.u || "",
      };
    }
  } catch {
    // Dữ liệu cũ chỉ là chuỗi MSSV đơn thuần
  }
  return {
    certCode: rawString,
    recipientName: "Dữ liệu thử nghiệm cũ",
    courseName: "Chưa phân loại",
    issueDate: "",
    issuerUnit: "Nhà trường",
  };
}