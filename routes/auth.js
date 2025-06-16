const express = require('express');
const axios = require('axios');
const qs = require('qs');

const router = express.Router();

const CLIENT_ID = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI;
const BASE_URL = process.env.TIKTOK_BASE_URL || 'https://open.tiktokapis.com';

if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
  throw new Error('❌ Missing TikTok OAuth env vars. Check CLIENT_ID, CLIENT_SECRET, and REDIRECT_URI.');
}

router.get('/tiktok', (req, res) => {
  const scope = 'user.info.basic';
  const state = 'sandboxlogin';

  const authURL = `https://www.tiktok.com/v2/auth/authorize/?` +
    `client_key=${CLIENT_ID}` +
    `&response_type=code` +
    `&scope=${scope}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&state=${state}`;
    console.log("🔗 TikTok Auth URL:", authURL);

  res.redirect(authURL);
});

router.get('/tiktok/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    console.error("🚫 Missing TikTok code in callback.");
    return res.status(400).send('Missing TikTok code.');
  }

  try {
    const tokenResponse = await axios.post(
      `${BASE_URL}/v2/oauth/token/`,
      qs.stringify({
        client_key: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const accessToken = tokenResponse.data?.data?.access_token;
    if (!accessToken) {
      throw new Error('No access token returned');
    }

    const userResponse = await axios.get(`${BASE_URL}/v2/user/info/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const user = userResponse.data?.data?.user;
    if (!user) {
      throw new Error('No user data returned');
    }

    req.session.user = {
      tiktokId: user.open_id,
      username: user.display_name || user.username,
      avatar: user.avatar_url
    };

    console.log(`✅ TikTok login success: ${user.display_name || user.username}`);
    res.redirect('/tournaments.html');
  } catch (err) {
    console.error('=== TikTok Login Error ===');

    if (err.response) {
      console.error('STATUS:', err.response.status);
      console.error('DATA:', JSON.stringify(err.response.data, null, 2));
    } else if (err.request) {
      console.error('NO RESPONSE:', err.request);
    } else {
      console.error('OTHER ERROR:', err.message);
    }

    res.status(500).send('TikTok login failed.');
  }
});

module.exports = router;
