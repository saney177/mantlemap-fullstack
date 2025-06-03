require('dotenv').config(); // ��������� ���������� ��������� �� .env �����
const express = require('express');
const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const session = require('express-session');
const cors = require('cors'); // ��� ���������� CORS
const mongoose = require('mongoose'); // ��� ������ � MongoDB

const app = express();
const port = process.env.PORT || 3000;

const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 �����
  max: 100 // �������� 100 �������� � ������ IP
});
app.use('/api/', limiter);

// --- ����������� � MONGODB ---
// ���������, ��� process.env.MONGODB_URI ���������� (��������, � ����� .env)
mongoose.connect(process.env.MONGODB_URI || '���_����_�_MONGODB')
  .then(() => console.log('���������� � MongoDB!'))
  .catch(err => console.error('������ ����������� � MongoDB:', err));

// --- ����������� ����� � ������ MONGODB ---
const userSchema = new mongoose.Schema({
    nickname: { type: String, required: true, unique: true },
    country: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    avatar: { type: String },
    twitter_username: { type: String, unique: true, sparse: true },
    twitter_profile_url: { type: String }
}, { timestamps: true }); // ��������� ���� createdAt � updatedAt

const User = mongoose.model('User', userSchema);

// --- MIDDLEWARE ---
// Middleware ��� ��������� JSON-��������
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ��������� CORS
app.use(cors({
    origin: ['https://mantlemap.xyz', 'https://mantlemap.xyz/index-map'], // ����������� ������
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// --- SESSION � PASSPORT ������������� ---
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

// --- PASSPORT TWITTER STRATEGY ---
passport.use(new TwitterStrategy({
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    callbackURL: "https://mantlemap.xyz/index-map/auth/twitter/callback" // �������� ��� ����������
}, async (token, tokenSecret, profile, done) => {
    try {
        // ���������, ���������� �� ������������
        let user = await User.findOne({ twitter_username: profile.username });
        if (!user) {
            // ������� ������ ������������, ���� �� ������
            user = new User({
                nickname: profile.displayName,
                avatar: profile.photos[0].value,
                twitter_username: profile.username,
                twitter_profile_url: profile.profileUrl,
                // ���������� �������� �� ��������� ��� ������, ������ � �������, ���� ����������
                country: 'Unknown',
                lat: 0,
                lng: 0
            });
            await user.save();
        }
        return done(null, user);
    } catch (error) {
        return done(error);
    }
}));

passport.serializeUser ((user, done) => {
    done(null, user.id);
});

passport.deserializeUser (async (id, done) => {
    const user = await User.findById(id);
    done(null, user);
});

// --- �������� API ---

// ������� ������� ��� �������� ������ �������
app.get('/', (req, res) => {
    res.send('API Server is running!');
});

// Twitter ��������������
app.get('/auth/twitter', passport.authenticate('twitter'));

app.get('/auth/twitter/callback', 
    passport.authenticate('twitter', { failureRedirect: '/' }),
    (req, res) => {
        // �������� ��������������, �������������� �� ��� �������� ��� ������ ����������
        res.redirect('https://mantlemap.xyz/index-map'); // ��������������� �� ��� ��������
    }
);

// ������� ��� ��������� ���� ������������� �� MongoDB
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}); // �������� ���� ������������� �� ���������
        console.log(`�������� ${users.length} ������������� �� ��.`);
        res.status(200).json(users); // ���������� ������������� ��� JSON
    } catch (error) {
        console.error('������ ��� ��������� ������������� �� MongoDB:', error);
        res.status(500).json({ message: '���������� ������ ������� ��� ��������� �������������.' });
    }
});

require('dotenv').config(); // ��������� ���������� ��������� �� .env �����
const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const session = require('express-session');
const cors = require('cors'); // ��� ���������� CORS
const mongoose = require('mongoose'); // ��� ������ � MongoDB
const axios = require('axios'); // ��������� ��� ����������� hCaptcha

const app = express();
const port = process.env.PORT || 3000;

const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 �����
    max: 100 // �������� 100 �������� � ������ IP
});
app.use('/api/', limiter);

// --- ����������� � MONGODB ---
// ���������, ��� process.env.MONGODB_URI ���������� (��������, � ����� .env)
mongoose.connect(process.env.MONGODB_URI || '���_����_�_MONGODB')
    .then(() => console.log('���������� � MongoDB!'))
    .catch(err => console.error('������ ����������� � MongoDB:', err));

// --- ����������� ����� � ������ MONGODB ---
const userSchema = new mongoose.Schema({
    nickname: { type: String, required: true, unique: true },
    country: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    avatar: { type: String },
    twitter_username: { type: String, unique: true, sparse: true },
    twitter_profile_url: { type: String }
}, { timestamps: true }); // ��������� ���� createdAt � updatedAt

const User = mongoose.model('User', userSchema); // ��������� ������ � 'User '

// --- MIDDLEWARE ---
// Middleware ��� ��������� JSON-��������
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ��������� CORS
app.use(cors({
    origin: ['https://mantlemap.xyz', 'https://mantlemap.xyz/index-map'], // ����������� ������
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// --- SESSION � PASSPORT ������������� ---
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

// --- PASSPORT TWITTER STRATEGY ---
passport.use(new TwitterStrategy({
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    callbackURL: "https://mantlemap.xyz/index-map/auth/twitter/callback" // �������� ��� ����������
}, async (token, tokenSecret, profile, done) => {
    try {
        // ���������, ���������� �� ������������
        let user = await User.findOne({ twitter_username: profile.username });
        if (!user) {
            // ������� ������ ������������, ���� �� ������
            user = new User({
                nickname: profile.displayName,
                avatar: profile.photos[0].value,
                twitter_username: profile.username,
                twitter_profile_url: profile.profileUrl,
                // ���������� �������� �� ��������� ��� ������, ������ � �������, ���� ����������
                country: 'Unknown',
                lat: 0,
                lng: 0
            });
            await user.save();
        }
        return done(null, user);
    } catch (error) {
        return done(error);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    const user = await User.findById(id);
    done(null, user);
});

// --- �������� API ---

// ������� ������� ��� �������� ������ �������
app.get('/', (req, res) => {
    res.send('API Server is running!');
});

// Twitter ��������������
app.get('/auth/twitter', passport.authenticate('twitter'));

app.get('/auth/twitter/callback',
    passport.authenticate('twitter', { failureRedirect: '/' }),
    (req, res) => {
        // �������� ��������������, �������������� �� ��� �������� ��� ������ ����������
        res.redirect('https://mantlemap.xyz'); // ��������������� �� ��� ��������
    }
);

// ������� ��� ��������� ���� ������������� �� MongoDB
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}); // �������� ���� ������������� �� ���������
        console.log(`�������� ${users.length} ������������� �� ��.`);
        res.status(200).json(users); // ���������� ������������� ��� JSON
    } catch (error) {
        console.error('������ ��� ��������� ������������� �� MongoDB:', error);
        res.status(500).json({ message: '���������� ������ ������� ��� ��������� �������������.' });
    }
});

// --- ������� ��� ����������� ������������ (� hCaptcha) ---
app.post('/api/users', async (req, res) => {
    // �������� ������ �� ���� �������, ������� hcaptcha_response
    const { nickname, country, lat, lng, avatar, twitter_username, twitter_profile_url, hcaptcha_response } = req.body;

    console.log('�������� ������:', { nickname, country });

    // 1. ��������� �� ������� �������: �������� ������������ �����
    if (!nickname || !country || lat === undefined || lng === undefined) {
        console.warn('����������� ������������ ����:', { nickname, country, lat, lng });
        return res.status(400).json({ message: '����������� ������������ ���� (�������, ������ ��� ����������).' });
    }

    // 2. hCaptcha Verification
    if (!hcaptcha_response) {
        return res.status(400).json({ message: 'hCaptcha response is missing.' });
    }

    try {
        const hcaptchaVerifyUrl = 'https://hcaptcha.com/siteverify';
        const hcaptchaSecret = process.env.HCAPTCHA_SECRET_KEY; // ���������, ��� ��� ���������� ��������� �����������

        if (!hcaptchaSecret) {
            console.error('HCAPTCHA_SECRET_KEY is not defined in environment variables.');
            return res.status(500).json({ message: 'Server configuration error: hCaptcha secret key missing.' });
        }

        const verificationResponse = await axios.post(hcaptchaVerifyUrl, null, {
            params: {
                secret: hcaptchaSecret,
                response: hcaptcha_response
            }
        });

        const { success, 'error-codes': errorCodes } = verificationResponse.data;

        if (!success) {
            console.warn('hCaptcha verification failed:', errorCodes);
            return res.status(403).json({ message: 'hCaptcha verification failed. Please try again.', errorCodes });
        }
        // If success is true, continue with user creation/update
        // ... rest of your user saving logic

        // 3. ��������� ������������ � MongoDB
        const newUser = new User({
            nickname,
            country,
            lat,
            lng,
            avatar,
            twitter_username,
            twitter_profile_url
        });

        await newUser.save(); // ��������� ������ ������������ � ���� ������
        console.log(`������������ ${nickname} �� ${country} ������� ��������������� � �������� � ��!`);

        // ���������� �������������� ������������ � ID �� ��
        res.status(201).json(newUser); // 201 Created - ��� ��������� �������� �������

    } catch (error) {
        // ��������� ������ MongoDB � hCaptcha
        if (error.code === 11000) { // ��� ������ MongoDB ��� ���������� ������
            console.warn('������� ��������� ������������:', error.message);
            return res.status(409).json({ message: '������������ � ����� ��������� ��� ������ ������������ Twitter ��� ����������.', details: error.message });
        }

        // ���� ��� ������ axios ��� ������ ������, �� ��������� � �����������
        if (axios.isAxiosError(error)) {
            console.error('������ ��� ������� � hCaptcha:', error.message);
            return res.status(500).json({ message: '������ ��� ����������� hCaptcha.', details: error.message });
        }

        console.error('����������� ������ ��� ���������� � ��:', error.message);
        return res.status(500).json({ message: '����������� ������ ��� ��������� �������.', details: error.message });
    }
});

// --- �������� ������������ ������������� ---
async function migrateUsers() {
    try {
        const users = await User.find({}); // �������� ���� �������������
        for (const user of users) {
            // ���������, ���� �� � ������������ Twitter username
            if (!user.twitter_username) {
                // ������������� Twitter username � profile URL, ���� ��� �����������
                user.twitter_username = user.nickname; // ������: ���������� nickname ��� Twitter username
                user.twitter_profile_url = `https://twitter.com/${user.twitter_username}`;
                await user.save(); // ��������� ������������ ������������
            }
        }
        console.log('�������� ������������� ��������� �������.');
    } catch (error) {
        console.error('������ �� ����� ��������:', error);
    }
}

// ��������� �������� ��� ������ �������
migrateUsers();

// --- ������ ������� ---
app.listen(port, () => {
    console.log(`������ ������� �� ����� ${port}`);
});