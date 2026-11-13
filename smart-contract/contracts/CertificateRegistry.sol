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
    event CertificateRevoked(bytes32 indexed certHash, uint256 revokedAt);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Chi nha truong (Admin) moi co quyen thuc hien");
        _;
    }

    constructor() {
        admin = msg.sender; // Ví triển khai hợp đồng sẽ là Admin mặc định
    }

    // 1. Chức năng cấp phát văn bằng mới
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

    // 2. Chức năng thu hồi văn bằng (khi phát hiện sai sót hoặc gian lận)
    function revokeCertificate(bytes32 _certHash) external onlyAdmin {
        require(certificates[_certHash].issuedAt != 0, "Van bang khong ton tai");
        require(certificates[_certHash].isValid, "Van bang nay da bi thu hoi truoc do");

        certificates[_certHash].isValid = false;

        emit CertificateRevoked(_certHash, block.timestamp);
    }

    // 3. Chức năng tra cứu và xác thực văn bằng (ai cũng có thể gọi, không tốn phí gas)
    function verifyCertificate(bytes32 _certHash)
        external
        view
        returns (
            bool exists,
            string memory studentId,
            uint256 issuedAt,
            bool isValid
        )
    {
        Certificate memory cert = certificates[_certHash];
        if (cert.issuedAt == 0) {
            return (false, "", 0, false);
        }
        return (true, cert.studentId, cert.issuedAt, cert.isValid);
    }
}