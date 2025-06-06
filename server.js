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

// Замените существующую функцию checkTwitterUsername на эту:

async function checkTwitterUsername(username) {
    if (!username || username.trim() === '') {
        return false;
    }

    const cleanUsername = username.replace(/^@/, '');
    console.log(`🔍 Комплексная проверка Twitter аккаунта: @${cleanUsername}`);
    
    // 1. Сначала базовая whitelist проверка
    if (!enhancedTwitterUsernameWhitelist(cleanUsername)) {
        console.log(`❌ @${cleanUsername} не прошел whitelist проверку`);
        return false;
    }
    
    // 2. Затем попытка проверки через внешние источники
    const checkMethods = [
        checkTwitterThroughMirrors,
        checkTwitterThroughSearch,
        checkTwitterThroughArchives,
        checkTwitterThroughSocialAggregators
    ];
    
    for (const checkMethod of checkMethods) {
        try {
            const result = await checkMethod(cleanUsername);
            if (result) {
                console.log(`✅ @${cleanUsername} подтвержден внешней проверкой`);
                return true;
            }
        } catch (error) {
            console.log(`⚠️ Ошибка в методе проверки: ${error.message}`);
            continue;
        }
        
        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Если внешние проверки не сработали, но whitelist прошел - принимаем
    console.log(`⚠️ @${cleanUsername} принят только по whitelist (внешние проверки недоступны)`);
    return true;
}

// Добавьте эти новые функции в ваш server.js:

// 1. Проверка через публичные зеркала и прокси
async function checkTwitterThroughMirrors(username) {
    const cleanUsername = username.replace(/^@/, '');
    console.log(`🔍 Проверяем @${cleanUsername} через публичные зеркала`);
    
    const mirrors = [
        `https://nitter.net/${cleanUsername}`,
        `https://nitter.it/${cleanUsername}`,
        `https://nitter.pussthecat.org/${cleanUsername}`,
        `https://nitter.fdn.fr/${cleanUsername}`,
        `https://nitter.1d4.us/${cleanUsername}`,
        `https://bird.makeup/users/${cleanUsername}`,
    ];
    
    for (const mirror of mirrors) {
        try {
            const response = await axios.get(mirror, {
                timeout: 8000,
                validateStatus: (status) => status < 500,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                }
            });
            
            if (response.status === 200) {
                const content = response.data.toLowerCase();
                
                // Проверяем, что это не страница ошибки
                if (!content.includes('user not found') && 
                    !content.includes('account suspended') &&
                    !content.includes('does not exist') &&
                    !content.includes('not found') &&
                    !content.includes('error') &&
                    (content.includes('tweets') || content.includes('following') || content.includes('followers'))) {
                    console.log(`✅ @${cleanUsername} найден через ${mirror}`);
                    return true;
                }
            }
        } catch (error) {
            console.log(`⚠️ ${mirror} недоступен: ${error.message}`);
            continue;
        }
    }
    
    return false;
}

// 2. Проверка через поиск в поисковых системах
async function checkTwitterThroughSearch(username) {
    const cleanUsername = username.replace(/^@/, '');
    console.log(`🔍 Проверяем @${cleanUsername} через поисковые системы`);
    
    try {
        // Проверка через DuckDuckGo
        const searchQuery = `site:twitter.com ${cleanUsername}`;
        const duckResponse = await axios.get(`https://html.duckduckgo.com/html/`, {
            params: {
                q: searchQuery,
            },
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (duckResponse.data.includes(`twitter.com/${cleanUsername}`) || 
            duckResponse.data.includes(`@${cleanUsername}`)) {
            console.log(`✅ @${cleanUsername} найден через DuckDuckGo`);
            return true;
        }
    } catch (error) {
        console.log(`⚠️ Поиск через DuckDuckGo недоступен: ${error.message}`);
    }
    
    return false;
}

// 3. Проверка через архивы и кэши
async function checkTwitterThroughArchives(username) {
    const cleanUsername = username.replace(/^@/, '');
    console.log(`🔍 Проверяем @${cleanUsername} через архивы`);
    
    const archiveUrls = [
        `https://web.archive.org/web/*/https://twitter.com/${cleanUsername}`,
        `https://archive.today/*/https://twitter.com/${cleanUsername}`,
    ];
    
    for (const archiveUrl of archiveUrls) {
        try {
            const response = await axios.get(archiveUrl, {
                timeout: 10000,
                validateStatus: (status) => status < 500,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
                }
            });
            
            if (response.status === 200 && response.data.includes('snapshots')) {
                console.log(`✅ @${cleanUsername} найден в архивах`);
                return true;
            }
        } catch (error) {
            console.log(`⚠️ Архив недоступен: ${error.message}`);
            continue;
        }
    }
    
    return false;
}

// 4. Проверка через социальные агрегаторы
async function checkTwitterThroughSocialAggregators(username) {
    const cleanUsername = username.replace(/^@/, '');
    console.log(`🔍 Проверяем @${cleanUsername} через социальные агрегаторы`);
    
    const aggregators = [
        `https://www.socialblade.com/twitter/user/${cleanUsername}`,
        `https://twitonomy.com/profile.php?sn=${cleanUsername}`,
    ];
    
    for (const aggregator of aggregators) {
        try {
            const response = await axios.get(aggregator, {
                timeout: 8000,
                validateStatus: (status) => status < 500,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.status === 200) {
                const content = response.data.toLowerCase();
                if (!content.includes('not found') && 
                    !content.includes('error') &&
                    !content.includes('does not exist') &&
                    (content.includes('followers') || content.includes('tweets') || content.includes('statistics'))) {
                    console.log(`✅ @${cleanUsername} найден через агрегатор`);
                    return true;
                }
            }
        } catch (error) {
            console.log(`⚠️ Агрегатор недоступен: ${error.message}`);
            continue;
        }
    }
    
    return false;
}

// 5. Обновленная функция whitelist
function enhancedTwitterUsernameWhitelist(username) {
    console.log(`🔍 Улучшенная whitelist проверка для @${username}`);
    
    // Базовые проверки длины и символов
    if (username.length < 1 || username.length > 15) {
        console.log(`❌ @${username} - неверная длина (${username.length})`);
        return false;
    }
    
    // Проверка на допустимые символы Twitter
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        console.log(`❌ @${username} - недопустимые символы`);
        return false;
    }
    
    // Не может начинаться с цифры или подчеркивания
    if (/^[0-9_]/.test(username)) {
        console.log(`❌ @${username} - начинается с цифры или _`);
        return false;
    }
    
    // Очевидно поддельные паттерны
    const spamPatterns = [
        /^[a-z]{15}$/,                    // 15 букв подряд
        /^(.)\1{5,}$/,                    // повторяющиеся символы
        /^[qwertyuiop]{6,}$/i,           // клавиатурный ряд
        /^[asdfghjkl]{6,}$/i,            // клавиатурный ряд
        /^[zxcvbnm]{6,}$/i,              // клавиатурный ряд
        /^test[0-9]{3,}$/i,              // test123456
        /^user[0-9]{3,}$/i,              // user123456
        /^[0-9]{8,}$/,                   // только цифры
        /^[bcdfghjklmnpqrstvwxyz]{10,}$/i, // только согласные
        /^.*(hjklfdsapoiuytrewq|mnbvcxzasdfgh|qazwsxedc).*$/i, // случайные комбинации
        /__{2,}/,                        // множественные подчеркивания
        /^[aeiou]{8,}$/i,               // только гласные
    ];
    
    for (const pattern of spamPatterns) {
        if (pattern.test(username)) {
            console.log(`❌ @${username} отклонен как спам: ${pattern}`);
            return false;
        }
    }
    
    // Паттерны вероятно валидных username
    const validPatterns = [
        // Crypto/Web3 паттерны
        /^(crypto|bitcoin|eth|btc|nft|defi|web3|doge|ada|sol|bnb|matic|polygon|avax|luna|atom|dot|link|uni|cake|sushi)[a-zA-Z0-9_]{1,8}$/i,
        /^[a-zA-Z]{2,8}(crypto|coin|trader|hodl|moon|diamond|hands|bull|bear)$/i,
        /^0x[a-fA-F0-9]{1,10}$/,        // Ethereum-style адреса
        
        // Обычные имена с цифрами
        /^[a-zA-Z]{3,10}[0-9]{1,4}$/,   // name123
        /^[a-zA-Z]{2,8}_[a-zA-Z]{2,8}$/, // first_last
        /^[a-zA-Z]{3,12}_?[0-9]{1,3}$/,  // name_1
        
        // Профессиональные/официальные
        /^(real|the|mr|ms|dr|official)[a-zA-Z]{2,10}$/i,
        /^[a-zA-Z]{2,10}(official|real|jr|sr|ceo|dev|team)$/i,
        
        // Обычные имена
        /^[a-zA-Z][a-zA-Z0-9_]{2,13}[a-zA-Z0-9]$/,
    ];
    
    for (const pattern of validPatterns) {
        if (pattern.test(username)) {
            console.log(`✅ @${username} принят по валидному паттерну: ${pattern}`);
            return true;
        }
    }
    
    // Проверка на наличие осмысленных частей
    const meaningfulWords = [
        // Имена
        'alex', 'andrew', 'john', 'mike', 'david', 'chris', 'anna', 'maria', 'lisa', 'sarah',
        'tom', 'bob', 'nick', 'dan', 'sam', 'joe', 'ben', 'max', 'leo', 'ian', 'kim', 'amy',
        
        // Crypto термины
        'crypto', 'bitcoin', 'eth', 'btc', 'trader', 'investor', 'dev', 'tech', 'hodl', 'moon',
        'defi', 'nft', 'web3', 'doge', 'shib', 'ada', 'dot', 'sol', 'bnb', 'matic', 'avax',
        'bull', 'bear', 'diamond', 'hands', 'rocket', 'lambo', 'whale', 'ape', 'gem',
        
        // Общие слова
        'real', 'official', 'team', 'group', 'news', 'info', 'blog', 'fan', 'love', 'life',
        'world', 'global', 'pro', 'expert', 'master', 'king', 'queen', 'lord', 'boss'
    ];
    
    const lowerUsername = username.toLowerCase();
    const hasMeaningfulPart = meaningfulWords.some(word => 
        lowerUsername.includes(word) && username.length >= 4 && username.length <= 15
    );
    
    if (hasMeaningfulPart) {
        console.log(`✅ @${username} принят - содержит осмысленное слово`);
        return true;
    }
    
    // Финальная эвристическая проверка
    const vowels = (username.match(/[aeiou]/gi) || []).length;
    const consonants = (username.match(/[bcdfghjklmnpqrstvwxyz]/gi) || []).length;
    const numbers = (username.match(/[0-9]/g) || []).length;
    const underscores = (username.match(/_/g) || []).length;
    
    // Эвристики для "человеческих" username
    const reasonableVowelRatio = vowels > 0 && vowels / username.length >= 0.15 && vowels / username.length <= 0.6;
    const hasBalancedChars = consonants > 0 && vowels > 0;
    const notTooManyNumbers = numbers <= Math.ceil(username.length * 0.4);
    const notTooManyUnderscores = underscores <= 2;
    
    if (reasonableVowelRatio && hasBalancedChars && notTooManyNumbers && notTooManyUnderscores) {
        console.log(`✅ @${username} принят - проходит эвристические проверки`);
        return true;
    }
    
    console.log(`❌ @${username} отклонен - не прошел все проверки`);
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
