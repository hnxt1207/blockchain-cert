const express = require("express");
const sql = require("mssql");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const dbConfig = {
  user: "sa",
  password: "123456",
  server: "localhost\\SQL_CSDL",
  database: "CertChainDB",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then((pool) => {
    console.log("Da ket noi thanh cong SQL Server (CertChainDB)!");
    return pool;
  })
  .catch((err) => {
    console.error("Loi ket noi SQL Server:", err.message);
  });

// 1. API Đăng ký tài khoản Sinh viên
app.post("/api/auth/register", async (req, res) => {
  const { email, password, fullName, studentCode } = req.body;
  if (!email || !password || !fullName || !studentCode) {
    return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin!" });
  }
  try {
    const pool = await poolPromise;
    const check = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .query("SELECT Id FROM Users WHERE Email = @email");

    if (check.recordset.length > 0) {
      return res.status(400).json({ message: "Email này đã được đăng ký!" });
    }

    await pool
      .request()
      .input("email", sql.NVarChar, email)
      .input("password", sql.NVarChar, password)
      .input("fullName", sql.NVarChar, fullName)
      .input("studentCode", sql.NVarChar, studentCode.trim().toUpperCase())
      .query(`
        INSERT INTO Users (Email, PasswordHash, FullName, Role, StudentCode)
        VALUES (@email, @password, @fullName, 'STUDENT', @studentCode)
      `);

    res.json({ success: true, message: "Đăng ký thành công! Vui lòng đăng nhập." });
  } catch (err) {
    res.status(500).json({ message: "Lỗi đăng ký SQL Server", error: err.message });
  }
});

// 2. API Đăng nhập chung (Trả về Role: ADMIN hoặc STUDENT)
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .input("password", sql.NVarChar, password)
      .query(
        "SELECT Id, Email, FullName, Role, StudentCode FROM Users WHERE Email = @email AND PasswordHash = @password"
      );

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: "Sai email hoặc mật khẩu!" });
    }
    res.json({ success: true, user: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ message: "Lỗi truy vấn SQL Server", error: err.message });
  }
});

// 3. API Lấy toàn bộ danh sách chứng chỉ
app.get("/api/certificates", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query("SELECT * FROM Certificates ORDER BY CreatedAt DESC");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: "Lỗi truy vấn SQL Server", error: err.message });
  }
});

// 4. API Lấy danh sách văn bằng riêng của Sinh viên đang đăng nhập
app.get("/api/my-certificates", async (req, res) => {
  const { studentCode, fullName } = req.query;
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("studentCode", sql.NVarChar, String(studentCode || "").trim())
      .input("fullName", sql.NVarChar, String(fullName || "").trim())
      .query(`
        SELECT * FROM Certificates 
        WHERE (StudentCode IS NOT NULL AND UPPER(StudentCode) = UPPER(@studentCode))
           OR (LOWER(RecipientName) = LOWER(@fullName))
        ORDER BY CreatedAt DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy văn bằng sinh viên", error: err.message });
  }
});

// 5. API Lưu chứng chỉ mới vào SQL Server
app.post("/api/certificates", async (req, res) => {
  const {
    certCode,
    studentCode,
    recipientName,
    courseName,
    issueDate,
    issuerUnit,
    securityKey,
    certHash,
    txHash,
  } = req.body;

  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("certCode", sql.NVarChar, certCode)
      .input("studentCode", sql.NVarChar, studentCode || null)
      .input("recipientName", sql.NVarChar, recipientName)
      .input("courseName", sql.NVarChar, courseName)
      .input("issueDate", sql.Date, issueDate)
      .input("issuerUnit", sql.NVarChar, issuerUnit)
      .input("securityKey", sql.NVarChar, securityKey || "")
      .input("certHash", sql.VarChar, certHash)
      .input("txHash", sql.VarChar, txHash || null)
      .query(`
        INSERT INTO Certificates 
        (CertCode, StudentCode, RecipientName, CourseName, IssueDate, IssuerUnit, SecurityKey, CertHash, TxHash, IsValid)
        VALUES (@certCode, @studentCode, @recipientName, @courseName, @issueDate, @issuerUnit, @securityKey, @certHash, @txHash, 1)
      `);

    res.json({ success: true, message: "Đã lưu chứng chỉ vào SQL Server!" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi lưu SQL Server", error: err.message });
  }
});

// 5B. API Luu danh sach chung chi cap phat hang loat (Batch) vao SQL Server
app.post("/api/certificates/batch", async (req, res) => {
  const { certificates, txHash } = req.body;
  if (!Array.isArray(certificates) || certificates.length === 0) {
    return res.status(400).json({ message: "Danh sach chung chi khong hop le!" });
  }

  let transaction;
  try {
    const pool = await poolPromise;
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    for (const cert of certificates) {
      const request = new sql.Request(transaction);
      await request
        .input("certCode", sql.VarChar, cert.certCode)
        .input("studentCode", sql.VarChar, cert.studentCode)
        .input("recipientName", sql.NVarChar, cert.recipientName)
        .input("courseName", sql.NVarChar, cert.courseName)
        .input("issueDate", sql.VarChar, cert.issueDate)
        .input("issuerUnit", sql.NVarChar, cert.issuerUnit)
        .input("securityKey", sql.VarChar, cert.securityKey)
        .input("certHash", sql.VarChar, cert.certHash)
        .input("txHash", sql.VarChar, txHash || null)
        .query(`
          INSERT INTO Certificates
            (CertCode, StudentCode, RecipientName, CourseName, IssueDate, IssuerUnit, SecurityKey, CertHash, TxHash, IsValid)
          VALUES
            (@certCode, @studentCode, @recipientName, @courseName, @issueDate, @issuerUnit, @securityKey, @certHash, @txHash, 1)
        `);
    }

    await transaction.commit();
    res.json({ success: true, message: `Da luu thanh cong ${certificates.length} chung chi vao SQL Server!` });
  } catch (err) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) {}
    }
    res.status(500).json({ message: "Loi luu hang loat SQL Server", error: err.message });
  }
});

// 6. API Cập nhật trạng thái thu hồi
app.patch("/api/certificates/:certHash/revoke", async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("certHash", sql.VarChar, req.params.certHash)
      .query("UPDATE Certificates SET IsValid = 0 WHERE CertHash = @certHash");

    res.json({ success: true, message: "Đã cập nhật trạng thái thu hồi!" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi cập nhật SQL Server", error: err.message });
  }
});

app.listen(4000, () => {
  console.log("Backend SQL Server dang chay tai http://localhost:4000");
});
