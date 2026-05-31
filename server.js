require("dotenv").config();

const express = require("express");
const nodemailer = require("nodemailer");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory OTP storage
const otpStore = {};

// ===================== DEBUG LOGGING =====================
console.log("🚀 Server Starting...");
console.log("📧 SMTP CONFIG:");
console.log("HOST:", process.env.SMTP_HOST);
console.log("PORT:", process.env.SMTP_PORT);
console.log("USER:", process.env.SMTP_USER);
console.log("PASS EXISTS:", !!process.env.SMTP_PASS);
// =========================================================

// Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify SMTP connection on startup
transporter.verify(function (error, success) {
  if (error) {
    console.log("❌ SMTP CONNECTION FAILED:");
    console.log(error);
  } else {
    console.log("✅ SMTP READY TO SEND EMAILS");
  }
});

// ================= FRONTEND PAGE =================
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>OTP Verification</title>
</head>
<body>

<h2>Email OTP Verification</h2>

<input id="email" placeholder="Enter Email" />
<button onclick="sendOtp()">Send OTP</button>

<br><br>

<input id="otp" placeholder="Enter OTP" />
<button onclick="verifyOtp()">Verify OTP</button>

<p id="msg"></p>

<script>

async function sendOtp(){
  const email = document.getElementById("email").value;

  const res = await fetch("/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  const data = await res.json();
  document.getElementById("msg").innerText = JSON.stringify(data);
}

async function verifyOtp(){
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

// ================= SEND OTP =================
app.post("/send-otp", async (req, res) => {
  try {
    console.log("📩 SEND OTP REQUEST:", req.body);

    const { email } = req.body;

    if (!email) {
      console.log("❌ No email provided");
      return res.status(400).json({ success: false, message: "Email required" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore[email] = {
      otp,
      expires: Date.now() + 5 * 60 * 1000,
    };

    console.log("🔐 Generated OTP:", otp);

    const mailData = {
      from: process.env.SMTP_USER,
      to: email,
      subject: "Your OTP Code",
      html: `<h1>Your OTP is ${otp}</h1><p>Valid for 5 minutes</p>`,
    };

    console.log("📤 Sending email...");

    const info = await transporter.sendMail(mailData);

    console.log("✅ EMAIL SENT SUCCESSFULLY");
    console.log(info);

    res.json({
      success: true,
      message: "OTP sent successfully",
      debug: info,
    });

  } catch (err) {
    console.log("❌ ERROR SENDING OTP:");
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
      error: err.message,
      fullError: err,
    });
  }
});

// ================= VERIFY OTP =================
app.post("/verify-otp", (req, res) => {
  console.log("🔍 VERIFY OTP:", req.body);

  const { email, otp } = req.body;

  const record = otpStore[email];

  if (!record) {
    return res.json({ success: false, message: "OTP not found" });
  }

  if (Date.now() > record.expires) {
    delete otpStore[email];
    return res.json({ success: false, message: "OTP expired" });
  }

  if (record.otp !== otp) {
    return res.json({ success: false, message: "Invalid OTP" });
  }

  delete otpStore[email];

  res.json({ success: true, message: "Email verified successfully" });
});

// ================= TEST MAIL =================
app.get("/test-mail", async (req, res) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject: "SMTP TEST EMAIL",
      text: "If you got this, SMTP is working fine",
    });

    res.json({ success: true, info });
  } catch (err) {
    console.log("❌ TEST MAIL ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});