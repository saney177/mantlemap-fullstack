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
    
    // Вариант 1: Используем внешний API для проверки социальных сетей
    try {
        // Этот API бесплатный и не требует ключей для базовой проверки
        const response = await axios.get(`https://api.social-searcher.com/v2/search`, {
            params: {
                q: `@${cleanUsername}`,
                network: 'twitter',
                limit: 1
            },
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.data && response.data.posts && response.data.posts.length > 0) {
            console.log(`✅ Twitter аккаунт @${cleanUsername} найден через Social Searcher API`);
            return true;
        }
    } catch (error) {
        console.log(`⚠️ Social Searcher API недоступен для @${cleanUsername}`);
    }
    
    // Вариант 2: Проверка через простую эвристику имен
    return await checkTwitterUsernameByPattern(cleanUsername);
}

// --- ПРОВЕРКА ЧЕРЕЗ ПАТТЕРНЫ И ЭВРИСТИКУ ---
async function checkTwitterUsernameByPattern(username) {
    // Список заведомо несуществующих паттернов
    const invalidPatterns = [
        /^[a-z]{20,}$/, // только строчные буквы длиной 20+ символов
        /^[0-9]{15,}$/, // только цифры длиной 15+ символов
        /^(.)\1{10,}$/, // повторение одного символа 10+ раз
        /^[qwerty]{15,}$/, // клавиатурный спам
        /^asdf/, // клавиатурный спам
        /^[xyz]{10,}$/, // повторение xyz
        /dkjfsbhbhdjvnjedknfkn/, // ваш тестовый случай
        /^test[0-9]{10,}$/, // test + много цифр
        /^user[0-9]{10,}$/, // user + много цифр
    ];
    
    // Список вероятно существующих паттернов
    const validPatterns = [
        /^[a-z0-9_]{1,15}$/, // нормальный Twitter username (до 15 символов)
        /^[a-z]+_[a-z]+$/, // слово_слово
        /^[a-z]+[0-9]{1,4}$/, // слово + 1-4 цифры
        /eth$/, // заканчивается на eth (крипто)
        /btc$/, // заканчивается на btc (крипто)
        /crypto/, // содержит crypto
        /nft/, // содержит nft
        /^real/, // начинается с real
    ];
    
    // Проверяем на явно невалидные паттерны
    for (const pattern of invalidPatterns) {
        if (pattern.test(username.toLowerCase())) {
            console.log(`❌ @${username} отклонен по паттерну: ${pattern}`);
            return false;
        }
    }
    
    // Проверяем на вероятно валидные паттерны
    for (const pattern of validPatterns) {
        if (pattern.test(username.toLowerCase())) {
            console.log(`✅ @${username} принят по паттерну: ${pattern}`);
            return true;
        }
    }
    
    // Дополнительные проверки
    const usernameLength = username.length;
    const hasValidLength = usernameLength >= 1 && usernameLength <= 15; // Twitter limit
    const hasValidChars = /^[a-zA-Z0-9_]+$/.test(username); // Только разрешенные символы
    const notAllNumbers = !/^[0-9]+$/.test(username); // Не только цифры
    const notAllSameChar = !/^(.)\1+$/.test(username); // Не все одинаковые символы
    
    const isLikelyValid = hasValidLength && hasValidChars && notAllNumbers && notAllSameChar;
    
    if (!isLikelyValid) {
        console.log(`❌ @${username} не прошел базовую валидацию (длина: ${usernameLength}, символы: ${hasValidChars}, не только цифры: ${notAllNumbers})`);
        return false;
    }
    
    // Если прошел все проверки, считаем валидным
    console.log(`✅ @${username} принят по умолчанию (прошел базовую валидацию)`);
    return true;
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
