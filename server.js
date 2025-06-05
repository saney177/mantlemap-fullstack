require('dotenv').config();
const express = require('express');
const axios = require('axios'); // Возможно, axios не понадобится для Twitter API V2, если twitter-api-v2 все покрывает.
const cors = require('cors');
const mongoose = require('mongoose');

// Импортируем TwitterApi из библиотеки
const { TwitterApi } = require('twitter-api-v2');

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

// --- ИНИЦИАЛИЗАЦИЯ TWITTER API КЛИЕНТА ---
let twitterClient;
if (process.env.TWITTER_BEARER_TOKEN) {
    twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
    console.log('✅ Twitter API клиент инициализирован с Bearer Token.');
} else {
    console.warn('⚠️ TWITTER_BEARER_TOKEN не настроен. Проверки Twitter могут быть недоступны.');
}

// --- ФУНКЦИЯ ДЛЯ ПРОВЕРКИ ПОДПИСКИ НА MANTLE (Если вы хотите это делать через Twitter API v2) ---
// Это сложнее сделать с App-only Bearer Token, так как App-only токены в основном для публичных данных.
// Для проверки подписки одного пользователя на другого обычно требуется user-context OAuth 2.0.
// Если вам нужна эта функциональность, RapidAPI или другая сторонний API может быть проще.
// Однако, Twitter API v2 *позволяет* проверять подписки, но требует другого типа токена (OAuth 2.0 User Context).
// Пока оставим функцию как есть, предполагая, что RapidAPI для этого.
async function checkIfUserFollowsMantle(userTwitterUsername) {
    const cleanUserTwitterUsername = userTwitterUsername.replace(/^@/, '');
    const mantleOfficialScreenName = 'Mantle_Official';

    console.log(`🔍 Проверяем, подписан ли @<span class="math-inline">\{cleanUserTwitterUsername\} на @</span>{mantleOfficialScreenName}`);

    if (!process.env.RAPIDAPI_KEY) {
        console.warn('⚠️ RapidAPI ключ не настроен. Проверка подписки пропущена.');
        return false;
    }

    try {
        const url = `https://twitter-api45.p.rapidapi.com/checkfollow.php?user=<span class="math-inline">\{cleanUserTwitterUsername\}&follows\=</span>{mantleOfficialScreenName}`;

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
                console.log(`✅ @<span class="math-inline">\{cleanUserTwitterUsername\} подписан на @</span>{mantleOfficialScreenName}`);
                return true;
            } else {
                console.log(`❌ @<span class="math-inline">\{cleanUserTwitterUsername\} НЕ подписан на @</span>{mantleOfficialScreenName}`);
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

// --- ФУНКЦИЯ ДЛЯ ПРОВЕРКИ СУЩЕСТВОВАНИЯ TWITTER АККАУНТА (ОСНОВНОЙ МЕТОД) ---
async function checkTwitterUsername(username) {
    if (!username || username.trim() === '') {
        console.log('⚠️ Twitter username пуст или не указан.');
        return false;
    }

    const cleanUsername = username.replace(/^@/, '');
    console.log(`🔍 Проверяем Twitter аккаунт: @${cleanUsername} через Twitter API v2.`);

    if (!twitterClient) {
        console.error('❌ Twitter API клиент не инициализирован. Невозможно проверить аккаунт.');
        return false;
    }

    try {
        // Используем Twitter API v2 для получения информации о пользователе по его юзернейму
        const user = await twitterClient.v2.usersByUsernames([cleanUsername]);

        if (user && user.data && user.data.length > 0) {
            console.log(`✅ Twitter аккаунт @${cleanUsername} найден через Twitter API v2.`);
            return true;
        } else {
            console.log(`❌ Twitter аккаунт @${cleanUsername} НЕ найден через Twitter API v2.`);
            return false;
        }
    } catch (error) {
        console.error(`Ошибка при проверке Twitter аккаунта @${cleanUsername} через Twitter API v2:`, error.response?.status, error.response?.data?.message || error.message);
        // Если есть ошибка (например, 404, 429 Rate Limit, или другая), считаем, что аккаунт не найден или невозможно проверить
        return false;
    }
}

// --- ФУНКЦИЯ ПРОВЕРКИ ЧЕРЕЗ МНОЖЕСТВЕННЫЕ API (Теперь опционально, как запасной вариант) ---
// Эту функцию можно оставить для совместимости или как резервный вариант,
// но основной проверкой должен быть прямой вызов Twitter API v2.
// Если она не нужна, можете удалить ее.
async function checkTwitterMultipleAPIs(username) {
    if (!process.env.RAPIDAPI_KEY) {
        console.log('⚠️ RapidAPI ключ не настроен, пропуск резервной проверки.');
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
            console.log(`🔄 Пробуем <span class="math-inline">\{api\.name\} для @</span>{username} (резервная проверка)`);
            const response = await axios.get(api.url, {
                headers: api.headers,
                timeout: 8000
            });

            if (response.data && (response.data.username || response.data.data?.username)) {
                console.log(`✅ @${username} найден через ${api.name} (резервная проверка)`);
                return true;
            }
        } catch (error) {
            console.log(`⚠️ ${api.name} недоступен: ${error.response?.status || error.message}`);
        }
    }

    return false;
}

// --- ФУНКЦИЯ BLACKLIST ПРОВЕРКИ (Используется для отсева спама, если Twitter API не работает) ---
// Это функция должна быть вспомогательной и использоваться только если API не дали четкого ответа.
// В большинстве случаев, если Twitter API v2 не подтвердил существование,
// то этого достаточно, и блэклист не нужен для *подтверждения*.
// Однако, он может быть использован для *дополнительного отклонения* подозрительных имен.
function checkTwitterUsernameBlacklist(username) {
    console.log(`🔍 Запуск блэклист проверки для @${username}`);
    const lowerUsername = username.toLowerCase();

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
        /^(admin|root|system|support|moderator|bot|test|demo|fuck|shit|asshole)$/i,
        /^.{0,2}$/,
    ];

    for (const pattern of obviousSpamPatterns) {
        if (pattern.test(lowerUsername)) {
            console.log(`❌ @${username} отклонен как спам/невалидный по паттерну: ${pattern}`);
            return true;
        }
    }

    if (username.length > 15 || username.length < 3 || /^[0-9_]+$/.test(username)) {
         console.log(`❌ @${username} отклонен по общей длине/составу.`);
         return true;
    }

    console.log(`✅ @${username} прошел блэклист проверку.`);
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

        // Если основной API не подтвердил, можно попробовать резервные (опционально)
        let finalTwitterExists = twitterExists;
        if (!twitterExists) {
             console.log(`Основная проверка Twitter API v2 не подтвердила аккаунт. Пробуем резервные API.`);
             finalTwitterExists = await checkTwitterMultipleAPIs(twitter_username);
        }

        // Если после всех API аккаунт не подтвержден,
        // можно сделать еще одну проверку на "спамность" имени,
        // хотя если API сказали "нет", то это уже достаточно.
        if (!finalTwitterExists) {
            // Это место, где вы можете решить, нужно ли использовать блэклист
            // для *дополнительной* фильтрации, если API не дали четкого ответа.
            // В данном случае, если API говорят "нет", то это уже "нет".
            console.log(`Аккаунт @${twitter_username} не подтвержден через Twitter API.`);
            return res.status(400).json({
                message: 'Указанный Twitter аккаунт не существует или не может быть проверен. Регистрация доступна только для пользователей Twitter.'
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
        console.log(`Пользователь <span class="math-inline">\{nickname\} \(@</span>{twitter_username}) из ${country} успешно зарегистрирован!`);

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
        // Если прямой API не подтвердил, можно попробовать резервные
        let finalExists = exists;
        if (!exists) {
            console.log(`Основная проверка Twitter API v2 не подтвердила аккаунт. Пробуем резервные API для check-twitter.`);
            finalExists = await checkTwitterMultipleAPIs(username);
        }

        res.json({ exists: finalExists, username: username.replace(/^@/, '') });
    } catch (error) {
        console.error('Ошибка при проверке Twitter:', error);
        res.status(500).json({ message: 'Ошибка при проверке Twitter аккаунта.' });
    }
});

// --- ЗАПУСК СЕРВЕРА ---
app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});
