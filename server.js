require('dotenv').config(); // Загружает переменные окружения из .env файла
const express = require('express');
const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const session = require('express-session');
const cors = require('cors'); // Для управления CORS
const mongoose = require('mongoose'); // Для работы с MongoDB

const app = express();
const port = process.env.PORT || 3000;

const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100 // максимум 100 запросов с одного IP
});
app.use('/api/', limiter);

// --- ПОДКЛЮЧЕНИЕ К MONGODB ---
// Убедитесь, что process.env.MONGODB_URI установлен (например, в файле .env)
mongoose.connect(process.env.MONGODB_URI || 'ВАШ_ПУТЬ_К_MONGODB')
  .then(() => console.log('Подключено к MongoDB!'))
  .catch(err => console.error('Ошибка подключения к MongoDB:', err));

// --- ОПРЕДЕЛЕНИЕ СХЕМЫ И МОДЕЛИ MONGODB ---
const userSchema = new mongoose.Schema({
    nickname: { type: String, required: true, unique: true },
    country: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    avatar: { type: String },
    twitter_username: { type: String, unique: true, sparse: true },
    twitter_profile_url: { type: String }
}, { timestamps: true }); // Добавляет поля createdAt и updatedAt

const User = mongoose.model('User', userSchema);

// --- MIDDLEWARE ---
// Middleware для обработки JSON-запросов
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Настройка CORS
app.use(cors({
    origin: ['https://mantlemap.xyz', 'https://mantlemap.xyz/index-map'], // Разрешенные домены
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// --- SESSION И PASSPORT ИНИЦИАЛИЗАЦИЯ ---
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
    callbackURL: "https://mantlemap.xyz/index-map/auth/twitter/callback" // Обновите для продакшена
}, async (token, tokenSecret, profile, done) => {
    try {
        // Проверяем, существует ли пользователь
        let user = await User.findOne({ twitter_username: profile.username });
        if (!user) {
            // Создаем нового пользователя, если не найден
            user = new User({
                nickname: profile.displayName,
                avatar: profile.photos[0].value,
                twitter_username: profile.username,
                twitter_profile_url: profile.profileUrl,
                // Установите значения по умолчанию для страны, широты и долготы, если необходимо
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

// --- МАРШРУТЫ API ---

// Простой маршрут для проверки работы сервера
app.get('/', (req, res) => {
    res.send('API Server is running!');
});

// Twitter аутентификация
app.get('/auth/twitter', passport.authenticate('twitter'));

app.get('/auth/twitter/callback', 
    passport.authenticate('twitter', { failureRedirect: '/' }),
    (req, res) => {
        // Успешная аутентификация, перенаправляем на ваш фронтенд или панель управления
        res.redirect('https://mantlemap.xyz/index-map'); // Перенаправление на ваш фронтенд
    }
);

// Маршрут для получения всех пользователей из MongoDB
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}); // Получаем всех пользователей из коллекции
        console.log(`Получено ${users.length} пользователей из БД.`);
        res.status(200).json(users); // Отправляем пользователей как JSON
    } catch (error) {
        console.error('Ошибка при получении пользователей из MongoDB:', error);
        res.status(500).json({ message: 'Внутренняя ошибка сервера при получении пользователей.' });
    }
});

require('dotenv').config(); // Загружает переменные окружения из .env файла
const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const session = require('express-session');
const cors = require('cors'); // Для управления CORS
const mongoose = require('mongoose'); // Для работы с MongoDB
const axios = require('axios'); // Добавлено для верификации hCaptcha

const app = express();
const port = process.env.PORT || 3000;

const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100 // максимум 100 запросов с одного IP
});
app.use('/api/', limiter);

// --- ПОДКЛЮЧЕНИЕ К MONGODB ---
// Убедитесь, что process.env.MONGODB_URI установлен (например, в файле .env)
mongoose.connect(process.env.MONGODB_URI || 'ВАШ_ПУТЬ_К_MONGODB')
    .then(() => console.log('Подключено к MongoDB!'))
    .catch(err => console.error('Ошибка подключения к MongoDB:', err));

// --- ОПРЕДЕЛЕНИЕ СХЕМЫ И МОДЕЛИ MONGODB ---
const userSchema = new mongoose.Schema({
    nickname: { type: String, required: true, unique: true },
    country: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    avatar: { type: String },
    twitter_username: { type: String, unique: true, sparse: true },
    twitter_profile_url: { type: String }
}, { timestamps: true }); // Добавляет поля createdAt и updatedAt

const User = mongoose.model('User', userSchema); // Исправлен пробел в 'User '

// --- MIDDLEWARE ---
// Middleware для обработки JSON-запросов
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Настройка CORS
app.use(cors({
    origin: ['https://mantlemap.xyz', 'https://mantlemap.xyz/index-map'], // Разрешенные домены
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// --- SESSION И PASSPORT ИНИЦИАЛИЗАЦИЯ ---
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
    callbackURL: "https://mantlemap.xyz/index-map/auth/twitter/callback" // Обновите для продакшена
}, async (token, tokenSecret, profile, done) => {
    try {
        // Проверяем, существует ли пользователь
        let user = await User.findOne({ twitter_username: profile.username });
        if (!user) {
            // Создаем нового пользователя, если не найден
            user = new User({
                nickname: profile.displayName,
                avatar: profile.photos[0].value,
                twitter_username: profile.username,
                twitter_profile_url: profile.profileUrl,
                // Установите значения по умолчанию для страны, широты и долготы, если необходимо
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

// --- МАРШРУТЫ API ---

// Простой маршрут для проверки работы сервера
app.get('/', (req, res) => {
    res.send('API Server is running!');
});

// Twitter аутентификация
app.get('/auth/twitter', passport.authenticate('twitter'));

app.get('/auth/twitter/callback',
    passport.authenticate('twitter', { failureRedirect: '/' }),
    (req, res) => {
        // Успешная аутентификация, перенаправляем на ваш фронтенд или панель управления
        res.redirect('https://mantlemap.xyz'); // Перенаправление на ваш фронтенд
    }
);

// Маршрут для получения всех пользователей из MongoDB
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}); // Получаем всех пользователей из коллекции
        console.log(`Получено ${users.length} пользователей из БД.`);
        res.status(200).json(users); // Отправляем пользователей как JSON
    } catch (error) {
        console.error('Ошибка при получении пользователей из MongoDB:', error);
        res.status(500).json({ message: 'Внутренняя ошибка сервера при получении пользователей.' });
    }
});

// --- Маршрут для регистрации пользователя (с hCaptcha) ---
app.post('/api/users', async (req, res) => {
    // Получаем данные из тела запроса, включая hcaptcha_response
    const { nickname, country, lat, lng, avatar, twitter_username, twitter_profile_url, hcaptcha_response } = req.body;

    console.log('Получены данные:', { nickname, country });

    // 1. Валидация на стороне сервера: проверка обязательных полей
    if (!nickname || !country || lat === undefined || lng === undefined) {
        console.warn('Отсутствуют обязательные поля:', { nickname, country, lat, lng });
        return res.status(400).json({ message: 'Отсутствуют обязательные поля (никнейм, страна или координаты).' });
    }

    // 2. hCaptcha Verification
    if (!hcaptcha_response) {
        return res.status(400).json({ message: 'hCaptcha response is missing.' });
    }

    try {
        const hcaptchaVerifyUrl = 'https://hcaptcha.com/siteverify';
        const hcaptchaSecret = process.env.HCAPTCHA_SECRET_KEY; // Убедитесь, что эта переменная окружения установлена

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

        // 3. Сохраняем пользователя в MongoDB
        const newUser = new User({
            nickname,
            country,
            lat,
            lng,
            avatar,
            twitter_username,
            twitter_profile_url
        });

        await newUser.save(); // Сохраняем нового пользователя в базу данных
        console.log(`Пользователь ${nickname} из ${country} успешно зарегистрирован и сохранен в БД!`);

        // Возвращаем новосозданного пользователя с ID из БД
        res.status(201).json(newUser); // 201 Created - для успешного создания ресурса

    } catch (error) {
        // Обработка ошибок MongoDB и hCaptcha
        if (error.code === 11000) { // Код ошибки MongoDB для дубликатов ключей
            console.warn('Попытка дубликата пользователя:', error.message);
            return res.status(409).json({ message: 'Пользователь с таким никнеймом или именем пользователя Twitter уже существует.', details: error.message });
        }

        // Если это ошибка axios или другая ошибка, не связанная с дубликатами
        if (axios.isAxiosError(error)) {
            console.error('Ошибка при запросе к hCaptcha:', error.message);
            return res.status(500).json({ message: 'Ошибка при верификации hCaptcha.', details: error.message });
        }

        console.error('Неизвестная ошибка при сохранении в БД:', error.message);
        return res.status(500).json({ message: 'Неизвестная ошибка при обработке запроса.', details: error.message });
    }
});

// --- МИГРАЦИЯ СУЩЕСТВУЮЩИХ ПОЛЬЗОВАТЕЛЕЙ ---
async function migrateUsers() {
    try {
        const users = await User.find({}); // Получаем всех пользователей
        for (const user of users) {
            // Проверяем, есть ли у пользователя Twitter username
            if (!user.twitter_username) {
                // Устанавливаем Twitter username и profile URL, если они отсутствуют
                user.twitter_username = user.nickname; // Пример: используем nickname как Twitter username
                user.twitter_profile_url = `https://twitter.com/${user.twitter_username}`;
                await user.save(); // Сохраняем обновленного пользователя
            }
        }
        console.log('Миграция пользователей завершена успешно.');
    } catch (error) {
        console.error('Ошибка во время миграции:', error);
    }
}

// Запускаем миграцию при старте сервера
migrateUsers();

// --- ЗАПУСК СЕРВЕРА ---
app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});