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

function getWelcomeTemplate(userName, userEmail) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { margin: 0; padding: 0; background-color: #0e0e10; font-family: sans-serif; }
      .email-container { max-width: 600px; margin: 20px auto; background-color: #121214; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; overflow: hidden; }
      .header { background: linear-gradient(90deg, #00ffe1, #8f00ff); padding: 40px 20px; text-align: center; }
      .header h1 { margin: 0; letter-spacing: 4px; color: #111111; font-size: 2.5rem; font-weight: 900; }
      .content { padding: 40px 30px; color: #ffffff; line-height: 1.6; }
      .greeting { font-size: 1.3rem; font-weight: bold; margin-bottom: 20px; color: #00ffe1; }
      .intro-text { color: #cccccc; font-size: 1.05rem; margin-bottom: 35px; }
      .section-title { font-size: 0.9rem; font-weight: bold; letter-spacing: 2px; color: #8f00ff; text-transform: uppercase; margin-top: 30px; margin-bottom: 15px; border-left: 3px solid #00ffe1; padding-left: 10px; }
      .bullet-point { margin-bottom: 15px; color: #e4e4e7; font-size: 1rem; }
      .highlight-box { background: rgba(0, 255, 225, 0.05); border: 1px dashed #00ffe1; padding: 20px; border-radius: 8px; margin: 30px 0; text-align: center; }
      .highlight-box a { color: #00ffe1; text-decoration: none; font-weight: bold; }
      .footer { background-color: #09090b; padding: 30px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05); }
      .footer p { margin: 5px 0; color: #666666; font-size: 0.85rem; }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header"><h1>DHAREX</h1></div>
      <div class="content">
        <div class="greeting">Hey! ${userName},</div>
        <p class="intro-text">
          You’re officially in.<br><br>
          Dharex is more than just a clothing brand—it’s the fusion of AI and street culture. By joining this waitlist, you’ve secured your place in the first wave of creators who will redefine what it means to wear art.
        </p>
        <div class="section-title">What Happens Now?</div>
        <div class="bullet-point"><strong>Validation:</strong> Your spot is secured at <span style="color: #00ffe1;">${userEmail}</span>.</div>
        <div class="bullet-point"><strong>The Drop:</strong> We are currently calibrating the first AI-personalized collection. We will hit your inbox the second the gateway opens.</div>
        <div class="bullet-point"><strong>Founders Status:</strong> Stay active. Early supporters get first dibs on limited drops that will never be restocked.</div>
        <div class="section-title">Want to Move Up?</div>
        <p style="color: #cccccc; margin-top: 0;">Share the movement. The more creators you bring into the legacy, the higher your priority for the first release.</p>
        <div class="highlight-box">
          <span style="color: #ffffff;">STAY CONNECTED</span><br>
          Follow the evolution on Instagram: <a href="https://instagram.com/dharex_customs" target="_blank">@dharex_customs</a>
        </div>
        <p style="margin-top: 40px; color: #ffffff; font-weight: bold;">Stay ahead of the curve.<br><span style="color: #8f00ff;">— The Dharex Team</span></p>
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

async function runWelcomeEngine() {
  console.log("Checking for fresh waitlist signups inside 24-hour bracket...");

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Note: Since we are using the modern modular layout, admin.firestore.Timestamp becomes:
  const { Timestamp } = require("firebase-admin/firestore");
  const cutoffTimestamp = Timestamp.fromDate(oneDayAgo);

  try {
    const usersSnapshot = await db.collection("users")
      .where("createdAt", ">=", cutoffTimestamp)
      .get();

    if (usersSnapshot.empty) {
      console.log("No new signups found today.");
      return;
    }

    let batchCount = 0;

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userEmail = userData.email;
      const userName = userData.name || "Creator";

      if (userEmail) {
        const htmlContent = getWelcomeTemplate(userName, userEmail);

        const mailOptions = {
          from: `"Dharex Customs" <${process.env.EMAIL_USER}>`,
          to: userEmail,
          subject: `Secure Launch Uplink Established, ${userName} 🌐`,
          html: htmlContent
        };

        await transporter.sendMail(mailOptions);
        console.log(`Welcome transmission sent securely to: ${userEmail}`);
        batchCount++;
      }
    }

    console.log(`Onboarding operations clear. Total welcomes sent: ${batchCount}`);
  } catch (error) {
    console.error("Critical Runtime Fault:", error);
    process.exit(1);
  }
}

runWelcomeEngine();
