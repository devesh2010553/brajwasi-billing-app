require("dotenv").config();

const express = require("express");
const nodemailer = require("nodemailer");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= OTP STORAGE =================
const otpStore = {};

// ================= DEBUG START =================
console.log("🚀 SERVER STARTING...");
console.log("📧 EMAIL USER:", process.env.SMTP_USER);
console.log("🔐 PASSWORD EXISTS:", !!process.env.SMTP_PASS);

// ================= TRANSPORTER (GMAIL METHOD 1) =================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify SMTP on startup
transporter.verify((err) => {
  if (err) {
    console.log("❌ SMTP CONNECTION FAILED:");
    console.log(err);
  } else {
    console.log("✅ SMTP READY");
  }
});

// ================= FRONTEND PAGE =================
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>OTP System</title>
</head>
<body>

<h2>OTP Email Verification</h2>

<input id="email" placeholder="Enter Email" />
<button onclick="sendOtp()">Send OTP</button>

<br><br>

<input id="otp" placeholder="Enter OTP" />
<button onclick="verifyOtp()">Verify OTP</button>

<p id="msg"></p>

<script>
async function sendOtp() {
  const email = document.getElementById("email").value;

  const res = await fetch("/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  const data = await res.json();
  document.getElementById("msg").innerText = JSON.stringify(data);
}

async function verifyOtp() {
  const email = document.getElementById("email").value;
  const otp = document.getElementById("otp").value;

  const res = await fetch("/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp })
  });

  const data = await res.json();
  document.getElementById("msg").innerText = JSON.stringify(data);
}
</script>

</body>
</html>
  `);
});

// ================= SEND OTP (FINAL FIXED VERSION) =================
app.post("/send-otp", async (req, res) => {
  const { email } = req.body;

  console.log("📩 REQUEST RECEIVED:", email);

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore[email] = {
    otp,
    expires: Date.now() + 5 * 60 * 1000,
  };

  console.log("🔐 OTP GENERATED:", otp);

  try {
    console.log("📤 SENDING EMAIL...");

    const info = await transporter.sendMail({
      from: `"OTP System" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Your OTP Code",
      html: `
        <div style="font-family: Arial">
          <h2>Your OTP Code</h2>
          <h1 style="color:blue">${otp}</h1>
          <p>This OTP is valid for 5 minutes.</p>
        </div>
      `,
    });

    console.log("✅ EMAIL SENT SUCCESSFULLY");
    console.log("MESSAGE ID:", info.messageId);

    return res.json({
      success: true,
      message: "OTP sent successfully",
      messageId: info.messageId,
    });

  } catch (error) {
    console.log("❌ EMAIL FAILED");
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Failed to send email",
      error: error.message,
    });
  }
});

// ================= VERIFY OTP =================
app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  const record = otpStore[email];

  if (!record) {
    return res.json({
      success: false,
      message: "OTP not found",
    });
  }

  if (Date.now() > record.expires) {
    delete otpStore[email];
    return res.json({
      success: false,
      message: "OTP expired",
    });
  }

  if (record.otp !== otp) {
    return res.json({
      success: false,
      message: "Invalid OTP",
    });
  }

  delete otpStore[email];

  return res.json({
    success: true,
    message: "OTP verified successfully ✅",
  });
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});