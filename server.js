require("dotenv").config();

const express = require("express");
const nodemailer = require("nodemailer");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const otpStore = {};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// FRONTEND PAGE
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Email OTP Verification</title>
<style>
body{
font-family:Arial;
max-width:500px;
margin:50px auto;
padding:20px;
}
input{
width:100%;
padding:12px;
margin:10px 0;
}
button{
padding:12px 20px;
cursor:pointer;
}
#msg{
margin-top:20px;
font-weight:bold;
}
</style>
</head>
<body>

<h2>Email OTP Verification</h2>

<input id="email" type="email" placeholder="Enter Email">

<button onclick="sendOtp()">Send OTP</button>

<hr>

<input id="otp" placeholder="Enter OTP">

<button onclick="verifyOtp()">Verify OTP</button>

<div id="msg"></div>

<script>

async function sendOtp(){

const email=document.getElementById("email").value;

const res=await fetch("/send-otp",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({email})
});

const data=await res.json();

document.getElementById("msg").innerText=data.message;
}

async function verifyOtp(){

const email=document.getElementById("email").value;
const otp=document.getElementById("otp").value;

const res=await fetch("/verify-otp",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
email,
otp
})
});

const data=await res.json();

document.getElementById("msg").innerText=data.message;

if(data.success){
document.getElementById("msg").style.color="green";
}
}

</script>

</body>
</html>
`);
});

// SEND OTP
app.post("/send-otp", async (req, res) => {

  try {

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success:false,
        message:"Email required"
      });
    }

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    otpStore[email] = {
      otp,
      expires: Date.now() + 300000
    };

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: "Your OTP Code",
      html: `
        <h2>Email Verification</h2>
        <h1>${otp}</h1>
        <p>Valid for 5 minutes.</p>
      `
    });

    res.json({
      success:true,
      message:"OTP sent successfully"
    });

  } catch(err){

    console.error(err);

    res.status(500).json({
      success:false,
      message:"Failed to send OTP"
    });
  }

});

// VERIFY OTP
app.post("/verify-otp",(req,res)=>{

  const { email, otp } = req.body;

  const data = otpStore[email];

  if(!data){
    return res.status(400).json({
      success:false,
      message:"OTP not found"
    });
  }

  if(Date.now() > data.expires){

    delete otpStore[email];

    return res.status(400).json({
      success:false,
      message:"OTP expired"
    });
  }

  if(data.otp !== otp){

    return res.status(400).json({
      success:false,
      message:"Invalid OTP"
    });
  }

  delete otpStore[email];

  res.json({
    success:true,
    message:"✅ Email Verified Successfully"
  });

});

app.listen(process.env.PORT || 3000,()=>{
  console.log("Server Running");
});