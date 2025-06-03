require('dotenv').config(); // Loads environment variables from the .env file
const express = require('express');
const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const session = require('express-session');
const cors = require('cors'); // For CORS management
const mongoose = require('mongoose'); // For working with MongoDB
const axios = require('axios'); // Added for hCaptcha verification

const app = express();
const port = process.env.PORT || 3000;

const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // maximum 100 requests from one IP
});
app.use('/api/', limiter);

// --- MONGODB CONNECTION ---
// Ensure process.env.MONGODB_URI is set (e.g., in a .env file)
mongoose.connect(process.env.MONGODB_URI || 'YOUR_MONGODB_PATH')
    .then(() => console.log('Connected to MongoDB!'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- MONGODB SCHEMA AND MODEL DEFINITION ---
const userSchema = new mongoose.Schema({
    nickname: { type: String, required: true, unique: true },
    country: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    avatar: { type: String },
    twitter_username: { type: String, unique: true, sparse: true },
    twitter_profile_url: { type: String }
}, { timestamps: true }); // Adds createdAt and updatedAt fields

const User = mongoose.model('User', userSchema);

// --- MIDDLEWARE ---
// Middleware for handling JSON requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS setup
app.use(cors({
    origin: ['https://mantlemap.xyz', 'https://mantlemap.xyz/index-map'], // Allowed domains
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// --- SESSION AND PASSPORT INITIALIZATION ---
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
    callbackURL: "https://mantlemap.xyz/index-map/auth/twitter/callback" // Update for production
}, async (token, tokenSecret, profile, done) => {
    try {
        // Check if user exists
        let user = await User.findOne({ twitter_username: profile.username });
        if (!user) {
            // Create a new user if not found
            user = new User({
                nickname: profile.displayName,
                avatar: profile.photos[0].value,
                twitter_username: profile.username,
                twitter_profile_url: profile.profileUrl,
                // Set default values for country, latitude, and longitude if necessary
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

// --- API ROUTES ---

// Simple route to check if the server is running
app.get('/', (req, res) => {
    res.send('API Server is running!');
});

// Twitter authentication
app.get('/auth/twitter', passport.authenticate('twitter'));

app.get('/auth/twitter/callback',
    passport.authenticate('twitter', { failureRedirect: '/' }),
    (req, res) => {
        // Successful authentication, redirect to your frontend or dashboard
        res.redirect('https://mantlemap.xyz/index-map'); // Redirect to your frontend
    }
);

// Route to get all users from MongoDB
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}); // Get all users from the collection
        console.log(`Retrieved ${users.length} users from DB.`);
        res.status(200).json(users); // Send users as JSON
    } catch (error) {
        console.error('Error retrieving users from MongoDB:', error);
        res.status(500).json({ message: 'Internal server error while retrieving users.' });
    }
});

// --- Route for user registration (with hCaptcha) ---
app.post('/api/users', async (req, res) => {
    // Get data from the request body, including hcaptcha_response
    const { nickname, country, lat, lng, avatar, twitter_username, twitter_profile_url, hcaptcha_response } = req.body;

    console.log('Received data:', { nickname, country });

    // 1. Server-side validation: check for required fields
    if (!nickname || !country || lat === undefined || lng === undefined) {
        console.warn('Missing required fields:', { nickname, country, lat, lng });
        return res.status(400).json({ message: 'Missing required fields (nickname, country, or coordinates).' });
    }

    // 2. hCaptcha Verification
    if (!hcaptcha_response) {
        return res.status(400).json({ message: 'hCaptcha response is missing.' });
    }

    try {
        const hcaptchaVerifyUrl = 'https://hcaptcha.com/siteverify';
        const hcaptchaSecret = process.env.HCAPTCHA_SECRET_KEY; // Ensure this environment variable is set

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

        // 3. Save the user to MongoDB
        const newUser = new User({
            nickname,
            country,
            lat,
            lng,
            avatar,
            twitter_username,
            twitter_profile_url
        });

        await newUser.save(); // Save the new user to the database
        console.log(`User ${nickname} from ${country} successfully registered and saved to DB!`);

        // Return the newly created user with ID from DB
        res.status(201).json(newUser); // 201 Created - for successful resource creation

    } catch (error) {
        // Handle MongoDB and hCaptcha errors
        if (error.code === 11000) { // MongoDB error code for duplicate keys
            console.warn('Attempted duplicate user:', error.message);
            return res.status(409).json({ message: 'User with this nickname or Twitter username already exists.', details: error.message });
        }

        // If it's an axios error or another non-duplicate related error
        if (axios.isAxiosError(error)) {
            console.error('Error while requesting hCaptcha:', error.message);
            return res.status(500).json({ message: 'Error during hCaptcha verification.', details: error.message });
        }

        console.error('Unknown error while saving to DB:', error.message);
        return res.status(500).json({ message: 'Unknown error while processing request.', details: error.message });
    }
});

// --- EXISTING USER MIGRATION ---
async function migrateUsers() {
    try {
        const users = await User.find({}); // Get all users
        for (const user of users) {
            // Check if the user has a Twitter username
            if (!user.twitter_username) {
                // Set Twitter username and profile URL if they are missing
                user.twitter_username = user.nickname; // Example: use nickname as Twitter username
                user.twitter_profile_url = `https://twitter.com/${user.twitter_username}`;
                await user.save(); // Save the updated user
            }
        }
        console.log('User migration completed successfully.');
    } catch (error) {
        console.error('Error during migration:', error);
    }
}

// Run migration on server startup
migrateUsers();

// --- START SERVER ---
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
