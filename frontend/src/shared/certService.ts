import { Contract, JsonRpcProvider } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI, SEPOLIA_RPC_URL } from "./contractConfig";
import { type CertificateMetadata, decodeOnChainPayload } from "./hashHelper";

export const STORAGE_KEY = "blockchain_issued_certificates_v1";

export interface FullCertificateRecord extends CertificateMetadata {
  issuedAtOnChain: number;
  isValid: boolean;
  issuerWallet: string;
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

export async function fetchAllCertificates(): Promise<FullCertificateRecord[]> {
  const savedRaw = localStorage.getItem(STORAGE_KEY);
  const localMap: Record<string, CertificateMetadata> = savedRaw ? JSON.parse(savedRaw) : {};

  const provider = new JsonRpcProvider(SEPOLIA_RPC_URL);
  const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

  const onChainAdmin: string = await contract.admin();
  const events = await queryEventsInChunks(contract, provider, 45000);

  const allHashes = new Set<string>(Object.keys(localMap));
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
      const localInfo = localMap[hash];
      const issueDateStr =
        localInfo?.issueDate ||
        decoded.issueDate ||
        new Date(Number(issuedAt) * 1000).toISOString().split("T")[0];

      // Tự động cập nhật lại vào localStorage để những lần F5 sau tải siêu nhanh
      if (!localInfo) {
        localMap[hash] = {
          certCode: decoded.certCode,
          recipientName: decoded.recipientName,
          courseName: decoded.courseName,
          issueDate: issueDateStr,
          issuerUnit: decoded.issuerUnit,
          salt: "",
          certHash: hash,
          txHash: eventTxMap[hash] || "",
        };
        hasNewCache = true;
      }

      records.push({
        certCode: localInfo?.certCode || decoded.certCode,
        recipientName: localInfo?.recipientName || decoded.recipientName,
        courseName: localInfo?.courseName || decoded.courseName,
        issueDate: issueDateStr,
        issuerUnit: localInfo?.issuerUnit || decoded.issuerUnit,
        salt: localInfo?.salt || "",
        certHash: hash,
        txHash: localInfo?.txHash || eventTxMap[hash] || "",
        issuedAtOnChain: Number(issuedAt),
        isValid: Boolean(isValid),
        issuerWallet: onChainAdmin,
      });
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