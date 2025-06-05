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

// --- ФУНКЦИЯ ДЛЯ ПРОВЕРКИ ПОДПИСКИ НА MANTLE ---
async function checkIfUserFollowsMantle(userTwitterUsername) {
    const cleanUserTwitterUsername = userTwitterUsername.replace(/^@/, '');
    const mantleOfficialScreenName = 'Mantle_Official';

    console.log(`🔍 Проверяем, подписан ли @${cleanUserTwitterUsername} на @${mantleOfficialScreenName}`);

    if (!process.env.RAPIDAPI_KEY) {
        console.warn('⚠️ RapidAPI ключ не настроен. Проверка подписки пропущена.');
        return false;
    }

    try {
        const url = `https://twitter-api45.p.rapidapi.com/checkfollow.php?user=${cleanUserTwitterUsername}&follows=${mantleOfficialScreenName}`;
        
        const options = {
            method: 'GET',
            headers: {
                'x-rapidapi-key': process.env.RAPIDAPI_KEY,
                'x-rapidapi-host': 'twitter-api45.p.rapidapi.com'
            },
            timeout: 8000
        };

        const response = await axios(url, options);
        const result = response.data;

        if (result && typeof result.is_follow === 'boolean') {
            if (result.is_follow === true) {
                console.log(`✅ @${cleanUserTwitterUsername} подписан на @${mantleOfficialScreenName}`);
                return true;
            } else {
                console.log(`❌ @${cleanUserTwitterUsername} НЕ подписан на @${mantleOfficialScreenName}`);
                return false;
            }
        } else {
            console.warn(`⚠️ Неожиданный формат ответа от RapidAPI:`, result);
            return false;
        }

    } catch (error) {
        console.error(`Ошибка при проверке подписки:`, error.response?.status, error.response?.data?.message || error.message);
        return false;
    }
}

// --- ФУНКЦИЯ ДЛЯ ПРОВЕРКИ СУЩЕСТВОВАНИЯ TWITTER АККАУНТА ---
async function checkTwitterUsername(username) {
    if (!username || username.trim() === '') {
        return false;
    }

    const cleanUsername = username.replace(/^@/, '');
    console.log(`🔍 Проверяем Twitter аккаунт: @${cleanUsername}`);
    
    // Проверка через множественные API
    const apiCheckResult = await checkTwitterMultipleAPIs(cleanUsername);
    if (apiCheckResult) {
        return true;
    }

    // Проверка через Nitter
    try {
        const publicResponse = await axios.get(`https://nitter.net/${cleanUsername}`, {
            timeout: 5000,
            validateStatus: function (status) {
                return status < 500;
            }
        });
        
        if (publicResponse.status === 200) {
            console.log(`✅ Twitter аккаунт @${cleanUsername} найден через Nitter`);
            return true;
        }
    } catch (error) {
        console.log(`⚠️ Nitter недоступен для @${cleanUsername}: ${error.message}`);
    }
    
    // Проверка через прямой URL Twitter
    try {
        const twitterResponse = await axios.get(`https://twitter.com/${cleanUsername}`, {
            timeout: 5000,
            validateStatus: function (status) {
                return status < 500;
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (twitterResponse.status === 200 && 
            !twitterResponse.data.includes('This account doesn\'t exist') &&
            !twitterResponse.data.includes('Account suspended')) {
            console.log(`✅ Twitter аккаунт @${cleanUsername} найден через прямую проверку`);
            return true;
        }
    } catch (error) {
        console.log(`⚠️ Прямая проверка Twitter недоступна для @${cleanUsername}: ${error.message}`);
    }
    
    // Последняя проверка через whitelist
    return checkTwitterUsernameWhitelist(cleanUsername);
}

// --- ФУНКЦИЯ WHITELIST ПРОВЕРКИ ---
function checkTwitterUsernameWhitelist(username) {
    console.log(`🔍 Запуск whitelist проверки для @${username}`);
    
    // Очевидно поддельные паттерны
    const obviousSpamPatterns = [
        /^[a-z]{15,}$/,
        /^(.)\1{6,}$/,
        /^[qwertyuiop]{8,}$/i,
        /^[asdfghjkl]{8,}$/i,
        /^[zxcvbnm]{8,}$/i,
        /^test[0-9]{3,}$/i,
        /^user[0-9]{3,}$/i,
        /^[0-9]{10,}$/,
        /^[bcdfghjklmnpqrstvwxyz]{15,}$/i,
        /hjklfdsapoiuytrewq|mnbvcxzasdfgh/,
    ];
    
    for (const pattern of obviousSpamPatterns) {
        if (pattern.test(username)) {
            console.log(`❌ @${username} отклонен как спам: ${pattern}`);
            return false;
        }
    }
    
    // Позитивные паттерны
    const validPatterns = [
        /^0x[a-zA-Z][a-zA-Z0-9]{3,12}$/i,
        /^[a-zA-Z]{2,8}(eth|btc|crypto|nft|defi|web3|sol|ada|dot|bnb)$/i,
        /^(crypto|bitcoin|eth|nft|defi|web3)[a-zA-Z0-9_]{2,10}$/i,
        /^[a-zA-Z]{3,12}[0-9]{1,4}$/i,
        /^[a-zA-Z]{2,8}_[a-zA-Z]{2,8}$/i,
        /^[a-zA-Z]{3,12}_?[0-9]{1,3}$/i,
        /^(real|the|mr|ms|dr)[a-zA-Z]{3,12}$/i,
        /^[a-zA-Z]{3,12}(official|real|jr|sr)$/i,
        /^[a-zA-Z][a-zA-Z0-9_]{4,14}[a-zA-Z0-9]$/i,
    ];
    
    for (const pattern of validPatterns) {
        if (pattern.test(username)) {
            console.log(`✅ @${username} принят по валидному паттерну`);
            return true;
        }
    }
    
    // Проверка на осмысленные части
    const meaningfulParts = [
        'alex', 'andrew', 'john', 'mike', 'david', 'chris', 'anna', 'maria', 'lisa', 'sarah',
        'crypto', 'bitcoin', 'eth', 'trader', 'investor', 'dev', 'tech', 'hodl', 'moon',
        'defi', 'nft', 'web3', 'doge', 'shib', 'ada', 'dot', 'sol', 'bnb', 'matic'
    ];
    
    const lowerUsername = username.toLowerCase();
    const hasMeaningfulPart = meaningfulParts.some(part => 
        lowerUsername.includes(part) && username.length >= 4 && username.length <= 15
    );
    
    if (hasMeaningfulPart) {
        console.log(`✅ @${username} принят - содержит осмысленную часть`);
        return true;
    }
    
    // Финальная проверка
    const isSuspicious = 
        username.length > 15 || 
        username.length < 3 || 
        /^[0-9]+$/.test(username) || 
        !/[a-zA-Z]/.test(username);
        
    if (!isSuspicious) {
        console.log(`✅ @${username} принят - не выглядит подозрительно`);
        return true;
    }
    
    console.log(`❌ @${username} отклонен - не прошел все проверки`);
    return false;
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
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'twitter-api47.p.rapidapi.com'
            }
        },
        {
            name: 'Twitter API v1',
            url: `https://twitter-api45.p.rapidapi.com/user.php?username=${username}`,
            headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
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
        res.status(500).json({ message: 'Внутренняя ошибка сервера при получении пользователей.' });
    }
});

app.post('/api/users', async (req, res) => {
    const { nickname, country, lat, lng, avatar, twitter_username, twitter_profile_url } = req.body;
    const ipAddress = req.realIP;

    console.log('Получены данные:', { nickname, country, twitter_username, ip: ipAddress });

    // Валидация обязательных полей
    if (!nickname || !country || lat === undefined || lng === undefined) {
        console.warn('Отсутствуют обязательные поля:', { nickname, country, lat, lng });
        return res.status(400).json({ message: 'Отсутствуют обязательные поля (никнейм, страна или координаты).' });
    }

    // Проверка Twitter username
    if (!twitter_username || twitter_username.trim() === '') {
        return res.status(400).json({ message: 'Twitter username обязателен для регистрации.' });
    }

    try {
        // Проверка существования Twitter аккаунта
        console.log(`Проверяем существование Twitter аккаунта: @${twitter_username}`);
        const twitterExists = await checkTwitterUsername(twitter_username);
        
        if (!twitterExists) {
            return res.status(400).json({ 
                message: 'Указанный Twitter аккаунт не существует. Регистрация доступна только для пользователей Twitter.' 
            });
        }

        // Проверка уникальности по IP
        const existingUserByIP = await User.findOne({ 
            ip_address: ipAddress,
            ip_address: { $exists: true, $ne: null }
        });
        
        if (existingUserByIP) {
            console.warn(`Попытка регистрации с уже использованного IP: ${ipAddress}`);
            return res.status(403).json({ 
                message: 'С этого IP-адреса уже зарегистрирован аккаунт. Разрешен только один аккаунт на IP-адрес.' 
            });
        }

        // Создание нового пользователя
        const newUser = new User({
            nickname,
            country,
            lat,
            lng,
            avatar,
            twitter_username: twitter_username.replace(/^@/, ''),
            twitter_profile_url: twitter_profile_url || `https://twitter.com/${twitter_username.replace(/^@/, '')}`,
            ip_address: ipAddress
        });

        await newUser.save();
        console.log(`Пользователь ${nickname} (@${twitter_username}) из ${country} успешно зарегистрирован!`);
        
        res.status(201).json({
            message: 'Пользователь успешно зарегистрирован!',
            user: newUser
        });

    } catch (error) {
        if (error.code === 11000) {
            console.warn('Попытка дубликата пользователя:', error.message);
            
            if (error.message.includes('nickname')) {
                return res.status(409).json({ message: 'Пользователь с таким никнеймом уже существует.' });
            } else if (error.message.includes('twitter_username')) {
                return res.status(409).json({ message: 'Пользователь с таким Twitter аккаунтом уже зарегистрирован.' });
            } else {
                return res.status(409).json({ message: 'Пользователь с такими данными уже существует.' });
            }
        }
        
        console.error('Ошибка при сохранении в БД:', error.message);
        return res.status(500).json({ 
            message: 'Внутренняя ошибка сервера при регистрации пользователя.',
            details: error.message 
        });
    }
});

app.post('/api/check-twitter', async (req, res) => {
    const { username } = req.body;
    
    if (!username) {
        return res.status(400).json({ message: 'Twitter username не указан.' });
    }
    
    try {
        const exists = await checkTwitterUsername(username);
        res.json({ exists, username: username.replace(/^@/, '') });
    } catch (error) {
        console.error('Ошибка при проверке Twitter:', error);
        res.status(500).json({ message: 'Ошибка при проверке Twitter аккаунта.' });
    }
});

// --- ЗАПУСК СЕРВЕРА ---
app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});
