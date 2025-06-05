require('dotenv').config(); // Загружает переменные окружения из .env файла
const express = require('express');
const axios = require('axios'); // Для проверки юзернейма в Twitter
const cors = require('cors'); // Для управления CORS
const mongoose = require('mongoose'); // Для работы с MongoDB

const app = express();
const port = process.env.PORT || 3000;

// --- ПОДКЛЮЧЕНИЕ К MONGODB ---
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
    twitter_profile_url: { type: String },
    ip_address: { type: String } // Для хранения IP-адреса пользователя
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// --- MIDDLEWARE ---
// Middleware для обработки JSON-запросов
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware для получения реального IP-адреса (учитывает прокси)
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
    origin: ['https://mantlemap.xyz', 'http://localhost:8080'], // Разрешенные домены
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// --- ФУНКЦИЯ ДЛЯ ПРОВЕРКИ ЮЗЕРНЕЙМА В TWITTER ---
// --- ФУНКЦИЯ ДЛЯ ПРОВЕРКИ ЮЗЕРНЕЙМА В TWITTER ---
async function checkTwitterUsername(username) {
    if (!username || username.trim() === '') {
        return false;
    }

    // Убираем @ если есть в начале
    const cleanUsername = username.replace(/^@/, '');
    
    console.log(`🔍 Проверяем Twitter аккаунт: @${cleanUsername}`);
    
    // ВАРИАНТ 1: RapidAPI Twitter API
    if (process.env.RAPIDAPI_KEY && process.env.RAPIDAPI_KEY !== '4c37bfb142msha60bba1788f9aebp1c756ejsn6d6b4f478307') {
        try {
            const response = await axios.get(`https://twitter-api45.p.rapidapi.com/user.php`, {
                params: { username: cleanUsername },
                headers: {
                    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
                    'X-RapidAPI-Host': 'twitter-api45.p.rapidapi.com'
                },
                timeout: 10000
            });
            
            if (response.data && response.data.username) {
                console.log(`✅ Twitter аккаунт @${cleanUsername} найден через RapidAPI`);
                return true;
            }
        } catch (error) {
            console.log(`⚠️ RapidAPI ошибка для @${cleanUsername}:`, error.response?.status, error.response?.data?.message || error.message);
            
            // Если квота исчерпана или другая ошибка API, используем fallback
            if (error.response?.status === 403) {
                console.log('⚠️ Проблема с RapidAPI ключом - используем fallback проверку');
            }
        }
    } else {
        console.log('⚠️ RapidAPI ключ не настроен - используем fallback проверку');
    }
    
    // ВАРИАНТ 2: Альтернативная проверка через другой API
    try {
        // Используем другой бесплатный API или метод
        const publicResponse = await axios.get(`https://nitter.net/${cleanUsername}`, {
            timeout: 5000,
            validateStatus: function (status) {
                return status < 500; // Принимаем статусы < 500
            }
        });
        
        // Если страница существует (не 404), значит аккаунт существует
        if (publicResponse.status === 200) {
            console.log(`✅ Twitter аккаунт @${cleanUsername} найден через Nitter`);
            return true;
        }
    } catch (error) {
        console.log(`⚠️ Nitter недоступен для @${cleanUsername}: ${error.message}`);
    }
    
    // ВАРИАНТ 3: Проверка через публичный Twitter URL
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
        
        // Проверяем, что страница не показывает "This account doesn't exist"
        if (twitterResponse.status === 200 && 
            !twitterResponse.data.includes('This account doesn\'t exist') &&
            !twitterResponse.data.includes('Account suspended')) {
            console.log(`✅ Twitter аккаунт @${cleanUsername} найден через прямую проверку`);
            return true;
        }
    } catch (error) {
        console.log(`⚠️ Прямая проверка Twitter недоступна для @${cleanUsername}: ${error.message}`);
    }
    
    // ВАРИАНТ 4: Улучшенная whitelist проверка как последний резерв
    return await checkTwitterUsernameWhitelist(cleanUsername);
}

// --- УЛУЧШЕННАЯ ПРОВЕРКА ЧЕРЕЗ WHITELIST ---
async function checkTwitterUsernameWhitelist(username) {
    console.log(`🔍 Запуск whitelist проверки для @${username}`);
    
    // 1. Явно поддельные паттерны (более точная проверка)
    const obviousSpamPatterns = [
        /^[a-z]{15,}$/, // только строчные буквы 15+ символов (слишком длинно)
        /^(.)\1{6,}$/, // повторение одного символа 6+ раз (aaaaaaa)
        /^[qwertyuiop]{8,}$/i, // клавиатурный набор
        /^[asdfghjkl]{8,}$/i, // клавиатурный набор
        /^[zxcvbnm]{8,}$/i, // клавиатурный набор
        /^test[0-9]{3,}$/i, // test123456
        /^user[0-9]{3,}$/i, // user123456
        /^[0-9]{10,}$/, // только цифры 10+ символов
        /^[bcdfghjklmnpqrstvwxyz]{15,}$/i, // много согласных без гласных
        /hjklfdsapoiuytrewq|mnbvcxzasdfgh/, // случайный набор букв
    ];
    
    // Проверяем на очевидный спам
    for (const pattern of obviousSpamPatterns) {
        if (pattern.test(username)) {
            console.log(`❌ @${username} отклонен как очевидный спам: ${pattern}`);
            return false;
        }
    }
    
    // 2. Позитивные паттерны (что ПРИНИМАЕМ)
    const validPatterns = [
        // Crypto-related имена (очень популярны в Twitter)
        /^0x[a-zA-Z][a-zA-Z0-9]{3,12}$/i, // 0x + буквы/цифры (как 0xAndrewMoh)
        /^[a-zA-Z]{2,8}(eth|btc|crypto|nft|defi|web3|sol|ada|dot|bnb)$/i,
        /^(crypto|bitcoin|eth|nft|defi|web3)[a-zA-Z0-9_]{2,10}$/i,
        
        // Обычные имена с цифрами
        /^[a-zA-Z]{3,12}[0-9]{1,4}$/i, // имя + 1-4 цифры
        /^[a-zA-Z]{2,8}_[a-zA-Z]{2,8}$/i, // имя_фамилия
        /^[a-zA-Z]{3,12}_?[0-9]{1,3}$/i, // имя_123
        
        // Имена с префиксами/суффиксами
        /^(real|the|mr|ms|dr)[a-zA-Z]{3,12}$/i,
        /^[a-zA-Z]{3,12}(official|real|jr|sr)$/i,
        
        // Смешанные паттерны
        /^[a-zA-Z][a-zA-Z0-9_]{4,14}[a-zA-Z0-9]$/i, // начинается и заканчивается буквой/цифрой
    ];
    
    // Проверяем позитивные паттерны
    for (const pattern of validPatterns) {
        if (pattern.test(username)) {
            console.log(`✅ @${username} принят по валидному паттерну: ${pattern}`);
            return true;
        }
    }
    
    // 3. Проверка на наличие осмысленных частей
    const meaningfulParts = [
        // Популярные имена
        'alex', 'andrew', 'john', 'mike', 'david', 'chris', 'anna', 'maria', 'lisa', 'sarah',
        'crypto', 'bitcoin', 'eth', 'trader', 'investor', 'dev', 'tech', 'hodl', 'moon',
        // Crypto термины
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
    
    // 4. Финальная проверка: если имя не слишком странное
    const isSuspicious = 
        username.length > 15 || // слишком длинное
        username.length < 3 || // слишком короткое
        /^[0-9]+$/.test(username) || // только цифры
        !/[a-zA-Z]/.test(username); // нет букв вообще
        
    if (!isSuspicious) {
        console.log(`✅ @${username} принят - не выглядит подозрительно`);
        return true;
    }
    
    console.log(`❌ @${username} отклонен - не прошел все проверки`);
    return false;
}

// --- ДОПОЛНИТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПРОВЕРКИ ЧЕРЕЗ МНОЖЕСТВЕННЫЕ API ---
async function checkTwitterMultipleAPIs(username) {
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

// Простой маршрут для проверки работы сервера
app.get('/', (req, res) => {
    res.send('API Server is running!');
});

// Маршрут для получения всех пользователей из MongoDB
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

// Маршрут для регистрации пользователя
app.post('/api/users', async (req, res) => {
    const { nickname, country, lat, lng, avatar, twitter_username, twitter_profile_url } = req.body;
    const ipAddress = req.realIP; // Используем реальный IP-адрес

    console.log('Получены данные:', { nickname, country, twitter_username, ip: ipAddress });

    // 1. Валидация на стороне сервера: проверка обязательных полей
    if (!nickname || !country || lat === undefined || lng === undefined) {
        console.warn('Отсутствуют обязательные поля:', { nickname, country, lat, lng });
        return res.status(400).json({ message: 'Отсутствуют обязательные поля (никнейм, страна или координаты).' });
    }

    // 2. Проверка обязательного Twitter username
    if (!twitter_username || twitter_username.trim() === '') {
        return res.status(400).json({ message: 'Twitter username обязателен для регистрации.' });
    }

    try {
        // 3. Проверка существования Twitter аккаунта
        console.log(`Проверяем существование Twitter аккаунта: @${twitter_username}`);
        const twitterExists = await checkTwitterUsername(twitter_username);
        
        if (!twitterExists) {
            return res.status(400).json({ 
                message: 'Указанный Twitter аккаунт не существует. Регистрация доступна только для пользователей Twitter.' 
            });
        }

        // 4. Проверка на уникальность по IP-адресу (исключаем старых пользователей с ip_address: null)
        const existingUserByIP = await User.findOne({ 
            ip_address: ipAddress,
            ip_address: { $ne: null } // Исключаем пользователей с null IP
        });
        
        if (existingUserByIP) {
            console.warn(`Попытка регистрации с уже использованного IP: ${ipAddress}`);
            return res.status(403).json({ 
                message: 'С этого IP-адреса уже зарегистрирован аккаунт. Разрешен только один аккаунт на IP-адрес.' 
            });
        }

        // 5. Создание нового пользователя
        const newUser = new User({
            nickname,
            country,
            lat,
            lng,
            avatar,
            twitter_username: twitter_username.replace(/^@/, ''), // Убираем @ если есть
            twitter_profile_url: twitter_profile_url || `https://twitter.com/${twitter_username.replace(/^@/, '')}`,
            ip_address: ipAddress // Сохраняем IP-адрес
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
            
            // Определяем какое поле вызвало дубликат
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

// Дополнительный маршрут для проверки Twitter аккаунта (можно использовать на фронтенде)
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
