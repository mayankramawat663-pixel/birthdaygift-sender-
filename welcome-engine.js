const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("Missing critical environment payload: FIREBASE_SERVICE_ACCOUNT");
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

function getBirthdayTemplate(userName, couponCode) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { margin: 0; padding: 0; background-color: #0e0e10; font-family: sans-serif; }
      .email-container { max-width: 600px; margin: 20px auto; background-color: #121214; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; overflow: hidden; }
      .header { background: linear-gradient(90deg, #8f00ff, #ff007f); padding: 40px 20px; text-align: center; }
      .header h1 { margin: 0; letter-spacing: 6px; color: #ffffff; font-size: 2.2rem; font-weight: 900; }
      .content { padding: 40px 30px; color: #ffffff; line-height: 1.6; }
      .greeting { font-size: 1.5rem; font-weight: bold; margin-bottom: 20px; color: #ff007f; text-transform: uppercase; }
      .intro-text { color: #cccccc; font-size: 1.05rem; margin-bottom: 35px; }
      .coupon-box { background: rgba(143, 0, 255, 0.1); border: 2px dashed #8f00ff; padding: 25px; border-radius: 12px; margin: 30px 0; text-align: center; }
      .coupon-code { font-family: monospace; font-size: 2rem; font-weight: bold; color: #00ffe1; letter-spacing: 5px; margin: 10px 0; }
      .footer { background-color: #09090b; padding: 30px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05); }
      .footer p { margin: 5px 0; color: #666666; font-size: 0.85rem; }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header"><h1>LEVEL UP</h1></div>
      <div class="content">
        <div class="greeting">Happy Birthday, ${userName} ⚡</div>
        <p class="intro-text">
          Another year closer to the future. You've been with us as a creator, and today your status shifts. <br><br>
          To celebrate your personal launch date, we’ve generated an exclusive, one-time admin discount code just for you. Apply it at checkout to claim your gear.
        </p>
        
        <div class="coupon-box">
          <span style="color: #ffffff; font-size: 0.9rem; letter-spacing: 2px;">YOUR EXCLUSIVE ACCESS KEY:</span>
          <div class="coupon-code">${couponCode}</div>
          <span style="color: #aaaaaa; font-size: 0.8rem;">Takes 10% OFF your entire next custom drop order.</span>
        </div>

        <p style="margin-top: 40px; color: #ffffff; font-weight: bold;">Keep breaking boundaries.<br><span style="color: #8f00ff;">— The Dharex Team</span></p>
      </div>
      <div class="footer">
        <p>© 2026 Dharex Customs. All rights reserved.</p>
        <p style="color: #999999; font-weight: bold; margin-top: 15px; letter-spacing: 1px;">Designed by AI. Defined by You.</p>
      </div>
    </div>
  </body>
  </html>
  `;
}

async function runBirthdayEngine() {
  const today = new Date();
  const currentMonth = today.getMonth() + 1; // 1-12
  const currentDate = today.getDate();       // 1-31

  console.log(`Starting scan for birthdays falling on Month: ${currentMonth}, Day: ${currentDate}...`);

  try {
    const usersSnapshot = await db.collection("users").get();

    if (usersSnapshot.empty) {
      console.log("The users collection is completely empty.");
      return;
    }

    let batchCount = 0;

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const rawBirthday = userData.birthday;
      const userEmail = userData.email;
      const userName = userData.name || "Creator";

      if (!rawBirthday || !userEmail) continue;

      let birthMonth = null;
      let birthDate = null;

      // Format 1: If it's a Firestore Timestamp or JS Date object
      if (typeof rawBirthday.toDate === "function") {
        const d = rawBirthday.toDate();
        birthMonth = d.getMonth() + 1;
        birthDate = d.getDate();
      } else if (rawBirthday instanceof Date) {
        birthMonth = rawBirthday.getMonth() + 1;
        birthDate = rawBirthday.getDate();
      } 
      // Format 2: If it's saved as a String (e.g., "2005-06-19" or "19-06-2005")
      else if (typeof rawBirthday === "string") {
        if (rawBirthday.includes("-")) {
          const parts = rawBirthday.split("-");
          // Detect YYYY-MM-DD
          if (parts[0].length === 4) {
            birthMonth = parseInt(parts[1], 10);
            birthDate = parseInt(parts[2], 10);
          } 
          // Detect DD-MM-YYYY
          else if (parts[2].length === 4) {
            birthDate = parseInt(parts[0], 10);
            birthMonth = parseInt(parts[1], 10);
          }
        }
      }

      // If the extracted month and date match today, fire the transmission!
      if (birthMonth === currentMonth && birthDate === currentDate) {
        const randomId = Math.floor(1000 + Math.random() * 9000);
        const cleanName = userName.replace(/\s+/g, '').toUpperCase();
        const customCoupon = `HBD-${cleanName}-${randomId}`;

        const htmlContent = getBirthdayTemplate(userName, customCoupon);

        const mailOptions = {
          from: `"Dharex Customs" <${process.env.EMAIL_USER}>`,
          to: userEmail,
          subject: `Exclusive Birthday Lootcrate Drop: ${customCoupon} 🎁`,
          html: htmlContent
        };

        await transporter.sendMail(mailOptions);
        console.log(`Birthday transmission successfully routed to: ${userEmail}`);
        batchCount++;
      }
    }

    console.log(`Scan completed. Total birthday dispatches sent out: ${batchCount}`);
  } catch (error) {
    console.error("Critical Birthday Engine Fault:", error);
    process.exit(1);
  }
}

runBirthdayEngine();
