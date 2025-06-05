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
async function checkTwitterUsername(username) {
    if (!username || username.trim() === '') {
        return false;
    }

    // Убираем @ если есть в начале
    const cleanUsername = username.replace(/^@/, '');
    
    console.log(`🔍 Проверяем Twitter аккаунт: @${cleanUsername}`);
    
    // ВАРИАНТ 1: Используем RapidAPI Twitter API (бесплатный план)
    try {
        const response = await axios.get(`https://twitter-api45.p.rapidapi.com/user.php`, {
            params: { username: cleanUsername },
            headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || 'YOUR_RAPIDAPI_KEY_HERE',
                'X-RapidAPI-Host': 'twitter-api45.p.rapidapi.com'
            },
            timeout: 10000
        });
        
        if (response.data && response.data.username) {
            console.log(`✅ Twitter аккаунт @${cleanUsername} найден через RapidAPI`);
            return true;
        }
    } catch (error) {
        console.log(`⚠️ RapidAPI недоступен для @${cleanUsername}: ${error.response?.status || error.message}`);
    }
    
    // ВАРИАНТ 2: Временно используем список известных Twitter аккаунтов
    return await checkTwitterUsernameWhitelist(cleanUsername);
}

// --- ПРОВЕРКА ЧЕРЕЗ WHITELIST И СТРОГИЕ ПРАВИЛА ---
async function checkTwitterUsernameWhitelist(username) {
    // Сначала проверяем на явно поддельные паттерны (СТРОГАЯ ПРОВЕРКА)
    const spamPatterns = [
        /^[a-z]{10,}$/, // только строчные буквы 10+ символов без цифр/подчеркиваний
        /^[qwerty]{8,}/, // клавиатурный набор
        /^[asdfgh]{8,}/, // клавиатурный набор
        /^(.)\1{5,}$/, // повторение символа 5+ раз
        /^[xyz]{8,}$/, // много xyz
        /^test[0-9]*$/, // test + цифры
        /^user[0-9]*$/, // user + цифры
        /^[0-9]{8,}$/, // только цифры 8+ символов
        /hjk|jkl|dfg|fgh|cvb|bnm/, // случайные клавиатурные комбинации
        /^[bcdfghjklmnpqrstvwxyz]{12,}$/, // много согласных подряд
    ];
    
    for (const pattern of spamPatterns) {
        if (pattern.test(username.toLowerCase())) {
            console.log(`❌ @${username} отклонен как спам по паттерну: ${pattern}`);
            return false;
        }
    }
    
    // Проверяем whitelist популярных/известных аккаунтов
    const knownAccounts = [
        // Популярные крипто аккаунты
        'elonmusk', 'bitcoin', 'ethereum', 'binance', 'coinbase', 'vitalikbuterin',
        'satoshin', 'cz_binance', 'justinsuntron', 'whale_alert', 'defi_pulse',
        
        // Популярные имена с крипто суффиксами
        /^[a-z]{2,8}_?(eth|btc|crypto|nft|defi|web3|doge|sol|ada|dot|bnb)$/,
        /^(crypto|bitcoin|eth|nft|defi|web3)_?[a-z0-9]{2,8}$/,
        
        // Реальные паттерны имен
        /^[a-z]{3,8}[0-9]{1,4}$/, // имя + 1-4 цифры (john123)
        /^[a-z]{2,8}_[a-z]{2,8}$/, // имя_фамилия
        /^real[a-z]{3,10}$/, // real + имя
        /^[a-z]{3,8}(official|real|the)$/, // имя + official/real/the
        
        // Популярные суффиксы/префиксы
        /^(mr|ms|dr|prof)[a-z]{3,10}$/, // mr/ms/dr + имя
        /^[a-z]{3,8}(jr|sr|ii|iii)$/, // имя + jr/sr/ii/iii
    ];
    
    // Проверяем whitelist
    for (const account of knownAccounts) {
        if (typeof account === 'string') {
            if (username.toLowerCase() === account.toLowerCase()) {
                console.log(`✅ @${username} найден в whitelist известных аккаунтов`);
                return true;
            }
        } else if (account instanceof RegExp) {
            if (account.test(username.toLowerCase())) {
                console.log(`✅ @${username} принят по паттерну whitelist: ${account}`);
                return true;
            }
        }
    }
    
    // Дополнительная проверка: если имя содержит распространенные слова
    const commonWords = ['john', 'mike', 'alex', 'david', 'chris', 'anna', 'maria', 'lisa', 
                        'crypto', 'bitcoin', 'eth', 'trader', 'investor', 'dev', 'tech'];
    
    const hasCommonWord = commonWords.some(word => 
        username.toLowerCase().includes(word) && 
        username.length <= 15 && 
        !spamPatterns.some(pattern => pattern.test(username.toLowerCase()))
    );
    
    if (hasCommonWord) {
        console.log(`✅ @${username} принят - содержит распространенное слово`);
        return true;
    }
    
    // Если ничего не подошло - отклоняем
    console.log(`❌ @${username} отклонен - не прошел whitelist и проверки паттернов`);
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
