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

const User = mongoose.model('User  ', userSchema);

// --- MIDDLEWARE ---
// Middleware для обработки JSON-запросов
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Настройка CORS
app.use(cors({
    origin: ['https://mantlemap.xyz', 'http://localhost:8080'], // Разрешенные домены
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// --- ФУНКЦИЯ ДЛЯ ПРОВЕРКИ ЮЗЕРНЕЙМА В TWITTER ---
async function checkTwitterUsername(username) {
    const url = `https://api.twitter.com/1.1/users/show.json?screen_name=${username}`;
    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
            }
        });
        return response.data && response.data.id; // Если пользователь найден, возвращаем его ID
    } catch (error) {
        console.error('Ошибка при проверке юзернейма:', error.response ? error.response.data : error.message);
        return false; // Если ошибка, юзернейм не существует
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
    const ipAddress = req.ip; // Получаем IP-адрес пользователя

    console.log('Получены данные:', { nickname, country });

    // 1. Валидация на стороне сервера: проверка обязательных полей
    if (!nickname || !country || lat === undefined || lng === undefined) {
        console.warn('Отсутствуют обязательные поля:', { nickname, country, lat, lng });
        return res.status(400).json({ message: 'Отсутствуют обязательные поля (никнейм, страна или координаты).' });
    }

    // 2. Проверка существования юзернейма в Twitter
    const isTwitterUser   = await checkTwitterUsername(twitter_username);
    if (!isTwitterUser  ) {
        return res.status(400).json({ message: 'Юзернейм Twitter не существует.' });
    }

    // 3. Проверка на количество аккаунтов по IP-адресу
    const userCount = await User.countDocuments({ ip_address: ipAddress });
    const maxAccountsPerIP = 1; // Максимальное количество аккаунтов на один IP

    if (userCount >= maxAccountsPerIP) {
        return res.status(403).json({ message: `Достигнуто максимальное количество аккаунтов (${maxAccountsPerIP}) на один IP-адрес.` });
    }

    try {
        const newUser   = new User({
            nickname,
            country,
            lat,
            lng,
            avatar,
            twitter_username,
            twitter_profile_url,
            ip_address: ipAddress // Сохраняем IP-адрес
        });

        await newUser  .save();
        console.log(`Пользователь ${nickname} из ${country} успешно зарегистрирован и сохранен в БД!`);
        res.status(201).json(newUser  );

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
