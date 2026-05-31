require("dotenv").config();
const express = require("express");

const app = express();
app.use(express.json());

// OTP storage
const otpStore = {};

// ================= FRONTEND =================
app.get("/", (req, res) => {
  res.send(`
  <h2>OTP System (No SMTP Version)</h2>

  <input id="email" placeholder="Email"/>
  <button onclick="sendOtp()">Send OTP</button>

  <br><br>

  <input id="otp" placeholder="OTP"/>
  <button onclick="verifyOtp()">Verify</button>

  <p id="msg"></p>

<script>
async function sendOtp(){
  const email = document.getElementById("email").value;

  const res = await fetch("/send-otp", {
    method:"POST",
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
    method:"POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ email, otp })
  });

  const data = await res.json();
  document.getElementById("msg").innerText = JSON.stringify(data);
}
</script>
  `);
});

// ================= SEND OTP (HTTP EMAIL API) =================
app.post("/send-otp", async (req, res) => {
  const { email } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore[email] = {
    otp,
    expires: Date.now() + 5 * 60 * 1000,
  };

  console.log("OTP:", otp);

  try {
    console.log("Sending email via HTTPS API...");

    // 🔥 THIS IS THE KEY PART (NO SMTP)
    const response = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email }],
          },
        ],
        from: {
          email: "otp@yourdomain.com",
          name: "OTP System",
        },
        subject: "Your OTP Code",
        content: [
          {
            type: "text/html",
            value: `<h1>Your OTP is ${otp}</h1><p>Valid for 5 minutes</p>`,
          },
        ],
      }),
    });

    const data = await response.text();

    console.log("EMAIL API RESPONSE:", data);

    return res.json({
      success: true,
      message: "OTP sent successfully (HTTP method)",
    });

  } catch (err) {
    console.log("EMAIL ERROR:", err.message);

    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
      error: err.message,
    });
  }
});

// ================= VERIFY OTP =================
app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  const record = otpStore[email];

  if (!record) {
    return res.json({ success: false, message: "OTP not found" });
  }

  if (Date.now() > record.expires) {
    return res.json({ success: false, message: "OTP expired" });
  }

  if (record.otp !== otp) {
    return res.json({ success: false, message: "Invalid OTP" });
  }

  delete otpStore[email];

  res.json({
    success: true,
    message: "OTP verified ✅",
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running on", PORT));