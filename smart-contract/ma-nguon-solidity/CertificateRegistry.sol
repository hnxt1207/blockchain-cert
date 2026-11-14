// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract CertificateRegistry {
    address public admin;

    struct Certificate {
        bytes32 certHash;      // Mã băm Keccak-256 của dữ liệu văn bằng
        string studentId;      // Mã số sinh viên
        uint256 issuedAt;      // Thời gian cấp (Timestamp)
        bool isValid;          // Trạng thái hiệu lực (true = hợp lệ, false = đã thu hồi)
    }

    // Lưu trữ danh sách văn bằng theo mã băm
    mapping(bytes32 => Certificate) private certificates;

    // Sự kiện ghi log lên Blockchain để Frontend/Backend theo dõi
    event CertificateIssued(bytes32 indexed certHash, string studentId, uint256 issuedAt);
    event BatchCertificatesIssued(uint256 count, uint256 issuedAt);
    event CertificateRevoked(bytes32 indexed certHash, uint256 revokedAt);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Chi nha truong (Admin) moi co quyen thuc hien");
        _;
    }

    constructor() {
        admin = msg.sender; // Ví triển khai hợp đồng sẽ là Admin mặc định
    }

    // 1. Chức năng cấp phát văn bằng đơn lẻ
    function issueCertificate(bytes32 _certHash, string memory _studentId) external onlyAdmin {
        require(certificates[_certHash].issuedAt == 0, "Van bang nay da ton tai tren he thong");

        certificates[_certHash] = Certificate({
            certHash: _certHash,
            studentId: _studentId,
            issuedAt: block.timestamp,
            isValid: true
        });

        emit CertificateIssued(_certHash, _studentId, block.timestamp);
    }

    // 2. Chức năng cấp phát văn bằng hàng loạt theo lô (Chỉ 1 giao dịch MetaMask)
    function issueBatchCertificates(
        bytes32[] calldata _certHashes,
        string[] calldata _studentIds
    ) external onlyAdmin {
        require(_certHashes.length > 0, "Danh sach chung chi rong");
        require(_certHashes.length == _studentIds.length, "So luong ma bam va MSSV khong khop");
        require(_certHashes.length <= 100, "Toi da 100 chung chi moi lo");

        for (uint256 i = 0; i < _certHashes.length; i++) {
            bytes32 hash = _certHashes[i];
            require(hash != bytes32(0), "Ma bam khong hop le");
            require(certificates[hash].issuedAt == 0, "Ton tai van bang da duoc cap truoc do");

            certificates[hash] = Certificate({
                certHash: hash,
                studentId: _studentIds[i],
                issuedAt: block.timestamp,
                isValid: true
            });

            emit CertificateIssued(hash, _studentIds[i], block.timestamp);
        }

        emit BatchCertificatesIssued(_certHashes.length, block.timestamp);
    }

    // 3. Chức năng thu hồi văn bằng (khi phát hiện sai sót hoặc gian lận)
    function revokeCertificate(bytes32 _certHash) external onlyAdmin {
        require(certificates[_certHash].issuedAt != 0, "Van bang khong ton tai");
        require(certificates[_certHash].isValid, "Van bang nay da bi thu hoi truoc do");

        certificates[_certHash].isValid = false;

        emit CertificateRevoked(_certHash, block.timestamp);
    }

    // 4. Chức năng tra cứu và xác thực văn bằng (ai cũng có thể gọi, không tốn phí gas)
    function verifyCertificate(bytes32 _certHash) external view returns (
        bool exists,
        string memory studentId,
        uint256 issuedAt,
        bool isValid
    ) {
        Certificate memory cert = certificates[_certHash];
        if (cert.issuedAt == 0) {
            return (false, "", 0, false);
        }
        return (true, cert.studentId, cert.issuedAt, cert.isValid);
    }
}