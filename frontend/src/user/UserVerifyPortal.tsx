import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { JsonRpcProvider, Contract } from "ethers";
import {
  ShieldCheck,
  ShieldAlert,
  Upload,
  Search,
  ExternalLink,
  KeyRound,
  Hash,
  Award,
  CheckCircle2,
  ChevronDown,
  Copy,
  Check,
  Sparkles,
  Fingerprint,
  Layers,
  QrCode,
  ArrowDown,
} from "lucide-react";
import { CONTRACT_ADDRESS, CONTRACT_ABI, SEPOLIA_RPC_URL } from "../shared/contractConfig";
import {
  type CertificateMetadata,
  hashCertificateWithSalt,
  decodeOnChainPayload,
} from "../shared/hashHelper";
import { STORAGE_KEY, fetchAllCertificates } from "../shared/certService";

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
  txHash?: string;
}

/**
 * Linh vật Robot BIN 3D:
 * - Thân trốn phía sau mép trên của khung xác minh (z-10)
 * - 2 tay robot đặt đè lên viền khung (z-30)
 * - Đôi mắt đảo nhìn theo trỏ chuột, tự động chớp mắt sinh động
 * - Khi người dùng nhập Mã xác thực (isPeeking = true): BIN đưa tay lên che nhưng vẫn nheo 1 mắt lén nhìn!
 */
function BinRobotMascot({
  mousePos,
  isLoading,
  verifyStatus,
  isPeeking,
}: {
  mousePos: { x: number; y: number };
  isLoading: boolean;
  verifyStatus: "idle" | "valid" | "invalid";
  isPeeking: boolean;
}) {
  const headRef = useRef<HTMLDivElement>(null);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [headTilt, setHeadTilt] = useState({ rotateX: 0, rotateY: 0, rotateZ: 0 });
  const [isBlinking, setIsBlinking] = useState(false);

  // Hiệu ứng chớp mắt tự nhiên ngẫu nhiên mỗi 3.5 giây
  useEffect(() => {
    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 160);
    }, 3600);
    return () => clearInterval(interval);
  }, []);

  // Tính góc đảo mắt & nghiêng đầu theo trỏ chuột
  useEffect(() => {
    if (!headRef.current) return;
    const rect = headRef.current.getBoundingClientRect();
    const botCenterX = rect.left + rect.width / 2;
    const botCenterY = rect.top + rect.height / 2;

    if (isPeeking) {
      // Khi lén nhìn: mắt liếc hẳn xuống dưới về phía ô nhập mã
      setEyeOffset({ x: 2.5, y: 5.5 });
      setHeadTilt({ rotateX: -12, rotateY: 8, rotateZ: -6 });
      return;
    }

    const dx = mousePos.x - botCenterX;
    const dy = mousePos.y - botCenterY;
    const distance = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy, dx);

    const maxEyeMove = Math.min(7.5, distance * 0.03);
    setEyeOffset({
      x: Math.cos(angle) * maxEyeMove,
      y: Math.sin(angle) * maxEyeMove,
    });

    setHeadTilt({
      rotateX: Math.max(-14, Math.min(14, -(dy / window.innerHeight) * 26)),
      rotateY: Math.max(-18, Math.min(18, (dx / window.innerWidth) * 32)),
      rotateZ: Math.max(-5, Math.min(5, (dx / window.innerWidth) * 8)),
    });
  }, [mousePos, isPeeking]);

  const eyeColor =
    verifyStatus === "valid"
      ? "#10b981"
      : verifyStatus === "invalid"
      ? "#f43f5e"
      : isLoading
      ? "#2563eb"
      : "#38bdf8";

  const statusBubble = isPeeking
    ? "BIN không nhìn đâu... 👀"
    : isLoading
    ? "BIN đang quét chuỗi..."
    : verifyStatus === "valid"
    ? "Chuẩn xác 100%! 🎉"
    : verifyStatus === "invalid"
    ? "Cảnh báo! Không khớp!"
    : "Xin chào, mình là BIN!";

  return (
    <div className="pointer-events-none relative mx-auto -mb-7 flex w-full max-w-[340px] flex-col items-center select-none">
      {/* Bong bóng thoại sinh động của BIN */}
      <div
        className={`mb-2 rounded-full border px-3.5 py-1 text-[11px] font-extrabold tracking-wide shadow-md transition-all duration-300 ${
          isPeeking
            ? "scale-105 border-amber-300 bg-amber-50 text-amber-800"
            : verifyStatus === "valid"
            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
            : verifyStatus === "invalid"
            ? "border-rose-300 bg-rose-50 text-rose-800"
            : "border-blue-200 bg-white/95 text-blue-800"
        }`}
      >
        {statusBubble}
      </div>

      {/* ===================================================================== */}
      {/* LỚP 1 (z-10): ĐẦU & THÂN ROBOT BIN TRỐN PHÍA SAU MÉP KHUNG XÁC MINH   */}
      {/* ===================================================================== */}
      <div
        ref={headRef}
        className="relative z-10 transition-transform duration-300 ease-out"
        style={{
          transform: isPeeking
            ? "translateY(10px)"
            : "translateY(0px)",
        }}
      >
        <div
          style={{
            transform: `perspective(700px) rotateX(${headTilt.rotateX}deg) rotateY(${headTilt.rotateY}deg) rotateZ(${headTilt.rotateZ}deg)`,
            transition: "transform 0.14s ease-out",
          }}
        >
          <svg
            width="156"
            height="128"
            viewBox="0 0 180 145"
            className="drop-shadow-[0_14px_24px_rgba(37,99,235,0.28)]"
          >
            <defs>
              {/* Chất liệu vỏ kim loại trắng ngọc trai 3D */}
              <linearGradient id="binShellWhite" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="65%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#94a3b8" />
              </linearGradient>
              {/* Chất liệu viền xanh Sapphire kim loại */}
              <linearGradient id="binBlueAccent" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#1e3a8a" />
              </linearGradient>
              {/* Mặt kính màn hình OLED đen sâu */}
              <linearGradient id="binVisorGlass" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#020617" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              {/* Hiệu ứng phát sáng neon cho mắt */}
              <filter id="binEyeGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Ăng-ten đôi phát tín hiệu */}
            <line x1="66" y1="26" x2="58" y2="10" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
            <circle cx="58" cy="9" r="5" fill={eyeColor}>
              <animate attributeName="r" values="4;6.5;4" dur="1.8s" repeatCount="indefinite" />
            </circle>

            <line x1="114" y1="26" x2="122" y2="10" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
            <circle cx="122" cy="9" r="5" fill={eyeColor}>
              <animate attributeName="r" values="6.5;4;6.5" dur="1.8s" repeatCount="indefinite" />
            </circle>

            {/* Hai tai chụp âm thanh 3D hai bên */}
            <rect x="18" y="54" width="14" height="36" rx="7" fill="url(#binBlueAccent)" />
            <rect x="148" y="54" width="14" height="36" rx="7" fill="url(#binBlueAccent)" />

            {/* Phần vai & cổ lấp ló phía dưới đầu */}
            <path d="M52,112 C52,102 128,102 128,112 L136,145 L44,145 Z" fill="url(#binBlueAccent)" />
            <rect x="74" y="118" width="32" height="12" rx="6" fill="#0f172a" />
            <text
              x="90"
              y="127"
              textAnchor="middle"
              fontSize="8.5"
              fontWeight="900"
              fill="#38bdf8"
              letterSpacing="1.5"
            >
              BIN
            </text>

            {/* Đầu Robot tròn trịa 3D */}
            <rect
              x="30"
              y="24"
              width="120"
              height="88"
              rx="36"
              fill="url(#binShellWhite)"
              stroke="#cbd5e1"
              strokeWidth="2"
            />

            {/* Dải trang trí xanh trên đỉnh trán */}
            <path d="M68,24 L112,24 L106,31 L74,31 Z" fill="url(#binBlueAccent)" />

            {/* Màn hình mặt kính Visor */}
            <rect
              x="40"
              y="36"
              width="100"
              height="62"
              rx="24"
              fill="url(#binVisorGlass)"
              stroke="#1e293b"
              strokeWidth="2.5"
            />

            {/* Vệt phản chiếu ánh sáng trên mặt kính */}
            <path
              d="M52,43 Q90,39 128,43"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />

            {/* Hai má hồng công nghệ khi vui hoặc lén nhìn */}
            {(isPeeking || verifyStatus === "valid") && (
              <>
                <ellipse cx="53" cy="79" rx="6" ry="3.5" fill="#fb7185" opacity="0.55" />
                <ellipse cx="127" cy="79" rx="6" ry="3.5" fill="#fb7185" opacity="0.55" />
              </>
            )}

            {/* =============================================================== */}
            {/* BIỂU CẢM ĐÔI MẮT CỦA BIN                                        */}
            {/* =============================================================== */}
            <g
              filter="url(#binEyeGlow)"
              style={{
                transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
                transition: "transform 0.07s linear",
              }}
            >
              {isPeeking ? (
                <>
                  {/* MẮT TRÁI: Nhắm tịt vờ như không nhìn (đường cong > ) */}
                  <path
                    d="M58,64 L73,68 L58,72"
                    fill="none"
                    stroke={eyeColor}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* MẮT PHẢI: Nheo nhỏ lại để lén liếc nhìn xuống ô nhập mã! */}
                  <rect x="101" y="64" width="22" height="8" rx="4" fill={eyeColor} />
                  {/* Con ngươi lén liếc xuống */}
                  <circle cx="113" cy="69" r="3" fill="#ffffff" />
                </>
              ) : isBlinking ? (
                <>
                  {/* Chớp mắt tự nhiên */}
                  <line x1="57" y1="67" x2="77" y2="67" stroke={eyeColor} strokeWidth="4" strokeLinecap="round" />
                  <line x1="103" y1="67" x2="123" y2="67" stroke={eyeColor} strokeWidth="4" strokeLinecap="round" />
                </>
              ) : verifyStatus === "valid" ? (
                <>
                  {/* Mắt cười híp hình vòng cung ^ ^ */}
                  <path
                    d="M57,70 Q67,56 77,70"
                    fill="none"
                    stroke={eyeColor}
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M103,70 Q113,56 123,70"
                    fill="none"
                    stroke={eyeColor}
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                </>
              ) : (
                <>
                  {/* Đôi mắt tròn to sinh động đảo theo trỏ chuột */}
                  <circle cx="67" cy="67" r="10.5" fill={eyeColor} />
                  <circle cx="113" cy="67" r="10.5" fill={eyeColor} />
                  {/* Điểm sáng long lanh trong mắt */}
                  <circle cx="70.5" cy="63.5" r="3.4" fill="#ffffff" />
                  <circle cx="116.5" cy="63.5" r="3.4" fill="#ffffff" />
                  <circle cx="63.5" cy="70.5" r="1.5" fill="#ffffff" opacity="0.8" />
                  <circle cx="109.5" cy="70.5" r="1.5" fill="#ffffff" opacity="0.8" />
                </>
              )}
            </g>

            {/* Miệng biểu cảm nhỏ xinh */}
            {isPeeking ? (
              /* Miệng cười tinh nghịch hình chữ w nhỏ */
              <path
                d="M83,84 Q86.5,88 90,84 Q93.5,88 97,84"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            ) : verifyStatus === "valid" ? (
              <path
                d="M81,83 Q90,92 99,83"
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M84,84 Q90,88 96,84"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}
          </svg>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* LỚP 2 (z-30): HAI BÀN TAY ROBOT ĐẶT ĐÈ LÊN VIỀN KHUNG XÁC MINH        */}
      {/* - Bình thường: 2 tay bám chặt lên mép trên khung chứng chỉ             */}
      {/* - Khi nhập mã (isPeeking): 2 tay giơ lên che ngang mặt nhưng để hở    */}
      {/*   khe bên phải cho mắt phải của BIN lén nhìn!                         */}
      {/* ===================================================================== */}
      <div className="relative z-30 -mt-5 flex w-full justify-between px-6">
        {/* Bàn tay trái */}
        <div
          className="transition-all duration-300 ease-out"
          style={{
            transform: isPeeking
              ? "translate(42px, -44px) rotate(18deg) scale(1.08)"
              : "translate(0px, 6px) rotate(0deg)",
          }}
        >
          <svg width="54" height="42" viewBox="0 0 60 46" className="drop-shadow-[0_6px_10px_rgba(15,23,42,0.22)]">
            <rect x="6" y="10" width="48" height="28" rx="14" fill="url(#binShellWhite)" stroke="#94a3b8" strokeWidth="2" />
            {/* 3 ngón tay robot bám mép khung */}
            <rect x="13" y="4" width="8" height="16" rx="4" fill="#2563eb" />
            <rect x="26" y="2" width="8" height="18" rx="4" fill="#38bdf8" />
            <rect x="39" y="4" width="8" height="16" rx="4" fill="#2563eb" />
          </svg>
        </div>

        {/* Bàn tay phải (hơi lệch sang phải để chừa khe cho mắt phải lén nhìn!) */}
        <div
          className="transition-all duration-300 ease-out"
          style={{
            transform: isPeeking
              ? "translate(-22px, -40px) rotate(-14deg) scale(1.08)"
              : "translate(0px, 6px) rotate(0deg)",
          }}
        >
          <svg width="54" height="42" viewBox="0 0 60 46" className="drop-shadow-[0_6px_10px_rgba(15,23,42,0.22)]">
            <rect x="6" y="10" width="48" height="28" rx="14" fill="url(#binShellWhite)" stroke="#94a3b8" strokeWidth="2" />
            <rect x="13" y="4" width="8" height="16" rx="4" fill="#2563eb" />
            <rect x="26" y="2" width="8" height="18" rx="4" fill="#38bdf8" />
            <rect x="39" y="4" width="8" height="16" rx="4" fill="#2563eb" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/**
 * Bộ Sticker Hoạt Hình Web3 & Văn Bằng Số bay lơ lửng
 */
function FloatingWeb3Stickers({ offsetX, offsetY }: { offsetX: number; offsetY: number }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      <div
        style={{ transform: `translate3d(${offsetX * 1.5}px, ${offsetY * 1.5}px, 0)` }}
        className="animate-float-slow absolute top-[20%] left-[6%] hidden lg:block"
      >
        <div className="flex flex-col items-center rounded-3xl border border-blue-200/80 bg-white/90 p-3.5 shadow-[0_15px_35px_rgba(37,99,235,0.14)] backdrop-blur-xl">
          <svg width="52" height="52" viewBox="0 0 64 64">
            <defs>
              <linearGradient id="gradCapLight" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
            </defs>
            <polygon points="32,12 6,25 32,38 58,25" fill="url(#gradCapLight)" />
            <path d="M16,31 V43 C16,48 48,48 48,43 V31" fill="#1e3a8a" />
            <line x1="54" y1="26" x2="54" y2="44" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="54" cy="45" r="3" fill="#0284c7" />
          </svg>
          <span className="mt-1 text-[9px] font-extrabold tracking-wider text-blue-700">DIPLOMA NFT</span>
        </div>
      </div>

      <div
        style={{ transform: `translate3d(${-offsetX * 1.7}px, ${-offsetY * 1.5}px, 0)` }}
        className="animate-float-reverse absolute top-[24%] right-[6%] hidden lg:block"
      >
        <div className="flex flex-col items-center rounded-3xl border border-sky-200/80 bg-white/90 p-3.5 shadow-[0_15px_35px_rgba(14,165,233,0.14)] backdrop-blur-xl">
          <svg width="52" height="52" viewBox="0 0 64 64">
            <polygon points="32,8 54,20 32,32 10,20" fill="#38bdf8" />
            <polygon points="10,20 32,32 32,56 10,44" fill="#0284c7" />
            <polygon points="54,20 32,32 32,56 54,44" fill="#1d4ed8" />
            <circle cx="32" cy="32" r="4" fill="#ffffff" />
          </svg>
          <span className="mt-1 text-[9px] font-extrabold tracking-wider text-sky-700">ON-CHAIN BLOCK</span>
        </div>
      </div>

      <div
        style={{ transform: `translate3d(${offsetX * 1.2}px, ${-offsetY * 1.2}px, 0)` }}
        className="animate-float-reverse absolute bottom-[16%] left-[7%] hidden xl:block"
      >
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-white/95 px-3.5 py-2.5 shadow-lg shadow-emerald-500/10 backdrop-blur-xl">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-black text-emerald-700">ZERO-FAKE</div>
            <div className="text-[9px] font-semibold text-slate-500">Keccak-256 Verified</div>
          </div>
        </div>
      </div>

      <div
        style={{ transform: `translate3d(${-offsetX * 1.3}px, ${offsetY * 1.3}px, 0)` }}
        className="animate-float-slow absolute right-[7%] bottom-[18%] hidden xl:block"
      >
        <div className="flex items-center gap-2.5 rounded-2xl border border-blue-200 bg-white/95 px-3.5 py-2.5 shadow-lg shadow-blue-500/10 backdrop-blur-xl">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-black text-blue-700">IMMUTABLE</div>
            <div className="text-[9px] font-semibold text-slate-500">Smart Contract</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Thẻ Trắng Kính Mờ Nghiêng 3D (z-20: nằm đè lên thân BIN nhưng dưới 2 bàn tay của BIN)
 */
function Tilt3DCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("perspective(1200px) rotateX(0deg) rotateY(0deg)");
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -4;
    const rotateY = ((x - centerX) / centerX) * 4;

    setTransform(`perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`);
    setGlare({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 1,
    });
  };

  const handleMouseLeave = () => {
    setTransform("perspective(1200px) rotateX(0deg) rotateY(0deg)");
    setGlare((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transform, transformStyle: "preserve-3d" }}
      className={`relative transition-transform duration-200 ease-out ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl transition-opacity duration-300"
        style={{
          opacity: glare.opacity,
          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(56, 189, 248, 0.16), transparent 55%)`,
        }}
      />
      {children}
    </div>
  );
}

function RevealOnScroll({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-1000 ease-out ${
        visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-12 opacity-0 scale-[0.96]"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export default function UserVerifyPortal() {
  const [mode, setMode] = useState<"code" | "file">("code");
  const [certCodeInput, setCertCodeInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [securityKey, setSecurityKey] = useState("");
  const [computedHash, setComputedHash] = useState("");
  const [showAdvancedHash, setShowAdvancedHash] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Trạng thái kích hoạt trò "nhắm mắt nheo lén nhìn" của BIN khi focus vào ô nhập mã
  const [isTypingSecret, setIsTypingSecret] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState("");
  const [copiedHash, setCopiedHash] = useState(false);

  const [mousePos, setMousePos] = useState({ x: 400, y: 240 });
  const [scrollY, setScrollY] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    const handleScroll = () => {
      const currentY = window.scrollY;
      setScrollY(currentY);
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(maxScroll > 0 ? Math.min(100, (currentY / maxScroll) * 100) : 0);
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const verifyHashOnChain = async (hashToCheck: string, txHash?: string) => {
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
      issueDate: decoded.issueDate || new Date(Number(issuedAt) * 1000).toISOString().split("T")[0],
      issuerUnit: decoded.issuerUnit,
      issuedAtOnChain: Number(issuedAt),
      isValid: Boolean(isValid),
      certHash: hashToCheck,
      txHash,
    });
  };

  const verifyByCertCode = async (codeToSearch: string) => {
    setError("");
    setResult(null);
    const normalizedCode = codeToSearch.trim().toLowerCase();

    if (!normalizedCode) {
      setError("Vui lòng nhập mã số chứng chỉ.");
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
        await verifyHashOnChain(localMatch.certHash, localMatch.txHash);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
        return;
      }

      const allRecords = await fetchAllCertificates();
      const onChainMatch = allRecords.find(
        (item) => item.certCode.trim().toLowerCase() === normalizedCode
      );

      if (!onChainMatch) {
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
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
        return;
      }

      await verifyHashOnChain(onChainMatch.certHash, onChainMatch.txHash);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    } catch (err) {
      console.error(err);
      setError("Lỗi kết nối mạng Sepolia. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromQr = params.get("code");
    const keyFromQr = params.get("key");

    if (keyFromQr) setSecurityKey(keyFromQr);
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
    setIsTypingSecret(false);

    if (mode === "code") {
      await verifyByCertCode(certCodeInput);
      return;
    }

    setError("");
    setResult(null);
    if (selectedFile && !securityKey.trim()) {
      setError("Nhập Mã bảo mật đi kèm tệp chứng chỉ.");
      return;
    }

    const hashToCheck = computedHash.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(hashToCheck)) {
      setError("Chọn tệp chứng chỉ kèm Mã bảo mật để đối chiếu.");
      return;
    }

    try {
      setLoading(true);
      await verifyHashOnChain(hashToCheck);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    } catch (err) {
      console.error(err);
      setError("Không thể truy vấn Smart Contract.");
    } finally {
      setLoading(false);
    }
  };

  const offsetX = (mousePos.x - (typeof window !== "undefined" ? window.innerWidth / 2 : 500)) * 0.03;
  const offsetY = (mousePos.y - (typeof window !== "undefined" ? window.innerHeight / 2 : 400)) * 0.03;

  const verifyStatus: "idle" | "valid" | "invalid" = !result
    ? "idle"
    : result.exists && result.isValid
    ? "valid"
    : "invalid";

  return (
    <div className="bg-luxury-grid relative min-h-screen bg-[#f0f7ff] text-slate-900 selection:bg-blue-600 selection:text-white">
      {/* Thanh tiến trình cuộn trang */}
      <div className="fixed top-0 left-0 z-50 h-[3px] w-full bg-blue-100">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Các Sticker hoạt hình Web3 bay lơ lửng */}
      <FloatingWeb3Stickers offsetX={offsetX} offsetY={offsetY} />

      {/* Hậu cảnh Animation Xanh Băng Sáng */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          style={{ transform: `translate3d(${-offsetX}px, ${scrollY * -0.15 - offsetY}px, 0)` }}
          className="animate-pulse-glow absolute -top-44 left-1/2 h-[540px] w-[960px] rounded-full bg-gradient-to-b from-sky-300/35 via-blue-400/15 to-transparent blur-[110px]"
        />
        <div className="animate-shooting-star absolute top-14 left-10 h-[2px] w-32 bg-gradient-to-r from-transparent via-blue-500 to-cyan-400 opacity-0" />
        <div
          style={{ animationDelay: "3.5s" }}
          className="animate-shooting-star absolute top-28 left-1/3 h-[2px] w-24 bg-gradient-to-r from-transparent via-sky-500 to-blue-600 opacity-0"
        />
        <span className="animate-particle absolute bottom-24 left-[22%] h-2 w-2 rounded-full bg-blue-500/50" />
        <span style={{ animationDelay: "1.8s" }} className="animate-particle absolute bottom-32 left-[48%] h-2.5 w-2.5 rounded-full bg-cyan-500/50" />
        <span style={{ animationDelay: "3.2s" }} className="animate-particle absolute bottom-20 left-[74%] h-2 w-2 rounded-full bg-sky-500/50" />

        <div className="animate-orbit-slow absolute top-[35%] left-1/2 hidden h-[680px] w-[680px] rounded-full border border-blue-400/25 md:block">
          <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-blue-600 shadow-[0_0_12px_#2563eb]" />
        </div>
        <div className="animate-orbit-reverse absolute top-[35%] left-1/2 hidden h-[940px] w-[940px] rounded-full border border-sky-400/20 md:block">
          <div className="absolute top-1/2 -right-1.5 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-cyan-500 shadow-[0_0_12px_#06b6d4]" />
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-blue-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 shadow-md shadow-blue-500/25">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-black tracking-wider text-slate-900">CERT-CHAIN</span>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/90 px-3.5 py-1.5 text-xs font-bold text-blue-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span>Ethereum Sepolia</span>
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* PHẦN 1: HERO, ROBOT BIN TRỐN SAU KHUNG & THẺ XÁC MINH 3D          */}
      {/* ================================================================= */}
      <section className="relative z-20 mx-auto flex min-h-[86vh] max-w-3xl flex-col items-center justify-center px-4 pt-10 pb-16 sm:px-6">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/90 px-4 py-1.5 text-xs font-extrabold tracking-wide text-blue-700 shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-blue-600" />
          <span>BLOCKCHAIN VERIFICATION PORTAL</span>
        </div>

        <h1 className="text-center text-4xl font-black tracking-tight text-slate-900 sm:text-6xl sm:leading-[1.12]">
          Tra Cứu{" "}
          <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent">
            Chứng Chỉ Số
          </span>
        </h1>

        <p className="mt-3 max-w-2xl text-center text-sm font-medium tracking-wide text-slate-600 sm:text-base sm:whitespace-nowrap">
          Xác thực tức thì bằng mã định danh hoặc tệp văn bằng gốc.
        </p>

        {/* Cụm Robot BIN + Thẻ Xác Minh xếp lớp 3D */}
        <div className="relative mt-6 w-full">
          {/* Chú Robot BIN (Thân z-10 trốn sau khung, 2 tay z-30 đặt lên viền khung) */}
          <BinRobotMascot
            mousePos={mousePos}
            isLoading={loading}
            verifyStatus={verifyStatus}
            isPeeking={isTypingSecret}
          />

          {/* Thẻ Trắng Kính Mờ (z-20 nằm giữa thân BIN và 2 tay BIN) */}
          <Tilt3DCard className="relative z-20 w-full rounded-3xl border border-blue-200/90 bg-white/95 p-6 shadow-[0_25px_65px_-15px_rgba(37,99,235,0.2)] backdrop-blur-2xl sm:p-8">
            {/* Tabs chuyển chế độ */}
            <div className="mb-6 grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1.5 ring-1 ring-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  setMode("code");
                  setResult(null);
                  setError("");
                }}
                className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all duration-300 ${
                  mode === "code"
                    ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-md shadow-blue-500/25"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Hash className="h-4 w-4" />
                Mã chứng chỉ
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("file");
                  setResult(null);
                  setError("");
                }}
                className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all duration-300 ${
                  mode === "file"
                    ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-md shadow-blue-500/25"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Upload className="h-4 w-4" />
                Tệp gốc
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {mode === "code" ? (
                <div className="mb-6">
                  <input
                    type="text"
                    placeholder="Nhập mã số chứng chỉ (VD: CERT-2026-001)"
                    value={certCodeInput}
                    onFocus={() => setIsTypingSecret(true)}
                    onBlur={() => setIsTypingSecret(false)}
                    onChange={(e) => setCertCodeInput(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-5 py-4 font-mono text-base font-semibold text-slate-900 placeholder-slate-400 transition-all focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-500/15 focus:outline-none"
                  />
                </div>
              ) : (
                <div className="mb-6 space-y-4">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) {
                        setSelectedFile(f);
                        setResult(null);
                        setError("");
                      }
                    }}
                    className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-7 text-center transition-all duration-300 ${
                      isDragging
                        ? "border-blue-600 bg-blue-50"
                        : selectedFile
                        ? "border-emerald-500 bg-emerald-50/70"
                        : "border-blue-300 bg-blue-50/40 hover:border-blue-500 hover:bg-blue-50/80"
                    }`}
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 ${
                        selectedFile
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      {selectedFile ? <CheckCircle2 className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
                    </div>

                    <p className="mt-3 text-sm font-bold text-slate-900">
                      {selectedFile ? selectedFile.name : "Chọn hoặc kéo thả tệp chứng chỉ"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">PDF • PNG • JPG</p>

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
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </div>

                  {/* Ô nhập Mã xác thực (Security Key) — Kích hoạt BIN giở trò che mặt nhưng nheo 1 mắt lén nhìn! */}
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-blue-600" />
                    <input
                      type="text"
                      placeholder="Mã xác thực (Security Key)"
                      value={securityKey}
                      onFocus={() => setIsTypingSecret(true)}
                      onBlur={() => setIsTypingSecret(false)}
                      onChange={(e) => {
                        setSecurityKey(e.target.value);
                        setResult(null);
                      }}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 py-3.5 pr-4 pl-11 font-mono text-sm font-semibold text-slate-900 placeholder-slate-400 transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-500/15 focus:outline-none"
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedHash(!showAdvancedHash)}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-600 transition hover:text-blue-600"
                    >
                      <span>Nhập mã Hash trực tiếp</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-300 ${
                          showAdvancedHash ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {showAdvancedHash && (
                      <input
                        type="text"
                        placeholder="0x..."
                        value={computedHash}
                        onFocus={() => setIsTypingSecret(true)}
                        onBlur={() => setIsTypingSecret(false)}
                        onChange={(e) => setComputedHash(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 font-mono text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 px-6 py-4 text-base font-extrabold text-white shadow-xl shadow-blue-500/25 transition-all duration-300 hover:scale-[1.01] hover:shadow-blue-500/35 active:scale-[0.99] disabled:opacity-60"
              >
                <span className="animate-shimmer pointer-events-none absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent skew-x-[-20deg]" />
                <Search className="h-5 w-5" />
                <span>{loading ? "Đang xác thực..." : "Xác minh ngay"}</span>
              </button>

              {error && (
                <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-semibold text-rose-700">
                  <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}
            </form>
          </Tilt3DCard>
        </div>

        {/* Thẻ Kết Quả Xác Minh */}
        {result && (
          <div
            ref={resultRef}
            className="mt-8 w-full overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-2xl transition-all duration-500"
          >
            {!result.exists ? (
              <div className="flex items-center gap-4 p-6 sm:p-8">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-rose-700">KHÔNG TÌM THẤY CHỨNG CHỈ</h3>
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    Mã chứng chỉ không tồn tại hoặc tệp đã bị thay đổi nội dung.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div
                  className={`flex items-center justify-between px-6 py-4 sm:px-8 ${
                    result.isValid
                      ? "bg-emerald-50 border-b border-emerald-200"
                      : "bg-rose-50 border-b border-rose-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {result.isValid ? (
                      <ShieldCheck className="h-6 w-6 text-emerald-600" />
                    ) : (
                      <ShieldAlert className="h-6 w-6 text-rose-600" />
                    )}
                    <span className="text-sm font-extrabold tracking-wide text-slate-900 uppercase">
                      {result.isValid ? "Chứng chỉ hợp lệ" : "Chứng chỉ đã thu hồi"}
                    </span>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                      result.isValid ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                    }`}
                  >
                    {result.isValid ? "ON-CHAIN VERIFIED" : "REVOKED"}
                  </span>
                </div>

                <div className="p-6 sm:p-8">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Người nhận</div>
                      <div className="mt-1 text-lg font-extrabold text-slate-900">{result.recipientName}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Mã định danh</div>
                      <div className="mt-1 font-mono text-lg font-bold text-blue-700">{result.certCode}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-xs font-semibold text-slate-500">Chương trình đào tạo</div>
                      <div className="mt-1 text-sm font-bold text-slate-800">{result.courseName}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Đơn vị cấp</div>
                      <div className="mt-1 text-sm font-semibold text-slate-700">{result.issuerUnit}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Ngày cấp</div>
                      <div className="mt-1 text-sm font-semibold text-slate-700">{result.issueDate}</div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span>Keccak-256 Hash</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(result.certHash);
                          setCopiedHash(true);
                          setTimeout(() => setCopiedHash(false), 2000);
                        }}
                        className="inline-flex items-center gap-1 font-bold text-blue-600 hover:underline"
                      >
                        {copiedHash ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedHash ? "Đã chép" : "Sao chép"}
                      </button>
                    </div>
                    <code className="block break-all font-mono text-xs text-slate-800">{result.certHash}</code>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    {result.txHash ? (
                      <a
                        href={`https://sepolia.etherscan.io/tx/${result.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
                      >
                        Xem giao dịch Etherscan <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span />
                    )}

                    <Link
                      to={`/certificate/${encodeURIComponent(result.certCode)}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700"
                    >
                      <Award className="h-4 w-4" />
                      Mở phôi văn bằng & QR
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <a
          href="#features"
          className="mt-14 inline-flex flex-col items-center gap-2 text-xs font-bold text-slate-600 transition hover:text-blue-600"
        >
          <span>Khám phá công nghệ</span>
          <ArrowDown className="h-4 w-4 animate-bounce text-blue-600" />
        </a>
      </section>

      {/* ================================================================= */}
      {/* PHẦN 2: CÁC THẺ CÔNG NGHỆ TRẮNG KÍNH MỜ 3D KHI CUỘN XUỐNG         */}
      {/* ================================================================= */}
      <section id="features" className="relative z-20 mx-auto max-w-6xl px-6 py-24">
        <RevealOnScroll className="mb-16 text-center">
          <span className="text-xs font-extrabold tracking-[0.2em] text-blue-600 uppercase">CÔNG NGHỆ LÕI</span>
          <h2 className="mt-2 text-3xl font-black text-slate-900 sm:text-4xl">Minh Bạch Tuyệt Đối</h2>
        </RevealOnScroll>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <RevealOnScroll delay={100}>
            <Tilt3DCard className="group h-full rounded-3xl border border-blue-200/80 bg-white/90 p-8 shadow-lg shadow-blue-500/5 backdrop-blur-xl transition-all duration-300 hover:border-blue-400">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                <Fingerprint className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-lg font-extrabold text-slate-900">Mã Hóa Keccak-256</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Mỗi văn bằng sở hữu một dấu vân tay mật mã duy nhất, chống mọi hành vi chỉnh sửa.
              </p>
            </Tilt3DCard>
          </RevealOnScroll>

          <RevealOnScroll delay={250}>
            <Tilt3DCard className="group h-full rounded-3xl border border-blue-200/80 bg-white/90 p-8 shadow-lg shadow-blue-500/5 backdrop-blur-xl transition-all duration-300 hover:border-blue-400">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-lg font-extrabold text-slate-900">Lưu Trữ Bất Biến</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Dữ liệu được niêm phong vĩnh viễn trên Smart Contract Ethereum Sepolia.
              </p>
            </Tilt3DCard>
          </RevealOnScroll>

          <RevealOnScroll delay={400}>
            <Tilt3DCard className="group h-full rounded-3xl border border-blue-200/80 bg-white/90 p-8 shadow-lg shadow-blue-500/5 backdrop-blur-xl transition-all duration-300 hover:border-blue-400">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                <QrCode className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-lg font-extrabold text-slate-900">Xác Thực QR 1 Chạm</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Quét mã QR in trên chứng chỉ để tự động đối chiếu trực tiếp không cần ví.
              </p>
            </Tilt3DCard>
          </RevealOnScroll>
        </div>

        <RevealOnScroll delay={200} className="mt-16">
          <div className="grid grid-cols-2 gap-6 rounded-3xl border border-blue-200/80 bg-white/90 p-8 shadow-lg shadow-blue-500/5 backdrop-blur-xl sm:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-black text-blue-600 sm:text-3xl">256-bit</div>
              <div className="mt-1 text-xs font-bold text-slate-600">Chuẩn mã hóa</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-slate-900 sm:text-3xl">0s</div>
              <div className="mt-1 text-xs font-bold text-slate-600">Không cần cài ví</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-emerald-600 sm:text-3xl">100%</div>
              <div className="mt-1 text-xs font-bold text-slate-600">Toàn vẹn dữ liệu</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-sky-600 sm:text-3xl">24/7</div>
              <div className="mt-1 text-xs font-bold text-slate-600">Tra cứu toàn cầu</div>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      <footer className="relative z-20 border-t border-blue-200/70 bg-white/60 py-8 text-center text-xs font-semibold text-slate-600">
        <a
          href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono transition hover:text-blue-600"
        >
          <span>Contract: {CONTRACT_ADDRESS}</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </footer>
    </div>
  );
}