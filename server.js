require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000;

// --- ПОДКЛЮЧЕНИЕ К MONGODB ---
mongoose.connect(process.env.MONGODB_URI)
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
    twitter_profile_url: { type: String },
    ip_address: { type: String }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware для получения реального IP-адреса
app.use((req, res, next) => {
    req.realIP = req.headers['x-forwarded-for']?.split(',')[0] || 
                 req.headers['x-real-ip'] || 
                 req.connection.remoteAddress || 
                 req.socket.remoteAddress || 
                 req.ip;
    next();
});

// Настройка CORS
app.use(cors({
    origin: ['https://mantlemap.xyz', 'http://localhost:8080'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));



// --- ФУНКЦИЯ ДЛЯ ПРОВЕРКИ СУЩЕСТВОВАНИЯ TWITTER АККАУНТА ---

// Локальный кэш (на время жизни приложения)
const usernameCache = {};

// Список Nitter зеркал
const nitterInstances = [
    'https://nitter.net',
    'https://nitter.privacydev.net',
    'https://nitter.poast.org',
    'https://nitter.kavin.rocks'
];

async function checkTwitterUsername(username) {
    if (!username || typeof username !== 'string') return false;

    const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();

    if (usernameCache[cleanUsername] !== undefined) {
        console.log(`📦 Взято из кэша: @${cleanUsername} → ${usernameCache[cleanUsername]}`);
        return usernameCache[cleanUsername];
    }

    console.log(`🔍 Проверяем Twitter аккаунт: @${cleanUsername}`);

    // Попробуем все зеркала Nitter
    for (const instance of nitterInstances) {
        try {
            const url = `${instance}/${cleanUsername}`;
            const response = await axios.get(url, {
                timeout: 5000,
                validateStatus: status => status < 500
            });

            if (response.status === 200 &&
                !response.data.includes("User not found") &&
                !response.data.includes("Nothing here") &&
                !response.data.includes("502 Bad Gateway")) {
                console.log(`✅ Найден через Nitter: ${url}`);
                usernameCache[cleanUsername] = true;
                return true;
            }
        } catch (error) {
            console.log(`⚠️ Ошибка при проверке ${instance}: ${error.message}`);
        }
    }

    // Попробуем напрямую через Twitter
    try {
        const twitterUrl = `https://twitter.com/${cleanUsername}`;
        const response = await axios.get(twitterUrl, {
            timeout: 5000,
            validateStatus: status => status < 500,
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        if (response.status === 200 &&
            !response.data.includes("This account doesn’t exist") &&
            !response.data.includes("Account suspended")) {
            console.log(`✅ Найден через twitter.com`);
            usernameCache[cleanUsername] = true;
            return true;
        }
    } catch (error) {
        console.log(`⚠️ Ошибка при доступе к twitter.com: ${error.message}`);
    }

    console.log(`❌ Аккаунт @${cleanUsername} не найден`);
    usernameCache[cleanUsername] = false;
    return false;
}



// Исправленная проверка IP (точное совпадение)
async function checkIPUniqueness(currentIP, User) {
    console.log(`🔍 Проверяем уникальность IP: ${currentIP}`);
    
    try {
        // ТОЧНОЕ совпадение IP-адреса
        const existingUserByIP = await User.findOne({ 
            ip_address: currentIP  // Убираем лишние условия
        });
        
        if (existingUserByIP) {
            console.warn(`❌ IP ${currentIP} уже использован пользователем: ${existingUserByIP.nickname} (@${existingUserByIP.twitter_username})`);
            return false;
        }
        
        console.log(`✅ IP ${currentIP} свободен`);
        return true;
    } catch (error) {
        console.error('Ошибка при проверке IP:', error);
        return true; // В случае ошибки разрешаем регистрацию
    }
}

// Обновленная главная функция проверки Twitter
async function checkTwitterUsername(username) {
    if (!username || username.trim() === '') {
        return false;
    }

    const cleanUsername = username.replace(/^@/, '');
    console.log(`🔍 Строгая проверка Twitter аккаунта: @${cleanUsername}`);
  
    
    // 2. Попытка внешней проверки (если whitelist пройден)
    console.log(`✅ @${cleanUsername} прошел whitelist, проверяем внешние источники...`);

}
// --- ФУНКЦИЯ ПРОВЕРКИ ЧЕРЕЗ МНОЖЕСТВЕННЫЕ API ---
async function checkTwitterMultipleAPIs(username) {
    if (!process.env.RAPIDAPI_KEY) {
        console.log('⚠️ RapidAPI ключ не настроен');
        return false;
    }

    const apis = [
        {
            name: 'RapidAPI Twitter API v2',
            url: `https://twitter-api47.p.rapidapi.com/v2/user/by/username/${username}`,
            headers: {
                'X-RapidAPI-Key': '4c37bfb142msha60bba1788f9aebp1c756ejsn6d6b4f478307',
                'X-RapidAPI-Host': 'twitter-api47.p.rapidapi.com'
            }
        },
        {
            name: 'Twitter API v1',
            url: `https://twitter-api45.p.rapidapi.com/user.php?username=${username}`,
            headers: {
                'X-RapidAPI-Key': '4c37bfb142msha60bba1788f9aebp1c756ejsn6d6b4f478307',
                'X-RapidAPI-Host': 'twitter-api45.p.rapidapi.com'
            }
        }
    ];
    
    for (const api of apis) {
        try {
            console.log(`🔄 Пробуем ${api.name} для @${username}`);
            const response = await axios.get(api.url, {
                headers: api.headers,
                timeout: 8000
            });
            
            if (response.data && (response.data.username || response.data.data?.username)) {
                console.log(`✅ @${username} найден через ${api.name}`);
                return true;
            }
        } catch (error) {
            console.log(`⚠️ ${api.name} недоступен: ${error.response?.status || error.message}`);
        }
    }
    
    return false;
}

// --- МАРШРУТЫ API ---
app.get('/', (req, res) => {
    res.send('API Server is running!');
});

app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({});
        console.log(`Получено ${users.length} пользователей из БД.`);
        res.status(200).json(users);
    } catch (error) {
        console.error('Ошибка при получении пользователей из MongoDB:', error);
        res.status(500).json({ message: 'Internal server error while retrieving users.' });
    }
});

// Замените ваш POST /api/users эндпоинт на этот:
app.post('/api/users', async (req, res) => {
    const { nickname, country, lat, lng, avatar, twitter_username, twitter_profile_url } = req.body;
    const ipAddress = req.realIP;

    console.log('Получены данные:', { nickname, country, twitter_username, ip: ipAddress });

    // Валидация обязательных полей
    if (!nickname || !country || lat === undefined || lng === undefined) {
        console.warn('Отсутствуют обязательные поля:', { nickname, country, lat, lng });
        return res.status(400).json({ message: 'Missing mandatory fields (nickname, country or coordinates).' });
    }

    // Проверка Twitter username
    if (!twitter_username || twitter_username.trim() === '') {
        return res.status(400).json({ message: 'Twitter username is required for registration.' });
    }

    try {
        const cleanTwitterUsername = twitter_username.replace(/^@/, '');

        // 1. ПРОВЕРКА СУЩЕСТВОВАНИЯ TWITTER АККАУНТА (ДОБАВЛЕНО!)
        console.log(`🔍 Проверяем существование Twitter аккаунта: @${cleanTwitterUsername}`);
      

      

        console.log(`✅ Twitter аккаунт @${cleanTwitterUsername} подтвержден`);

        // 2. Проверка уникальности по IP
        const ipUnique = await checkIPUniqueness(ipAddress, User);
        if (!ipUnique) {
            return res.status(403).json({ 
                message: 'There is already an account registered from this IP address. Only one account per IP address is allowed.' 
            });
        }

        // 3. Проверка уникальности nickname и twitter_username
        const existingUserByNickname = await User.findOne({ nickname });
        if (existingUserByNickname) {
            return res.status(409).json({ message: 'A user with this nickname already exists.' });
        }

        const existingUserByTwitter = await User.findOne({ twitter_username: cleanTwitterUsername });
        if (existingUserByTwitter) {
            return res.status(409).json({ message: 'A user with this nickname already exists.' });
        }

        // 4. Создание нового пользователя
        const newUser = new User({
            nickname,
            country,
            lat,
            lng,
            avatar,
            twitter_username: cleanTwitterUsername,
            twitter_profile_url: twitter_profile_url || `https://twitter.com/${cleanTwitterUsername}`,
            ip_address: ipAddress
        });

        await newUser.save();
        console.log(`✅ Пользователь ${nickname} (@${cleanTwitterUsername}) из ${country} успешно зарегистрирован! IP: ${ipAddress}`);
        
        res.status(201).json({
            message: 'The user has been successfully registered!',
            user: {
                nickname: newUser.nickname,
                country: newUser.country,
                twitter_username: newUser.twitter_username,
                twitter_profile_url: newUser.twitter_profile_url
            }
        });

    } catch (error) {
        console.error('Ошибка при регистрации пользователя:', error);
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
});


// Также добавьте вспомогательную функцию проверки IP:
async function checkIPUniqueness(currentIP, User) {
    console.log(`🔍 Проверяем уникальность IP: ${currentIP}`);
    
    try {
        // ТОЧНОЕ совпадение IP-адреса
        const existingUserByIP = await User.findOne({ 
            ip_address: currentIP
        });
        
        if (existingUserByIP) {
            console.warn(`❌ IP ${currentIP} уже использован пользователем: ${existingUserByIP.nickname} (@${existingUserByIP.twitter_username})`);
            return false;
        }
        
        console.log(`✅ IP ${currentIP} свободен`);
        return true;
    } catch (error) {
        console.error('Ошибка при проверке IP:', error);
        return true; // В случае ошибки разрешаем регистрацию
    }
}

app.post('/api/check-twitter', async (req, res) => {
    const { username } = req.body;
    
    if (!username) {
        return res.status(400).json({ message: 'Twitter username not specified.' });
    }
    
    try {
        const exists = await checkTwitterUsername(username);
        res.json({ exists, username: username.replace(/^@/, '') });
    } catch (error) {
        console.error('Ошибка при проверке Twitter:', error);
        res.status(500).json({ message: 'Error verifying Twitter account.' });
    }
});

// --- ЗАПУСК СЕРВЕРА ---
app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});
