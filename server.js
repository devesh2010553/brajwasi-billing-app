require("dotenv").config();

const express = require("express");
const nodemailer = require("nodemailer");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= OTP STORE =================
const otpStore = {};

// ================= DEBUG =================
console.log("🚀 Server starting...");
console.log("📧 SMTP USER:", process.env.SMTP_USER);
console.log("🔐 PASS EXISTS:", !!process.env.SMTP_PASS);

// ================= GMAIL TRANSPORTER =================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify SMTP on startup
transporter.verify((error) => {
  if (error) {
    console.log("❌ SMTP NOT READY:");
    console.log(error);
  } else {
    console.log("✅ SMTP READY");
  }
});

// ================= FRONTEND =================
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>OTP System</title>
</head>
<body>

<h2>Email OTP Verification</h2>

<input id="email" placeholder="Enter Email"/>
<button onclick="sendOtp()">Send OTP</button>

<br><br>

<input id="otp" placeholder="Enter OTP"/>
<button onclick="verifyOtp()">Verify OTP</button>

<p id="msg"></p>

<script>

async function sendOtp(){
  const email = document.getElementById("email").value;

  const res = await fetch("/send-otp", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
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
    headers: {"Content-Type":"application/json"},
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

// ================= SEND OTP (FIXED NON-BLOCKING) =================
app.post("/send-otp", (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email required",
    });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore[email] = {
    otp,
    expires: Date.now() + 5 * 60 * 1000,
  };

  console.log("🔐 OTP GENERATED:", otp);

  // 🚀 SEND RESPONSE IMMEDIATELY (IMPORTANT FIX)
  res.json({
    success: true,
    message: "OTP sent (check email)",
  });

  // 📧 SEND EMAIL IN BACKGROUND (NO HANG)
  setImmediate(async () => {
    try {
      console.log("📤 Sending email...");

      const info = await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: email,
        subject: "Your OTP Code",
        html: `<h1>Your OTP is ${otp}</h1><p>Valid for 5 minutes</p>`,
      });

      console.log("✅ EMAIL SENT");
      console.log(info.messageId);
    } catch (err) {
      console.log("❌ EMAIL FAILED:");
      console.log(err.message);
    }
  });
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

  res.json({
    success: true,
    message: "Email verified successfully ✅",
  });
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});