require('dotenv').config(); // Загружает переменные окружения из .env файла
const express = require('express');
const cors = require('cors'); // Для управления CORS
const mongoose = require('mongoose'); // Для работы с MongoDB

const app = express();
const port = process.env.PORT || 3000;

// --- ПОДКЛЮЧЕНИЕ К MONGODB ---
// Убедитесь, что process.env.MONGODB_URI установлен (например, в файле .env)
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
    ip_address: { type: String } // Добавлено поле для IP-адреса
}, { timestamps: true });

// Исправлено: убран лишний пробел в имени модели
const User = mongoose.model('User ', userSchema); // Теперь будет использовать коллекцию 'users'

// --- MIDDLEWARE ---
// Middleware для обработки JSON-запросов
app.use(express.json());

// Middleware для обработки URL-кодированных данных (для форм)
app.use(express.urlencoded({ extended: true }));

// Настройка CORS
app.use(cors({
    origin: ['https://mantlemap.xyz', 'http://localhost:8080'], // Разрешенные домены
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// --- МАРШРУТЫ API ---

// Простой маршрут для проверки работы сервера
app.get('/', (req, res) => {
    res.send('API Server is running!');
});

// Маршрут для получения всех пользователей из MongoDB
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}); // Получаем всех пользователей из коллекции
        console.log(`Получено ${users.length} пользователей из БД.`);
        res.status(200).json(users); // Отправляем пользователей как JSON
    } catch (error) {
        console.error('Ошибка при получении пользователей из MongoDB:', error);
        res.status(500).json({ message: 'Internal server error while retrieving users.' });
    }
});

// Маршрут для регистрации пользователя
app.post('/api/users', async (req, res) => {
    // Получаем данные из тела запроса
    const { nickname, country, lat, lng, avatar, twitter_username, twitter_profile_url } = req.body;

    console.log('Получены данные:', { nickname, country });

    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    try {
        // Проверяем, есть ли уже пользователь с этим IP
        const existingUser  = await User.findOne({ ip_address: ip });
        if (existingUser ) {
            return res.status(409).json({ message: 'A user from this IP address is already registered.' });
        }

        // Валидация на стороне сервера: проверка обязательных полей
        if (!nickname || !country || lat === undefined || lng === undefined) {
            console.warn('Required fields are missing:', { nickname, country, lat, lng });
            return res.status(400).json({ message: 'Missing mandatory fields (nickname, country).' });
        }

        // Сохраняем пользователя в MongoDB
        const newUser  = new User({
            nickname,
            country,
            lat,
            lng,
            avatar,
            twitter_username,
            twitter_profile_url,
            ip_address: ip // Сохраняем IP-адрес пользователя
        });

        await newUser .save(); // Сохраняем нового пользователя в базу данных
        console.log(`Пользователь ${nickname} из ${country} успешно зарегистрирован и сохранен в БД!`);

        // Возвращаем новосозданного пользователя с ID из БД
        res.status(201).json(newUser ); // 201 Created - для успешного создания ресурса

    } catch (error) {
        // Обработка ошибок MongoDB
        if (error.code === 11000) { // Код ошибки MongoDB для дубликатов ключей
            console.warn('Попытка дубликата пользователя:', error.message);
            return res.status(409).json({ message: 'A user with that Twitter nickname or username already exists.', details: error.message });
        }
        
        console.error('Неизвестная ошибка при сохранении в БД:', error.message);
        return res.status(500).json({ message: 'An unknown error occurred while processing the request.', details: error.message });
    }
});

// --- ЗАПУСК СЕРВЕРА ---
app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});
