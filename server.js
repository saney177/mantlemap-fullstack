// Загружает переменные окружения из файла .env
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
// Используем порт из переменных окружения (для Render) или 3000 для локального запуска
const PORT = process.env.PORT || 3000;

// --- Middleware: Промежуточное ПО ---
// Разрешает запросы от вашего фронтенда (важен для общения между разными доменами)
app.use(cors());
// Позволяет Express парсить JSON-тела запросов. Увеличиваем лимит до 5 МБ для аватаров.
app.use(express.json({ limit: '5mb' }));

// --- Подключение к MongoDB ---
// Получаем URI подключения из переменных окружения
const mongoUri = process.env.MONGODB_URI;

// Проверяем, определен ли URI
if (!mongoUri) {
    console.error('Ошибка: MONGODB_URI не определена в файле .env.');
    console.error('Убедитесь, что файл .env существует и содержит MONGODB_URI=ваша_строка_подключения');
    process.exit(1); // Выходим из приложения, если URI отсутствует
}

// Подключаемся к базе данных
mongoose.connect(mongoUri)
    .then(() => console.log('MongoDB успешно подключена!'))
    .catch(err => {
        console.error('Ошибка подключения MongoDB:');
        console.error('Проверьте MONGODB_URI в .env и настройки доступа в MongoDB Atlas.');
        console.error(err);
        process.exit(1); // Выходим при ошибке подключения к БД
    });

// --- Определение Схемы Пользователя (как данные выглядят в базе данных) ---
const userSchema = new mongoose.Schema({
    nickname: { type: String, required: true, maxlength: 20 },
    country: { type: String, required: true },
    lat: { type: Number, required: true }, // Широта
    lng: { type: Number, required: true }, // Долгота
    avatar: { type: String } // Аватар в виде Base64 строки (может быть пустым)
});

// Создаем модель 'User' на основе схемы
const User = mongoose.model('User', userSchema);

// --- API Эндпоинты ---

// 1. GET /api/users: Получить всех пользователей
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find(); // Находим всех пользователей в БД
        res.json(users); // Отправляем их в формате JSON
    } catch (err) {
        console.error('Ошибка при получении пользователей:', err);
        res.status(500).json({ message: 'Ошибка сервера при получении пользователей', error: err.message });
    }
});

// 2. POST /api/users: Добавить нового пользователя
app.post('/api/users', async (req, res) => {
    // Деструктурируем данные из тела запроса
    const { nickname, country, lat, lng, avatar } = req.body;

    // Валидация входных данных
    if (!nickname || !country || lat === undefined || lng === undefined) {
        return res.status(400).json({ message: 'Отсутствуют обязательные поля: nickname, country, lat, lng' });
    }

    try {
        // Создаем новый экземпляр пользователя на основе данных
        const newUser = new User({ nickname, country, lat, lng, avatar });
        await newUser.save(); // Сохраняем нового пользователя в базе данных
        res.status(201).json(newUser); // Отправляем обратно созданный объект пользователя с HTTP статусом 201 (Created)
    } catch (err) {
        // Обработка ошибок валидации Mongoose (если поля не соответствуют схеме)
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: err.message });
        }
        console.error('Ошибка при добавлении пользователя:', err);
        res.status(500).json({ message: 'Ошибка сервера при добавлении пользователя', error: err.message });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Локальный адрес: http://localhost:${PORT}`);
});