import { Router } from 'express';
import { issueAuthToken } from '../helpers/token';
const { OAuth2Client } = require('google-auth-library'); 

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID_WEB);

router.post('/google', async (req, res) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: req.body.idToken,
      audience: [
        process.env.GOOGLE_CLIENT_ID_WEB,
        process.env.GOOGLE_CLIENT_ID_ANDROID,
        process.env.GOOGLE_CLIENT_ID_IOS
      ],
    });
    const payload = ticket.getPayload();
    if (payload.email_verified !== true) {
      return res.status(401).json({});
    }
    const email = payload.email;
    const data = await issueAuthToken(email, req.headers['x-forwarded-for'] || req.connection.remoteAddress);
    res.json({ email: email, token: data.token, username: data.user, expires_at: data.exp });
  }
  catch(e) {
    console.error(e);
    res.status(401).json({});
  }
});

export default router;
