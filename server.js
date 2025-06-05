require('dotenv').config(); // Загружает переменные окружения из .env файла
const express = require('express');
const axios = require('axios'); // Для проверки юзернейма в Twitter
const cors = require('cors'); // Для управления CORS
const mongoose = require('mongoose'); // Для работы с MongoDB

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
    ip_address: { type: String } // Для хранения IP-адреса пользователя
}, { timestamps: true });

const User = mongoose.model('User ', userSchema);

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
async function checkTwitterUsername(username) {
    if (!username || username.trim() === '') {
        return false;
    }

    const cleanUsername = username.replace(/^@/, '');
    console.log(`🔍 Проверяем Twitter аккаунт: @${cleanUsername}`);

    // Проверка через Twitter API
    try {
        const response = await axios.get(`https://api.twitter.com/2/users/by/username/${cleanUsername}`, {
            headers: {
                'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
            }
        });

        if (response.status === 200) {
            console.log(`✅ Twitter аккаунт @${cleanUsername} найден через API`);
            return true;
        }
    } catch (error) {
        console.error(`Ошибка при проверке Twitter аккаунта: ${error.response?.status} - ${error.message}`);
        return false; // Если ошибка, юзернейм не существует
    }

    return false; // Если аккаунт не найден
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
    const ipAddress = req.realIP; // Получаем IP-адрес пользователя

    console.log('Получены данные:', { nickname, country, twitter_username, ip: ipAddress });

    // 1. Валидация на стороне сервера: проверка обязательных полей
    if (!nickname || !country || lat === undefined || lng === undefined) {
        console.warn('Отсутствуют обязательные поля:', { nickname, country, lat, lng });
        return res.status(400).json({ message: 'Отсутствуют обязательные поля (никнейм, страна или координаты).' });
    }

    // 2. Проверка существования Twitter аккаунта
    const twitterExists = await checkTwitterUsername(twitter_username);
    if (!twitterExists) {
        return res.status(400).json({ 
            message: 'Указанный Twitter аккаунт не существует. Регистрация доступна только для пользователей Twitter.' 
        });
    }

    // 3. Проверка на уникальность по IP-адресу
    const userCount = await User.countDocuments({ ip_address: ipAddress });
    const maxAccountsPerIP = 1; // Максимальное количество аккаунтов на один IP

    if (userCount >= maxAccountsPerIP) {
        return res.status(403).json({ message: `Достигнуто максимальное количество аккаунтов (${maxAccountsPerIP}) на один IP-адрес.` });
    }

    try {
        const newUser  = new User({
            nickname,
            country,
            lat,
            lng,
            avatar,
            twitter_username: twitter_username.replace(/^@/, ''),
            twitter_profile_url: twitter_profile_url || `https://twitter.com/${twitter_username.replace(/^@/, '')}`,
            ip_address: ipAddress // Сохраняем IP-адрес
        });

        await newUser .save();
        console.log(`Пользователь ${nickname} из ${country} успешно зарегистрирован и сохранен в БД!`);
        res.status(201).json(newUser );

    } catch (error) {
        if (error.code === 11000) {
            console.warn('Попытка дубликата пользователя:', error.message);
            return res.status(409).json({ message: 'Пользователь с таким никнеймом или именем пользователя Twitter уже существует.', details: error.message });
        }

        console.error('Неизвестная ошибка при сохранении в БД:', error.message);
        return res.status(500).json({ message: 'Неизвестная ошибка при обработке запроса.', details: error.message });
    }
});

// --- ЗАПУСК СЕРВЕРА ---
app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});
