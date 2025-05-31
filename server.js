require('dotenv').config(); // Загружает переменные окружения из .env файла
const express = require('express');
const axios = require('axios'); // Для выполнения HTTP-запросов
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
    twitter_username: { type: String, unique: true, sparse: true }, // unique: true с sparse: true позволяет нескольким документам иметь null значение
    twitter_profile_url: { type: String }
}, { timestamps: true }); // Добавляет поля createdAt и updatedAt

const User = mongoose.model('User', userSchema);

// --- MIDDLEWARE ---
// Middleware для обработки JSON-запросов
app.use(express.json());

// Middleware для обработки URL-кодированных данных (для форм), хотя для hCaptcha используем URLSearchParams
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

// Новый маршрут для получения всех пользователей из MongoDB
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}); // Получаем всех пользователей из коллекции
        console.log(`Получено ${users.length} пользователей из БД.`);
        res.status(200).json(users); // Отправляем пользователей как JSON
    } catch (error) {
        console.error('Ошибка при получении пользователей из MongoDB:', error);
        res.status(500).json({ message: 'Внутренняя ошибка сервера при получении пользователей.' });
    }
});

// Маршрут для регистрации пользователя
app.post('/api/users', async (req, res) => {
    // ВНИМАНИЕ: Изменено h-captcha-response на hcaptcha_response, чтобы соответствовать фронтенду
    const { nickname, country, lat, lng, avatar, twitter_username, twitter_profile_url, hcaptcha_response } = req.body;

    console.log('Получены данные:', { nickname, country, hcaptcha_response: !!hcaptcha_response });

    // 1. Валидация на стороне сервера: проверка обязательных полей
    if (!nickname || !country || !hcaptcha_response || lat === undefined || lng === undefined) {
        console.warn('Отсутствуют обязательные поля:', { nickname, country, lat, lng, hcaptcha_response: !!hcaptcha_response });
        return res.status(400).json({ message: 'Отсутствуют обязательные поля (никнейм, страна, координаты или ответ hCaptcha).' });
    }

    // 2. Валидация hCaptcha на стороне сервера
    const secret = process.env.HCAPTCHA_SECRET_KEY; // Ваш секретный ключ из переменных окружения
    const verificationUrl = 'https://hcaptcha.com/siteverify';

    // Проверка, что секретный ключ установлен
    if (!secret) {
        console.error('HCAPTCHA_SECRET_KEY не установлен в переменных окружения!');
        return res.status(500).json({ message: 'Ошибка сервера: HCAPTCHA_SECRET_KEY не настроен.' });
    }

    try {
        // HCaptcha ожидает данные в формате application/x-www-form-urlencoded
        const params = new URLSearchParams();
        params.append('secret', secret);
        params.append('response', hcaptcha_response);

        const verificationRes = await axios.post(verificationUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const hcaptchaData = verificationRes.data;
        console.log('Ответ верификации hCaptcha:', hcaptchaData);

        if (!hcaptchaData.success) {
            console.warn('Верификация hCaptcha не пройдена:', hcaptchaData['error-codes']);
            return res.status(401).json({ message: 'Проверка hCaptcha не прошла. Пожалуйста, попробуйте еще раз.', errorCodes: hcaptchaData['error-codes'] });
        }

        // Если hCaptcha прошла успешно, сохраняем пользователя в MongoDB
        const newUser = new User({
            nickname,
            country,
            lat,
            lng,
            avatar,
            twitter_username,
            twitter_profile_url
        });

        await newUser.save(); // Сохраняем нового пользователя в базу данных
        console.log(`Пользователь ${nickname} из ${country} успешно зарегистрирован и сохранен в БД!`);

        // Возвращаем новосозданного пользователя с ID из БД
        res.status(201).json(newUser); // 201 Created - для успешного создания ресурса

    } catch (error) {
        // Более детальное логирование ошибок axios и MongoDB
        if (error.code === 11000) { // Код ошибки MongoDB для дубликатов ключей
            console.warn('Попытка дубликата пользователя:', error.message);
            return res.status(409).json({ message: 'Пользователь с таким никнеймом или именем пользователя Twitter уже существует.', details: error.message });
        }
        if (error.response) {
            console.error('Ошибка HCaptcha API (response):', error.response.data);
            console.error('Статус HCaptcha API (status):', error.response.status);
            console.error('Заголовки HCaptcha API (headers):', error.response.headers);
            return res.status(500).json({ message: 'Ошибка при проверке hCaptcha на сервере.', details: error.response.data });
        } else if (error.request) {
            console.error('Ошибка HCaptcha API (request): Нет ответа от сервера HCaptcha.');
            return res.status(500).json({ message: 'Ошибка при проверке hCaptcha на сервере: Нет ответа от HCaptcha API.', details: error.message });
        } else {
            console.error('Неизвестная ошибка HCaptcha API или сохранения в БД:', error.message);
            return res.status(500).json({ message: 'Неизвестная ошибка при обработке запроса.', details: error.message });
        }
    }
});

// --- ЗАПУСК СЕРВЕРА ---
app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});