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
    
    try {
        // Используем публичный API Twitter для проверки существования пользователя
        // Этот endpoint не требует авторизации и возвращает JSON
        const url = `https://api.twitter.com/1.1/users/show.json?screen_name=${cleanUsername}`;
        
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        // Если запрос успешен и есть данные пользователя
        if (response.status === 200 && response.data && response.data.screen_name) {
            console.log(`✅ Twitter аккаунт @${cleanUsername} найден`);
            return true;
        }
        
        console.log(`❌ Twitter аккаунт @${cleanUsername} не найден`);
        return false;
        
    } catch (error) {
        console.warn(`🔍 Проверка Twitter аккаунта @${cleanUsername} - Ошибка:`, error.response?.status || error.message);
        
        // Если ошибка 404 или 403 (пользователь не найден или приватный)
        if (error.response?.status === 404) {
            console.log(`❌ Twitter аккаунт @${cleanUsername} не существует (404)`);
            return false;
        }
        
        // Если ошибка 401 (Unauthorized) - API требует авторизацию
        if (error.response?.status === 401) {
            console.log(`⚠️ Twitter API требует авторизацию, используем альтернативный метод для @${cleanUsername}`);
            return await checkTwitterUsernameAlternative(cleanUsername);
        }
        
        // Для других ошибок (429 - rate limit, 400 - bad request) пробуем альтернативный метод
        if (error.response?.status === 429 || error.response?.status === 400) {
            console.log(`⚠️ Twitter API недоступен (${error.response.status}), используем альтернативный метод для @${cleanUsername}`);
            return await checkTwitterUsernameAlternative(cleanUsername);
        }
        
        // В случае сетевых ошибок тоже пробуем альтернативный метод
        console.log(`⚠️ Сетевая ошибка при проверке @${cleanUsername}, используем альтернативный метод`);
        return await checkTwitterUsernameAlternative(cleanUsername);
    }
}

// --- АЛЬТЕРНАТИВНАЯ ФУНКЦИЯ ПРОВЕРКИ ЧЕРЕЗ ПРОВЕРКУ DNS/NSLOOKUP ---
async function checkTwitterUsernameAlternative(username) {
    try {
        // Используем более простой подход - проверяем redirect на twitter.com
        const url = `https://mobile.twitter.com/${username}`;
        
        const response = await axios.get(url, {
            timeout: 8000,
            maxRedirects: 5,
            validateStatus: function (status) {
                // Считаем успешными коды 200, 301, 302
                return status >= 200 && status < 400;
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-us',
                'Accept-Encoding': 'gzip, deflate'
            }
        });
        
        // Если получили ответ без ошибок
        if (response.status === 200) {
            const content = response.data.toLowerCase();
            
            // Проверяем, что это не страница с ошибкой
            const isNotFound = content.includes('this account doesn\'t exist') ||
                              content.includes('user not found') ||
                              content.includes('account suspended') ||
                              content.includes('sorry, that page doesn\'t exist');
            
            if (isNotFound) {
                console.log(`❌ Альтернативная проверка: @${username} не найден`);
                return false;
            }
            
            // Проверяем, что есть признаки реального профиля
            const hasProfile = content.includes('@' + username.toLowerCase()) ||
                              content.includes('twitter.com/' + username.toLowerCase()) ||
                              content.includes('"screen_name"');
            
            console.log(`${hasProfile ? '✅' : '❌'} Альтернативная проверка: @${username} ${hasProfile ? 'найден' : 'не найден'}`);
            return hasProfile;
        }
        
        return false;
        
    } catch (error) {
        console.warn(`❌ Альтернативная проверка @${username} не удалась:`, error.message);
        
        // В крайнем случае возвращаем true для длинных имен (вероятно боты),
        // и false для коротких (скорее всего заняты настоящими пользователями)
        const fallbackResult = username.length > 15;
        console.log(`🎲 Fallback для @${username}: ${fallbackResult ? 'разрешено' : 'запрещено'} (длина: ${username.length})`);
        return fallbackResult;
    }
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
