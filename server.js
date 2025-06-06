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
// Исправленная функция whitelist с более строгими правилами
function enhancedTwitterUsernameWhitelist(username) {
    console.log(`🔍 Строгая whitelist проверка для @${username}`);
    
    // Базовые проверки длины и символов
    if (username.length < 3 || username.length > 15) {
        console.log(`❌ @${username} - неверная длина (${username.length})`);
        return false;
    }
    
    // Проверка на допустимые символы Twitter
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        console.log(`❌ @${username} - недопустимые символы`);
        return false;
    }
  
    
    // СТРОГИЕ ПРОВЕРКИ НА СПАМ (расширенный список)
    const strictSpamPatterns = [
        // Случайные буквенные комбинаци
        /^(.)\1{4,}$/,                   // повторяющиеся символы (aaaaa)
        
        // Тестовые/фейковые аккаунты
        /^test[0-9]{2,}$/i,              // test123456
        /^user[0-9]{2,}$/i,              // user123456
        /^fake[a-z0-9]{2,}$/i,           // fake...
        /^spam[a-z0-9]{2,}$/i,           // spam...
        /^bot[a-z0-9]{2,}$/i,            // bot...
        
        // Только цифры или только цифры с буквами
        /^[0-9]{4,}$/,                   // только цифры 6+
        /^[a-z][0-9]{6,}$/i,             // буква + много цифр
        
        // Случайные комбинации
        /^[bcdfghjklmnpqrstvwxyz]{6,}$/i, // только согласные 8+
        /^[aeiou]{4,}$/i,                // только гласные 6
        
    ];
    
    for (const pattern of strictSpamPatterns) {
        if (pattern.test(username)) {
            console.log(`❌ @${username} отклонен как спам: ${pattern}`);
            return false;
        }
    }
    
    // ДОПОЛНИТЕЛЬНАЯ ЭВРИСТИЧЕСКАЯ ПРОВЕРКА
    const vowels = (username.match(/[aeiou]/gi) || []).length;
    const consonants = (username.match(/[bcdfghjklmnpqrstvwxyz]/gi) || []).length;
    const totalLetters = vowels + consonants;
    
        // Слишком мало гласных = подозрительно
        if (vowelRatio < 0.1 && totalLetters > 6) {
            console.log(`❌ @${username} - слишком мало гласных (${vowelRatio.toFixed(2)})`);
            return false;
        }
        
        // Слишком много гласных = подозрительно  
        if (vowelRatio > 0.7 && totalLetters > 5) {
            console.log(`❌ @${username} - слишком много гласных (${vowelRatio.toFixed(2)})`);
            return false;
        }
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
    
    // 1. СТРОГАЯ whitelist проверка (главный фильтр)
    if (!enhancedTwitterUsernameWhitelist(cleanUsername)) {
        console.log(`❌ @${cleanUsername} отклонен строгой whitelist проверкой`);
        return false;
    }
    
    // 2. Попытка внешней проверки (если whitelist пройден)
    console.log(`✅ @${cleanUsername} прошел whitelist, проверяем внешние источники...`);
    
    const checkMethods = [
        checkTwitterThroughMirrors,
        // Убираем ненадежные методы временно
        // checkTwitterThroughSearch,
        // checkTwitterThroughArchives,
        // checkTwitterThroughSocialAggregators
    ];
    
    for (const checkMethod of checkMethods) {
        try {
            const result = await checkMethod(cleanUsername);
            if (result) {
                console.log(`✅ @${cleanUsername} подтвержден внешней проверкой`);
                return true;
            }
        } catch (error) {
            console.log(`⚠️ Ошибка внешней проверки: ${error.message}`);
            continue;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 3. Если внешние проверки не сработали, но whitelist строгий прошел - принимаем
    console.log(`✅ @${cleanUsername} принят по строгому whitelist (внешние проверки недоступны)`);
    return true;
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
        res.status(500).json({ message: 'Внутренняя ошибка сервера при получении пользователей.' });
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
        return res.status(400).json({ message: 'Отсутствуют обязательные поля (никнейм, страна или координаты).' });
    }

    // Проверка Twitter username
    if (!twitter_username || twitter_username.trim() === '') {
        return res.status(400).json({ message: 'Twitter username обязателен для регистрации.' });
    }

    try {
        // 1. Проверка существования Twitter аккаунта (СТРОГАЯ)
        console.log(`🔍 Строгая проверка Twitter аккаунта: @${twitter_username}`);
        const twitterExists = await checkTwitterUsername(twitter_username);
        
        if (!twitterExists) {
            return res.status(400).json({ 
                message: 'Twitter username не прошел проверку. Используйте реальный Twitter аккаунт.' 
            });
        }

        // 2. Проверка уникальности по IP (ИСПРАВЛЕННАЯ)
        const ipUnique = await checkIPUniqueness(ipAddress, User);
        if (!ipUnique) {
            return res.status(403).json({ 
                message: 'С этого IP-адреса уже зарегистрирован аккаунт. Разрешен только один аккаунт на IP-адрес.' 
            });
        }

        // 3. Проверка уникальности nickname и twitter_username
        const existingUserByNickname = await User.findOne({ nickname });
        if (existingUserByNickname) {
            return res.status(409).json({ message: 'Пользователь с таким никнеймом уже существует.' });
        }

        const cleanTwitterUsername = twitter_username.replace(/^@/, '');
        const existingUserByTwitter = await User.findOne({ twitter_username: cleanTwitterUsername });
        if (existingUserByTwitter) {
            return res.status(409).json({ message: 'Пользователь с таким Twitter аккаунтом уже зарегистрирован.' });
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
            message: 'Пользователь успешно зарегистрирован!',
            user: {
                nickname: newUser.nickname,
                country: newUser.country,
                twitter_username: newUser.twitter_username,
                twitter_profile_url: newUser.twitter_profile_url
            }
        });

    } catch (error) {
        console.error('Ошибка при регистрации:', error.message);
        return res.status(500).json({ 
            message: 'Внутренняя ошибка сервера при регистрации пользователя.',
            details: error.message 
        });
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
