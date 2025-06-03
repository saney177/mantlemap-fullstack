require('dotenv').config(); // –ó–∞–≥—Ä—É–∂–∞–µ—Ç –ø–µ—Ä–µ–º–µ–Ω–Ω—ã–µ –æ–∫—Ä—É–∂–µ–Ω–∏—è –∏–∑ .env —Ñ–∞–π–ª–∞
const express = require('express');
const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const session = require('express-session');
<<<<<<< HEAD
const cors = require('cors'); // ƒÎˇ ÛÔ‡‚ÎÂÌËˇ CORS
const mongoose = require('mongoose'); // ƒÎˇ ‡·ÓÚ˚ Ò MongoDB
=======
const cors = require('cors'); // –î–ª—è —É–ø—Ä–∞–≤–ª–µ–Ω–∏—è CORS
const mongoose = require('mongoose'); // –î–ª—è —Ä–∞–±–æ—Ç—ã —Å MongoDB
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57

const app = express();
const port = process.env.PORT || 3000;

const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
<<<<<<< HEAD
  windowMs: 15 * 60 * 1000, // 15 ÏËÌÛÚ
  max: 100 // Ï‡ÍÒËÏÛÏ 100 Á‡ÔÓÒÓ‚ Ò Ó‰ÌÓ„Ó IP
});
app.use('/api/', limiter);

// --- œŒƒ Àﬁ◊≈Õ»≈   MONGODB ---
// ”·Â‰ËÚÂÒ¸, ˜ÚÓ process.env.MONGODB_URI ÛÒÚ‡ÌÓ‚ÎÂÌ (Ì‡ÔËÏÂ, ‚ Ù‡ÈÎÂ .env)
mongoose.connect(process.env.MONGODB_URI || '¬¿ÿ_œ”“‹_ _MONGODB')
  .then(() => console.log('œÓ‰ÍÎ˛˜ÂÌÓ Í MongoDB!'))
  .catch(err => console.error('Œ¯Ë·Í‡ ÔÓ‰ÍÎ˛˜ÂÌËˇ Í MongoDB:', err));
=======
  windowMs: 15 * 60 * 1000, // 15 –º–∏–Ω—É—Ç
  max: 100 // –º–∞–∫—Å–∏–º—É–º 100 –∑–∞–ø—Ä–æ—Å–æ–≤ —Å –æ–¥–Ω–æ–≥–æ IP
});
app.use('/api/', limiter);
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57

// --- –ü–û–î–ö–õ–Æ–ß–ï–ù–ò–ï –ö MONGODB ---
// –£–±–µ–¥–∏—Ç–µ—Å—å, —á—Ç–æ process.env.MONGODB_URI —É—Å—Ç–∞–Ω–æ–≤–ª–µ–Ω (–Ω–∞–ø—Ä–∏–º–µ—Ä, –≤ —Ñ–∞–π–ª–µ .env)
mongoose.connect(process.env.MONGODB_URI || '–í–ê–®_–ü–£–¢–¨_–ö_MONGODB')
  .then(() => console.log('–ü–æ–¥–∫–ª—é—á–µ–Ω–æ –∫ MongoDB!'))
  .catch(err => console.error('–û—à–∏–±–∫–∞ –ø–æ–¥–∫–ª—é—á–µ–Ω–∏—è –∫ MongoDB:', err));

// --- –û–ü–†–ï–î–ï–õ–ï–ù–ò–ï –°–•–ï–ú–´ –ò –ú–û–î–ï–õ–ò MONGODB ---
const userSchema = new mongoose.Schema({
    nickname: { type: String, required: true, unique: true },
    country: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    avatar: { type: String },
    twitter_username: { type: String, unique: true, sparse: true },
    twitter_profile_url: { type: String }
}, { timestamps: true }); // –î–æ–±–∞–≤–ª—è–µ—Ç –ø–æ–ª—è createdAt –∏ updatedAt

const User = mongoose.model('User', userSchema);

// --- MIDDLEWARE ---
// Middleware –¥–ª—è –æ–±—Ä–∞–±–æ—Ç–∫–∏ JSON-–∑–∞–ø—Ä–æ—Å–æ–≤
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// –ù–∞—Å—Ç—Ä–æ–π–∫–∞ CORS
app.use(cors({
<<<<<<< HEAD
    origin: ['https://mantlemap.xyz', 'https://mantlemap.xyz/index-map'], // –‡ÁÂ¯ÂÌÌ˚Â ‰ÓÏÂÌ˚
=======
    origin: ['https://mantlemap.xyz', 'https://mantlemap.xyz/index-map'], // –†–∞–∑—Ä–µ—à–µ–Ω–Ω—ã–µ –¥–æ–º–µ–Ω—ã
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

<<<<<<< HEAD
// --- SESSION » PASSPORT »Õ»÷»¿À»«¿÷»ﬂ ---
=======
// --- SESSION –ò PASSPORT –ò–ù–ò–¶–ò–ê–õ–ò–ó–ê–¶–ò–Ø ---
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));
<<<<<<< HEAD

app.use(passport.initialize());
app.use(passport.session());

// --- PASSPORT TWITTER STRATEGY ---
passport.use(new TwitterStrategy({
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    callbackURL: "https://mantlemap.xyz/index-map/auth/twitter/callback" // Œ·ÌÓ‚ËÚÂ ‰Îˇ ÔÓ‰‡Í¯ÂÌ‡
}, async (token, tokenSecret, profile, done) => {
    try {
        // œÓ‚ÂˇÂÏ, ÒÛ˘ÂÒÚ‚ÛÂÚ ÎË ÔÓÎ¸ÁÓ‚‡ÚÂÎ¸
        let user = await User.findOne({ twitter_username: profile.username });
        if (!user) {
            // —ÓÁ‰‡ÂÏ ÌÓ‚Ó„Ó ÔÓÎ¸ÁÓ‚‡ÚÂÎˇ, ÂÒÎË ÌÂ Ì‡È‰ÂÌ
            user = new User({
                nickname: profile.displayName,
                avatar: profile.photos[0].value,
                twitter_username: profile.username,
                twitter_profile_url: profile.profileUrl,
                // ”ÒÚ‡ÌÓ‚ËÚÂ ÁÌ‡˜ÂÌËˇ ÔÓ ÛÏÓÎ˜‡ÌË˛ ‰Îˇ ÒÚ‡Ì˚, ¯ËÓÚ˚ Ë ‰ÓÎ„ÓÚ˚, ÂÒÎË ÌÂÓ·ıÓ‰ËÏÓ
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

// --- Ã¿–ÿ–”“€ API ---
=======
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57

app.use(passport.initialize());
app.use(passport.session());

// --- PASSPORT TWITTER STRATEGY ---
passport.use(new TwitterStrategy({
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    callbackURL: "https://mantlemap.xyz/index-map/auth/twitter/callback" // –û–±–Ω–æ–≤–∏—Ç–µ –¥–ª—è –ø—Ä–æ–¥–∞–∫—à–µ–Ω–∞
}, async (token, tokenSecret, profile, done) => {
    try {
        // –ü—Ä–æ–≤–µ—Ä—è–µ–º, —Å—É—â–µ—Å—Ç–≤—É–µ—Ç –ª–∏ –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª—å
        let user = await User.findOne({ twitter_username: profile.username });
        if (!user) {
            // –°–æ–∑–¥–∞–µ–º –Ω–æ–≤–æ–≥–æ –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª—è, –µ—Å–ª–∏ –Ω–µ –Ω–∞–π–¥–µ–Ω
            user = new User({
                nickname: profile.displayName,
                avatar: profile.photos[0].value,
                twitter_username: profile.username,
                twitter_profile_url: profile.profileUrl,
                // –£—Å—Ç–∞–Ω–æ–≤–∏—Ç–µ –∑–Ω–∞—á–µ–Ω–∏—è –ø–æ —É–º–æ–ª—á–∞–Ω–∏—é –¥–ª—è —Å—Ç—Ä–∞–Ω—ã, —à–∏—Ä–æ—Ç—ã –∏ –¥–æ–ª–≥–æ—Ç—ã, –µ—Å–ª–∏ –Ω–µ–æ–±—Ö–æ–¥–∏–º–æ
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

// --- –ú–ê–†–®–†–£–¢–´ API ---

// –ü—Ä–æ—Å—Ç–æ–π –º–∞—Ä—à—Ä—É—Ç –¥–ª—è –ø—Ä–æ–≤–µ—Ä–∫–∏ —Ä–∞–±–æ—Ç—ã —Å–µ—Ä–≤–µ—Ä–∞
app.get('/', (req, res) => {
    res.send('API Server is running!');
});

<<<<<<< HEAD
// Twitter ‡ÛÚÂÌÚËÙËÍ‡ˆËˇ
=======
// Twitter –∞—É—Ç–µ–Ω—Ç–∏—Ñ–∏–∫–∞—Ü–∏—è
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57
app.get('/auth/twitter', passport.authenticate('twitter'));

app.get('/auth/twitter/callback', 
    passport.authenticate('twitter', { failureRedirect: '/' }),
    (req, res) => {
<<<<<<< HEAD
        // ”ÒÔÂ¯Ì‡ˇ ‡ÛÚÂÌÚËÙËÍ‡ˆËˇ, ÔÂÂÌ‡Ô‡‚ÎˇÂÏ Ì‡ ‚‡¯ ÙÓÌÚÂÌ‰ ËÎË Ô‡ÌÂÎ¸ ÛÔ‡‚ÎÂÌËˇ
        res.redirect('https://mantlemap.xyz/index-map'); // œÂÂÌ‡Ô‡‚ÎÂÌËÂ Ì‡ ‚‡¯ ÙÓÌÚÂÌ‰
    }
);

// Ã‡¯ÛÚ ‰Îˇ ÔÓÎÛ˜ÂÌËˇ ‚ÒÂı ÔÓÎ¸ÁÓ‚‡ÚÂÎÂÈ ËÁ MongoDB
=======
        // –£—Å–ø–µ—à–Ω–∞—è –∞—É—Ç–µ–Ω—Ç–∏—Ñ–∏–∫–∞—Ü–∏—è, –ø–µ—Ä–µ–Ω–∞–ø—Ä–∞–≤–ª—è–µ–º –Ω–∞ –≤–∞—à —Ñ—Ä–æ–Ω—Ç–µ–Ω–¥ –∏–ª–∏ –ø–∞–Ω–µ–ª—å —É–ø—Ä–∞–≤–ª–µ–Ω–∏—è
        res.redirect('https://mantlemap.xyz/index-map'); // –ü–µ—Ä–µ–Ω–∞–ø—Ä–∞–≤–ª–µ–Ω–∏–µ –Ω–∞ –≤–∞—à —Ñ—Ä–æ–Ω—Ç–µ–Ω–¥
    }
);

// –ú–∞—Ä—à—Ä—É—Ç –¥–ª—è –ø–æ–ª—É—á–µ–Ω–∏—è –≤—Å–µ—Ö –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª–µ–π –∏–∑ MongoDB
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}); // –ü–æ–ª—É—á–∞–µ–º –≤—Å–µ—Ö –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª–µ–π –∏–∑ –∫–æ–ª–ª–µ–∫—Ü–∏–∏
        console.log(`–ü–æ–ª—É—á–µ–Ω–æ ${users.length} –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª–µ–π –∏–∑ –ë–î.`);
        res.status(200).json(users); // –û—Ç–ø—Ä–∞–≤–ª—è–µ–º –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª–µ–π –∫–∞–∫ JSON
    } catch (error) {
        console.error('–û—à–∏–±–∫–∞ –ø—Ä–∏ –ø–æ–ª—É—á–µ–Ω–∏–∏ –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª–µ–π –∏–∑ MongoDB:', error);
        res.status(500).json({ message: '–í–Ω—É—Ç—Ä–µ–Ω–Ω—è—è –æ—à–∏–±–∫–∞ —Å–µ—Ä–≤–µ—Ä–∞ –ø—Ä–∏ –ø–æ–ª—É—á–µ–Ω–∏–∏ –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª–µ–π.' });
    }
});

<<<<<<< HEAD
require('dotenv').config(); // «‡„ÛÊ‡ÂÚ ÔÂÂÏÂÌÌ˚Â ÓÍÛÊÂÌËˇ ËÁ .env Ù‡ÈÎ‡
const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const session = require('express-session');
const cors = require('cors'); // ƒÎˇ ÛÔ‡‚ÎÂÌËˇ CORS
const mongoose = require('mongoose'); // ƒÎˇ ‡·ÓÚ˚ Ò MongoDB
const axios = require('axios'); // ƒÓ·‡‚ÎÂÌÓ ‰Îˇ ‚ÂËÙËÍ‡ˆËË hCaptcha
=======
require('dotenv').config(); // –ó–∞–≥—Ä—É–∂–∞–µ—Ç –ø–µ—Ä–µ–º–µ–Ω–Ω—ã–µ –æ–∫—Ä—É–∂–µ–Ω–∏—è –∏–∑ .env —Ñ–∞–π–ª–∞
const express = require('express');
const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const session = require('express-session');
const cors = require('cors'); // –î–ª—è —É–ø—Ä–∞–≤–ª–µ–Ω–∏—è CORS
const mongoose = require('mongoose'); // –î–ª—è —Ä–∞–±–æ—Ç—ã —Å MongoDB
const axios = require('axios'); // –î–æ–±–∞–≤–ª–µ–Ω–æ –¥–ª—è –≤–µ—Ä–∏—Ñ–∏–∫–∞—Ü–∏–∏ hCaptcha
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57

const app = express();
const port = process.env.PORT || 3000;

const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
<<<<<<< HEAD
    windowMs: 15 * 60 * 1000, // 15 ÏËÌÛÚ
    max: 100 // Ï‡ÍÒËÏÛÏ 100 Á‡ÔÓÒÓ‚ Ò Ó‰ÌÓ„Ó IP
});
app.use('/api/', limiter);

// --- œŒƒ Àﬁ◊≈Õ»≈   MONGODB ---
// ”·Â‰ËÚÂÒ¸, ˜ÚÓ process.env.MONGODB_URI ÛÒÚ‡ÌÓ‚ÎÂÌ (Ì‡ÔËÏÂ, ‚ Ù‡ÈÎÂ .env)
mongoose.connect(process.env.MONGODB_URI || '¬¿ÿ_œ”“‹_ _MONGODB')
    .then(() => console.log('œÓ‰ÍÎ˛˜ÂÌÓ Í MongoDB!'))
    .catch(err => console.error('Œ¯Ë·Í‡ ÔÓ‰ÍÎ˛˜ÂÌËˇ Í MongoDB:', err));

// --- Œœ–≈ƒ≈À≈Õ»≈ —’≈Ã€ » ÃŒƒ≈À» MONGODB ---
=======
    windowMs: 15 * 60 * 1000, // 15 –º–∏–Ω—É—Ç
    max: 100 // –º–∞–∫—Å–∏–º—É–º 100 –∑–∞–ø—Ä–æ—Å–æ–≤ —Å –æ–¥–Ω–æ–≥–æ IP
});
app.use('/api/', limiter);

// --- –ü–û–î–ö–õ–Æ–ß–ï–ù–ò–ï –ö MONGODB ---
// –£–±–µ–¥–∏—Ç–µ—Å—å, —á—Ç–æ process.env.MONGODB_URI —É—Å—Ç–∞–Ω–æ–≤–ª–µ–Ω (–Ω–∞–ø—Ä–∏–º–µ—Ä, –≤ —Ñ–∞–π–ª–µ .env)
mongoose.connect(process.env.MONGODB_URI || '–í–ê–®_–ü–£–¢–¨_–ö_MONGODB')
    .then(() => console.log('–ü–æ–¥–∫–ª—é—á–µ–Ω–æ –∫ MongoDB!'))
    .catch(err => console.error('–û—à–∏–±–∫–∞ –ø–æ–¥–∫–ª—é—á–µ–Ω–∏—è –∫ MongoDB:', err));

// --- –û–ü–†–ï–î–ï–õ–ï–ù–ò–ï –°–•–ï–ú–´ –ò –ú–û–î–ï–õ–ò MONGODB ---
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57
const userSchema = new mongoose.Schema({
    nickname: { type: String, required: true, unique: true },
    country: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    avatar: { type: String },
    twitter_username: { type: String, unique: true, sparse: true },
    twitter_profile_url: { type: String }
<<<<<<< HEAD
}, { timestamps: true }); // ƒÓ·‡‚ÎˇÂÚ ÔÓÎˇ createdAt Ë updatedAt

const User = mongoose.model('User', userSchema); // »ÒÔ‡‚ÎÂÌ ÔÓ·ÂÎ ‚ 'User '

// --- MIDDLEWARE ---
// Middleware ‰Îˇ Ó·‡·ÓÚÍË JSON-Á‡ÔÓÒÓ‚
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Õ‡ÒÚÓÈÍ‡ CORS
app.use(cors({
    origin: ['https://mantlemap.xyz', 'https://mantlemap.xyz/index-map'], // –‡ÁÂ¯ÂÌÌ˚Â ‰ÓÏÂÌ˚
=======
}, { timestamps: true }); // –î–æ–±–∞–≤–ª—è–µ—Ç –ø–æ–ª—è createdAt –∏ updatedAt

const User = mongoose.model('User', userSchema); // –ò—Å–ø—Ä–∞–≤–ª–µ–Ω –ø—Ä–æ–±–µ–ª –≤ 'User '

// --- MIDDLEWARE ---
// Middleware –¥–ª—è –æ–±—Ä–∞–±–æ—Ç–∫–∏ JSON-–∑–∞–ø—Ä–æ—Å–æ–≤
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// –ù–∞—Å—Ç—Ä–æ–π–∫–∞ CORS
app.use(cors({
    origin: ['https://mantlemap.xyz', 'https://mantlemap.xyz/index-map'], // –†–∞–∑—Ä–µ—à–µ–Ω–Ω—ã–µ –¥–æ–º–µ–Ω—ã
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

<<<<<<< HEAD
// --- SESSION » PASSPORT »Õ»÷»¿À»«¿÷»ﬂ ---
=======
// --- SESSION –ò PASSPORT –ò–ù–ò–¶–ò–ê–õ–ò–ó–ê–¶–ò–Ø ---
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57
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
<<<<<<< HEAD
    callbackURL: "https://mantlemap.xyz/index-map/auth/twitter/callback" // Œ·ÌÓ‚ËÚÂ ‰Îˇ ÔÓ‰‡Í¯ÂÌ‡
}, async (token, tokenSecret, profile, done) => {
    try {
        // œÓ‚ÂˇÂÏ, ÒÛ˘ÂÒÚ‚ÛÂÚ ÎË ÔÓÎ¸ÁÓ‚‡ÚÂÎ¸
        let user = await User.findOne({ twitter_username: profile.username });
        if (!user) {
            // —ÓÁ‰‡ÂÏ ÌÓ‚Ó„Ó ÔÓÎ¸ÁÓ‚‡ÚÂÎˇ, ÂÒÎË ÌÂ Ì‡È‰ÂÌ
=======
    callbackURL: "https://mantlemap.xyz/index-map/auth/twitter/callback" // –û–±–Ω–æ–≤–∏—Ç–µ –¥–ª—è –ø—Ä–æ–¥–∞–∫—à–µ–Ω–∞
}, async (token, tokenSecret, profile, done) => {
    try {
        // –ü—Ä–æ–≤–µ—Ä—è–µ–º, —Å—É—â–µ—Å—Ç–≤—É–µ—Ç –ª–∏ –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª—å
        let user = await User.findOne({ twitter_username: profile.username });
        if (!user) {
            // –°–æ–∑–¥–∞–µ–º –Ω–æ–≤–æ–≥–æ –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª—è, –µ—Å–ª–∏ –Ω–µ –Ω–∞–π–¥–µ–Ω
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57
            user = new User({
                nickname: profile.displayName,
                avatar: profile.photos[0].value,
                twitter_username: profile.username,
                twitter_profile_url: profile.profileUrl,
<<<<<<< HEAD
                // ”ÒÚ‡ÌÓ‚ËÚÂ ÁÌ‡˜ÂÌËˇ ÔÓ ÛÏÓÎ˜‡ÌË˛ ‰Îˇ ÒÚ‡Ì˚, ¯ËÓÚ˚ Ë ‰ÓÎ„ÓÚ˚, ÂÒÎË ÌÂÓ·ıÓ‰ËÏÓ
=======
                // –£—Å—Ç–∞–Ω–æ–≤–∏—Ç–µ –∑–Ω–∞—á–µ–Ω–∏—è –ø–æ —É–º–æ–ª—á–∞–Ω–∏—é –¥–ª—è —Å—Ç—Ä–∞–Ω—ã, —à–∏—Ä–æ—Ç—ã –∏ –¥–æ–ª–≥–æ—Ç—ã, –µ—Å–ª–∏ –Ω–µ–æ–±—Ö–æ–¥–∏–º–æ
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57
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

<<<<<<< HEAD
// --- Ã¿–ÿ–”“€ API ---

// œÓÒÚÓÈ Ï‡¯ÛÚ ‰Îˇ ÔÓ‚ÂÍË ‡·ÓÚ˚ ÒÂ‚Â‡
=======
// --- –ú–ê–†–®–†–£–¢–´ API ---

// –ü—Ä–æ—Å—Ç–æ–π –º–∞—Ä—à—Ä—É—Ç –¥–ª—è –ø—Ä–æ–≤–µ—Ä–∫–∏ —Ä–∞–±–æ—Ç—ã —Å–µ—Ä–≤–µ—Ä–∞
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57
app.get('/', (req, res) => {
    res.send('API Server is running!');
});

<<<<<<< HEAD
// Twitter ‡ÛÚÂÌÚËÙËÍ‡ˆËˇ
=======
// Twitter –∞—É—Ç–µ–Ω—Ç–∏—Ñ–∏–∫–∞—Ü–∏—è
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57
app.get('/auth/twitter', passport.authenticate('twitter'));

app.get('/auth/twitter/callback',
    passport.authenticate('twitter', { failureRedirect: '/' }),
    (req, res) => {
<<<<<<< HEAD
        // ”ÒÔÂ¯Ì‡ˇ ‡ÛÚÂÌÚËÙËÍ‡ˆËˇ, ÔÂÂÌ‡Ô‡‚ÎˇÂÏ Ì‡ ‚‡¯ ÙÓÌÚÂÌ‰ ËÎË Ô‡ÌÂÎ¸ ÛÔ‡‚ÎÂÌËˇ
        res.redirect('https://mantlemap.xyz'); // œÂÂÌ‡Ô‡‚ÎÂÌËÂ Ì‡ ‚‡¯ ÙÓÌÚÂÌ‰
    }
);

// Ã‡¯ÛÚ ‰Îˇ ÔÓÎÛ˜ÂÌËˇ ‚ÒÂı ÔÓÎ¸ÁÓ‚‡ÚÂÎÂÈ ËÁ MongoDB
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}); // œÓÎÛ˜‡ÂÏ ‚ÒÂı ÔÓÎ¸ÁÓ‚‡ÚÂÎÂÈ ËÁ ÍÓÎÎÂÍˆËË
        console.log(`œÓÎÛ˜ÂÌÓ ${users.length} ÔÓÎ¸ÁÓ‚‡ÚÂÎÂÈ ËÁ ¡ƒ.`);
        res.status(200).json(users); // ŒÚÔ‡‚ÎˇÂÏ ÔÓÎ¸ÁÓ‚‡ÚÂÎÂÈ Í‡Í JSON
    } catch (error) {
        console.error('Œ¯Ë·Í‡ ÔË ÔÓÎÛ˜ÂÌËË ÔÓÎ¸ÁÓ‚‡ÚÂÎÂÈ ËÁ MongoDB:', error);
        res.status(500).json({ message: '¬ÌÛÚÂÌÌˇˇ Ó¯Ë·Í‡ ÒÂ‚Â‡ ÔË ÔÓÎÛ˜ÂÌËË ÔÓÎ¸ÁÓ‚‡ÚÂÎÂÈ.' });
    }
});

// --- Ã‡¯ÛÚ ‰Îˇ Â„ËÒÚ‡ˆËË ÔÓÎ¸ÁÓ‚‡ÚÂÎˇ (Ò hCaptcha) ---
app.post('/api/users', async (req, res) => {
    // œÓÎÛ˜‡ÂÏ ‰‡ÌÌ˚Â ËÁ ÚÂÎ‡ Á‡ÔÓÒ‡, ‚ÍÎ˛˜‡ˇ hcaptcha_response
=======
        // –£—Å–ø–µ—à–Ω–∞—è –∞—É—Ç–µ–Ω—Ç–∏—Ñ–∏–∫–∞—Ü–∏—è, –ø–µ—Ä–µ–Ω–∞–ø—Ä–∞–≤–ª—è–µ–º –Ω–∞ –≤–∞—à —Ñ—Ä–æ–Ω—Ç–µ–Ω–¥ –∏–ª–∏ –ø–∞–Ω–µ–ª—å —É–ø—Ä–∞–≤–ª–µ–Ω–∏—è
        res.redirect('https://mantlemap.xyz'); // –ü–µ—Ä–µ–Ω–∞–ø—Ä–∞–≤–ª–µ–Ω–∏–µ –Ω–∞ –≤–∞—à —Ñ—Ä–æ–Ω—Ç–µ–Ω–¥
    }
);

// –ú–∞—Ä—à—Ä—É—Ç –¥–ª—è –ø–æ–ª—É—á–µ–Ω–∏—è –≤—Å–µ—Ö –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª–µ–π –∏–∑ MongoDB
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}); // –ü–æ–ª—É—á–∞–µ–º –≤—Å–µ—Ö –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª–µ–π –∏–∑ –∫–æ–ª–ª–µ–∫—Ü–∏–∏
        console.log(`–ü–æ–ª—É—á–µ–Ω–æ ${users.length} –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª–µ–π –∏–∑ –ë–î.`);
        res.status(200).json(users); // –û—Ç–ø—Ä–∞–≤–ª—è–µ–º –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª–µ–π –∫–∞–∫ JSON
    } catch (error) {
        console.error('–û—à–∏–±–∫–∞ –ø—Ä–∏ –ø–æ–ª—É—á–µ–Ω–∏–∏ –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª–µ–π –∏–∑ MongoDB:', error);
        res.status(500).json({ message: '–í–Ω—É—Ç—Ä–µ–Ω–Ω—è—è –æ—à–∏–±–∫–∞ —Å–µ—Ä–≤–µ—Ä–∞ –ø—Ä–∏ –ø–æ–ª—É—á–µ–Ω–∏–∏ –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª–µ–π.' });
    }
});

// --- –ú–∞—Ä—à—Ä—É—Ç –¥–ª—è —Ä–µ–≥–∏—Å—Ç—Ä–∞—Ü–∏–∏ –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª—è (—Å hCaptcha) ---
app.post('/api/users', async (req, res) => {
    // –ü–æ–ª—É—á–∞–µ–º –¥–∞–Ω–Ω—ã–µ –∏–∑ —Ç–µ–ª–∞ –∑–∞–ø—Ä–æ—Å–∞, –≤–∫–ª—é—á–∞—è hcaptcha_response
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57
    const { nickname, country, lat, lng, avatar, twitter_username, twitter_profile_url, hcaptcha_response } = req.body;

    console.log('–ü–æ–ª—É—á–µ–Ω—ã –¥–∞–Ω–Ω—ã–µ:', { nickname, country });

    // 1. –í–∞–ª–∏–¥–∞—Ü–∏—è –Ω–∞ —Å—Ç–æ—Ä–æ–Ω–µ —Å–µ—Ä–≤–µ—Ä–∞: –ø—Ä–æ–≤–µ—Ä–∫–∞ –æ–±—è–∑–∞—Ç–µ–ª—å–Ω—ã—Ö –ø–æ–ª–µ–π
    if (!nickname || !country || lat === undefined || lng === undefined) {
        console.warn('–û—Ç—Å—É—Ç—Å—Ç–≤—É—é—Ç –æ–±—è–∑–∞—Ç–µ–ª—å–Ω—ã–µ –ø–æ–ª—è:', { nickname, country, lat, lng });
        return res.status(400).json({ message: '–û—Ç—Å—É—Ç—Å—Ç–≤—É—é—Ç –æ–±—è–∑–∞—Ç–µ–ª—å–Ω—ã–µ –ø–æ–ª—è (–Ω–∏–∫–Ω–µ–π–º, —Å—Ç—Ä–∞–Ω–∞ –∏–ª–∏ –∫–æ–æ—Ä–¥–∏–Ω–∞—Ç—ã).' });
    }

    // 2. hCaptcha Verification
    if (!hcaptcha_response) {
        return res.status(400).json({ message: 'hCaptcha response is missing.' });
    }

    // 2. hCaptcha Verification
    if (!hcaptcha_response) {
        return res.status(400).json({ message: 'hCaptcha response is missing.' });
    }

    try {
        const hcaptchaVerifyUrl = 'https://hcaptcha.com/siteverify';
<<<<<<< HEAD
        const hcaptchaSecret = process.env.HCAPTCHA_SECRET_KEY; // ”·Â‰ËÚÂÒ¸, ˜ÚÓ ˝Ú‡ ÔÂÂÏÂÌÌ‡ˇ ÓÍÛÊÂÌËˇ ÛÒÚ‡ÌÓ‚ÎÂÌ‡
=======
        const hcaptchaSecret = process.env.HCAPTCHA_SECRET_KEY; // –£–±–µ–¥–∏—Ç–µ—Å—å, —á—Ç–æ —ç—Ç–∞ –ø–µ—Ä–µ–º–µ–Ω–Ω–∞—è –æ–∫—Ä—É–∂–µ–Ω–∏—è —É—Å—Ç–∞–Ω–æ–≤–ª–µ–Ω–∞
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57

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

<<<<<<< HEAD
        // 3. —Óı‡ÌˇÂÏ ÔÓÎ¸ÁÓ‚‡ÚÂÎˇ ‚ MongoDB
=======
        // 3. –°–æ—Ö—Ä–∞–Ω—è–µ–º –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª—è –≤ MongoDB
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57
        const newUser = new User({
            nickname,
            country,
            lat,
            lng,
            avatar,
            twitter_username,
            twitter_profile_url
        });

        await newUser.save(); // –°–æ—Ö—Ä–∞–Ω—è–µ–º –Ω–æ–≤–æ–≥–æ –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª—è –≤ –±–∞–∑—É –¥–∞–Ω–Ω—ã—Ö
        console.log(`–ü–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª—å ${nickname} –∏–∑ ${country} —É—Å–ø–µ—à–Ω–æ –∑–∞—Ä–µ–≥–∏—Å—Ç—Ä–∏—Ä–æ–≤–∞–Ω –∏ —Å–æ—Ö—Ä–∞–Ω–µ–Ω –≤ –ë–î!`);

        // –í–æ–∑–≤—Ä–∞—â–∞–µ–º –Ω–æ–≤–æ—Å–æ–∑–¥–∞–Ω–Ω–æ–≥–æ –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª—è —Å ID –∏–∑ –ë–î
        res.status(201).json(newUser); // 201 Created - –¥–ª—è —É—Å–ø–µ—à–Ω–æ–≥–æ —Å–æ–∑–¥–∞–Ω–∏—è —Ä–µ—Å—É—Ä—Å–∞

    } catch (error) {
<<<<<<< HEAD
        // Œ·‡·ÓÚÍ‡ Ó¯Ë·ÓÍ MongoDB Ë hCaptcha
        if (error.code === 11000) { //  Ó‰ Ó¯Ë·ÍË MongoDB ‰Îˇ ‰Û·ÎËÍ‡ÚÓ‚ ÍÎ˛˜ÂÈ
            console.warn('œÓÔ˚ÚÍ‡ ‰Û·ÎËÍ‡Ú‡ ÔÓÎ¸ÁÓ‚‡ÚÂÎˇ:', error.message);
            return res.status(409).json({ message: 'œÓÎ¸ÁÓ‚‡ÚÂÎ¸ Ò Ú‡ÍËÏ ÌËÍÌÂÈÏÓÏ ËÎË ËÏÂÌÂÏ ÔÓÎ¸ÁÓ‚‡ÚÂÎˇ Twitter ÛÊÂ ÒÛ˘ÂÒÚ‚ÛÂÚ.', details: error.message });
        }

        // ≈ÒÎË ˝ÚÓ Ó¯Ë·Í‡ axios ËÎË ‰Û„‡ˇ Ó¯Ë·Í‡, ÌÂ Ò‚ˇÁ‡ÌÌ‡ˇ Ò ‰Û·ÎËÍ‡Ú‡ÏË
        if (axios.isAxiosError(error)) {
            console.error('Œ¯Ë·Í‡ ÔË Á‡ÔÓÒÂ Í hCaptcha:', error.message);
            return res.status(500).json({ message: 'Œ¯Ë·Í‡ ÔË ‚ÂËÙËÍ‡ˆËË hCaptcha.', details: error.message });
        }

        console.error('ÕÂËÁ‚ÂÒÚÌ‡ˇ Ó¯Ë·Í‡ ÔË ÒÓı‡ÌÂÌËË ‚ ¡ƒ:', error.message);
        return res.status(500).json({ message: 'ÕÂËÁ‚ÂÒÚÌ‡ˇ Ó¯Ë·Í‡ ÔË Ó·‡·ÓÚÍÂ Á‡ÔÓÒ‡.', details: error.message });
    }
});

// --- Ã»√–¿÷»ﬂ —”Ÿ≈—“¬”ﬁŸ»’ œŒÀ‹«Œ¬¿“≈À≈… ---
async function migrateUsers() {
    try {
        const users = await User.find({}); // œÓÎÛ˜‡ÂÏ ‚ÒÂı ÔÓÎ¸ÁÓ‚‡ÚÂÎÂÈ
        for (const user of users) {
            // œÓ‚ÂˇÂÏ, ÂÒÚ¸ ÎË Û ÔÓÎ¸ÁÓ‚‡ÚÂÎˇ Twitter username
            if (!user.twitter_username) {
                // ”ÒÚ‡Ì‡‚ÎË‚‡ÂÏ Twitter username Ë profile URL, ÂÒÎË ÓÌË ÓÚÒÛÚÒÚ‚Û˛Ú
                user.twitter_username = user.nickname; // œËÏÂ: ËÒÔÓÎ¸ÁÛÂÏ nickname Í‡Í Twitter username
                user.twitter_profile_url = `https://twitter.com/${user.twitter_username}`;
                await user.save(); // —Óı‡ÌˇÂÏ Ó·ÌÓ‚ÎÂÌÌÓ„Ó ÔÓÎ¸ÁÓ‚‡ÚÂÎˇ
            }
        }
        console.log('ÃË„‡ˆËˇ ÔÓÎ¸ÁÓ‚‡ÚÂÎÂÈ Á‡‚Â¯ÂÌ‡ ÛÒÔÂ¯ÌÓ.');
    } catch (error) {
        console.error('Œ¯Ë·Í‡ ‚Ó ‚ÂÏˇ ÏË„‡ˆËË:', error);
    }
}

// «‡ÔÛÒÍ‡ÂÏ ÏË„‡ˆË˛ ÔË ÒÚ‡ÚÂ ÒÂ‚Â‡
migrateUsers();

// --- «¿œ”—  —≈–¬≈–¿ ---
=======
        // –û–±—Ä–∞–±–æ—Ç–∫–∞ –æ—à–∏–±–æ–∫ MongoDB –∏ hCaptcha
        if (error.code === 11000) { // –ö–æ–¥ –æ—à–∏–±–∫–∏ MongoDB –¥–ª—è –¥—É–±–ª–∏–∫–∞—Ç–æ–≤ –∫–ª—é—á–µ–π
            console.warn('–ü–æ–ø—ã—Ç–∫–∞ –¥—É–±–ª–∏–∫–∞—Ç–∞ –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª—è:', error.message);
            return res.status(409).json({ message: '–ü–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª—å —Å —Ç–∞–∫–∏–º –Ω–∏–∫–Ω–µ–π–º–æ–º –∏–ª–∏ –∏–º–µ–Ω–µ–º –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª—è Twitter —É–∂–µ —Å—É—â–µ—Å—Ç–≤—É–µ—Ç.', details: error.message });
        }

        // –ï—Å–ª–∏ —ç—Ç–æ –æ—à–∏–±–∫–∞ axios –∏–ª–∏ –¥—Ä—É–≥–∞—è –æ—à–∏–±–∫–∞, –Ω–µ —Å–≤—è–∑–∞–Ω–Ω–∞—è —Å –¥—É–±–ª–∏–∫–∞—Ç–∞–º–∏
        if (axios.isAxiosError(error)) {
            console.error('–û—à–∏–±–∫–∞ –ø—Ä–∏ –∑–∞–ø—Ä–æ—Å–µ –∫ hCaptcha:', error.message);
            return res.status(500).json({ message: '–û—à–∏–±–∫–∞ –ø—Ä–∏ –≤–µ—Ä–∏—Ñ–∏–∫–∞—Ü–∏–∏ hCaptcha.', details: error.message });
        }

        console.error('–ù–µ–∏–∑–≤–µ—Å—Ç–Ω–∞—è –æ—à–∏–±–∫–∞ –ø—Ä–∏ —Å–æ—Ö—Ä–∞–Ω–µ–Ω–∏–∏ –≤ –ë–î:', error.message);
        return res.status(500).json({ message: '–ù–µ–∏–∑–≤–µ—Å—Ç–Ω–∞—è –æ—à–∏–±–∫–∞ –ø—Ä–∏ –æ–±—Ä–∞–±–æ—Ç–∫–µ –∑–∞–ø—Ä–æ—Å–∞.', details: error.message });
    }
});

// --- –ú–ò–ì–†–ê–¶–ò–Ø –°–£–©–ï–°–¢–í–£–Æ–©–ò–• –ü–û–õ–¨–ó–û–í–ê–¢–ï–õ–ï–ô ---
async function migrateUsers() {
    try {
        const users = await User.find({}); // –ü–æ–ª—É—á–∞–µ–º –≤—Å–µ—Ö –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª–µ–π
        for (const user of users) {
            // –ü—Ä–æ–≤–µ—Ä—è–µ–º, –µ—Å—Ç—å –ª–∏ —É –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª—è Twitter username
            if (!user.twitter_username) {
                // –£—Å—Ç–∞–Ω–∞–≤–ª–∏–≤–∞–µ–º Twitter username –∏ profile URL, –µ—Å–ª–∏ –æ–Ω–∏ –æ—Ç—Å—É—Ç—Å—Ç–≤—É—é—Ç
                user.twitter_username = user.nickname; // –ü—Ä–∏–º–µ—Ä: –∏—Å–ø–æ–ª—å–∑—É–µ–º nickname –∫–∞–∫ Twitter username
                user.twitter_profile_url = `https://twitter.com/${user.twitter_username}`;
                await user.save(); // –°–æ—Ö—Ä–∞–Ω—è–µ–º –æ–±–Ω–æ–≤–ª–µ–Ω–Ω–æ–≥–æ –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª—è
            }
        }
        console.log('–ú–∏–≥—Ä–∞—Ü–∏—è –ø–æ–ª—å–∑–æ–≤–∞—Ç–µ–ª–µ–π –∑–∞–≤–µ—Ä—à–µ–Ω–∞ —É—Å–ø–µ—à–Ω–æ.');
    } catch (error) {
        console.error('–û—à–∏–±–∫–∞ –≤–æ –≤—Ä–µ–º—è –º–∏–≥—Ä–∞—Ü–∏–∏:', error);
    }
}

// –ó–∞–ø—É—Å–∫–∞–µ–º –º–∏–≥—Ä–∞—Ü–∏—é –ø—Ä–∏ —Å—Ç–∞—Ä—Ç–µ —Å–µ—Ä–≤–µ—Ä–∞
migrateUsers();

// --- –ó–ê–ü–£–°–ö –°–ï–†–í–ï–†–ê ---
>>>>>>> 061c5f6c200047a220e987f7eff2b47502740e57
app.listen(port, () => {
    console.log(`–°–µ—Ä–≤–µ—Ä –∑–∞–ø—É—â–µ–Ω –Ω–∞ –ø–æ—Ä—Ç—É ${port}`);
});
