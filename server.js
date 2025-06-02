require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// --- MONGODB CONNECTION ---
mongoose.connect(process.env.MONGODB_URI || '���_����_�_MONGODB')
    .then(() => console.log('���������� � MongoDB!'))
    .catch(err => console.error('������ ����������� � MongoDB:', err));

// --- MONGODB SCHEMA AND MODEL DEFINITION ---
const userSchema = new mongoose.Schema({
    nickname: { type: String, required: true, unique: true },
    country: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    avatar: { type: String },
    twitter_id: { type: String, unique: true, sparse: true },
    twitter_username: { type: String, unique: true, sparse: true },
    twitter_profile_url: { type: String }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ��������� middleware ��� ������
app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecretkey',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// ��������� CORS
app.use(cors({
    origin: ['https://mantlemap.xyz','https://mantlemap.xyz/index-map'],
    methods: ['GET', 'POST', 'PUT'], // ��������� PUT ��� ���������� ������ ������������
    allowedHeaders: ['Content-Type']
}));

// --- OAuth 1.0a Configuration ��� X (Twitter) ---
const oauth = OAuth({
    consumer: {
        key: process.env.TWITTER_CONSUMER_KEY,
        secret: process.env.TWITTER_CONSUMER_SECRET
    },
    signature_method: 'HMAC-SHA1',
    hash_function: (base_string, key) => crypto.createHmac('sha1', key).update(base_string).digest('base64')
});

const requestTokenURL = 'https://api.twitter.com/oauth/request_token';
const accessTokenURL = 'https://api.twitter.com/oauth/access_token';
const verifyCredentialsURL = 'https://api.twitter.com/1.1/account/verify_credentials.json';

// --- API ROUTES ---

app.get('/', (req, res) => {
    res.send('API Server is running!');
});

app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({});
        console.log(`�������� ${users.length} ������������� �� ��.`);
        res.status(200).json(users);
    } catch (error) {
        console.error('������ ��� ��������� ������������� �� MongoDB:', error);
        res.status(500).json({ message: '���������� ������ ������� ��� ��������� �������������.' });
    }
});

// --- �������� OAuth ��� X (Twitter) ---

// 1. ������������� ����� ����� X (�������� �� X)
app.get('/index-map/auth/twitter', async (req, res) => {
    try {
        const request_data = {
            url: requestTokenURL,
            method: 'POST',
            data: { oauth_callback: `${req.protocol}://${req.get('host')}/index-map/auth/twitter/callback` }
        };

        const authHeader = oauth.toHeader(oauth.authorize(request_data));

        const { data } = await axios.post(request_data.url, null, { headers: authHeader });

        const { oauth_token, oauth_token_secret, oauth_callback_confirmed } = parseOAuthResponse(data);

        if (!oauth_callback_confirmed) {
            return res.status(500).json({ message: 'OAuth callback not confirmed by Twitter.' });
        }

        req.session.oauthRequestToken = oauth_token;
        req.session.oauthRequestTokenSecret = oauth_token_secret;

        res.redirect(`https://api.twitter.com/oauth/authenticate?oauth_token=${oauth_token}`);

    } catch (error) {
        console.error('������ ��� ��������� �������������� X:', error.response ? error.response.data : error.message);
        res.status(500).json({ message: '�� ������� ������ �������������� X.' });
    }
});

// 2. �������� ����� X (����� ����������� ������������)
app.get('/index-map/auth/twitter/callback', async (req, res) => {
    const { oauth_token, oauth_verifier } = req.query;
    const { oauthRequestToken, oauthRequestTokenSecret } = req.session;

    if (!oauthRequestToken || oauth_token !== oauthRequestToken) {
        console.error('�������������� OAuth ������ � callback:', { sent: oauthRequestToken, received: oauth_token });
        return res.status(400).json({ message: '������� ���������������� OAuth �����.' });
    }

    try {
        const request_data = {
            url: accessTokenURL,
            method: 'POST',
            data: { oauth_token, oauth_verifier }
        };

        const authHeader = oauth.toHeader(oauth.authorize(request_data, {
            key: oauthRequestToken,
            secret: oauthRequestTokenSecret
        }));

        const { data } = await axios.post(request_data.url, null, { headers: authHeader });

        const { oauth_token: accessToken, oauth_token_secret: accessSecret, user_id, screen_name } = parseOAuthResponse(data);

        const profileRequestData = {
            url: verifyCredentialsURL,
            method: 'GET',
            data: { include_email: false, skip_status: true }
        };

        const profileAuthHeader = oauth.toHeader(oauth.authorize(profileRequestData, {
            key: accessToken,
            secret: accessSecret
        }));

        const { data: twitterProfile } = await axios.get(profileRequestData.url, { headers: profileAuthHeader });

        const {
            id_str: twitter_id,
            screen_name: twitter_username,
            profile_image_url_https: avatar,
            name: nickname // ������������� ����� �� X ��� ���������� ��������
        } = twitterProfile;

        let user = await User.findOne({ twitter_id });

        if (user) {
            // ������������ ��� ����������, ���������� ���
            console.log(`������������ ${nickname} (${twitter_username}) ����� ����� X.`);
            // � ������, ���� � ������� ������������ ������-�� ��� ���� �� X (��������, ������ �����),
            // �� ����� �������� ��� �����, ����� �� ��� �������� �� ���������.
            if (!user.twitter_username) {
                user.twitter_username = twitter_username;
                user.avatar = avatar ? avatar.replace('_normal', '_400x400') : null;
                user.twitter_profile_url = `https://x.com/${twitter_username}`;
                await user.save();
            }
            res.status(200).json({ message: '�������� ���� ����� X!', user });
        } else {
            // ����� ������������, ������������ ��� � ���������� ���������� ������/���������
            const newUser = new User({
                nickname,
                country: 'Unknown', // ��������� 'Unknown' ��� ����������� ������ �������������
                lat: 0, // ��������� ��������
                lng: 0, // ��������� ��������
                avatar: avatar ? avatar.replace('_normal', '_400x400') : null,
                twitter_id,
                twitter_username,
                twitter_profile_url: `https://x.com/${twitter_username}`
            });

            await newUser.save();
            console.log(`����� ������������ ${nickname} (${twitter_username}) ��������������� ����� X! ��� ���������� ������� ������.`);
            res.status(201).json({ message: '�������� ����������� ����� X! ����������, �������� ���� ������.', user: newUser });
        }

        delete req.session.oauthRequestToken;
        delete req.session.oauthRequestTokenSecret;

    } catch (error) {
        console.error('������ ��� ��������� ��������� ������ X:', error.response ? error.response.data : error.message);
        res.status(500).json({ message: '�� ������� ��������� �������������� X.' });
    }
});

// ����� ������� ��� ���������� ������ ������������ ����� �����
app.put('/api/users/:twitterId/country', async (req, res) => {
    const { twitterId } = req.params;
    const { country, lat, lng } = req.body;

    // � ���������� ����� ����� ����� �������� ��������������,
    // ����� ���������, ��� ������������ ��������� ������ ���� ������.
    // ��������, ���������� twitterId �� req.params � twitter_id �� ������.

    if (!country || lat === undefined || lng === undefined) { // ��������� �� undefined ��� 0
        return res.status(400).json({ message: 'Country, latitude, and longitude are required.' });
    }

    try {
        const user = await User.findOneAndUpdate(
            { twitter_id: twitterId },
            { $set: { country, lat, lng } },
            { new: true } // ���������� ����������� ��������
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        console.log(`������������ ${user.nickname} (${user.twitter_username}) ������� ������ �� ${country}.`);
        res.status(200).json({ message: 'Country updated successfully!', user });
    } catch (error) {
        console.error('������ ��� ���������� ������ ������������:', error);
        res.status(500).json({ message: '���������� ������ ������� ��� ���������� ������.' });
    }
});


// ��������������� ������� ��� �������� ����� ������ OAuth
function parseOAuthResponse(responseString) {
    return responseString.split('&').reduce((acc, pair) => {
        const [key, value] = pair.split('=');
        acc[key] = decodeURIComponent(value);
        return acc;
    }, {});
}

// --- ������ ������� ---
app.listen(port, () => {
    console.log(`������ ������� �� ����� ${port}`);
});