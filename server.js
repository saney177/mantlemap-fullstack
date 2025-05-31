require('dotenv').config(); // Загружает переменные окружения из .env файла
const express = require('express');
const axios = require('axios'); // Для выполнения HTTP-запросов
const cors = require('cors'); // Для управления CORS
const app = express();
const port = process.env.PORT || 3000;

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

// Простой маршрут для проверки работы сервера
app.get('/', (req, res) => {
    res.send('API Server is running!');
});

// Маршрут для регистрации пользователя
app.post('/api/users', async (req, res) => {
    const { nickname, country, 'h-captcha-response': hcaptcha_response } = req.body;

    console.log('Received data:', { nickname, country, hcaptcha_response: !!hcaptcha_response }); // Логируем полученные данные

    // 1. Валидация на стороне сервера: проверка обязательных полей
    if (!nickname || !country || !hcaptcha_response) {
        console.warn('Отсутствуют обязательные поля:', { nickname, country, hcaptcha_response: !!hcaptcha_response });
        return res.status(400).json({ message: 'Отсутствуют обязательные поля (никнейм, страна, или ответ hCaptcha).' });
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
        // *** ИЗМЕНЕНА ЛОГИКА ОТПРАВКИ ДАННЫХ В AXIOS ***
        // HCaptcha ожидает данные в формате application/x-www-form-urlencoded
        // Используем URLSearchParams для правильного формирования тела запроса
        const params = new URLSearchParams();
        params.append('secret', secret);
        params.append('response', hcaptcha_response);

        const verificationRes = await axios.post(verificationUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        // ***********************************************

        const hcaptchaData = verificationRes.data;
        console.log('hCaptcha verification response:', hcaptchaData);

        if (!hcaptchaData.success) {
            console.warn('hCaptcha verification failed:', hcaptchaData['error-codes']);
            return res.status(401).json({ message: 'Проверка hCaptcha не прошла. Пожалуйста, попробуйте еще раз.', errorCodes: hcaptchaData['error-codes'] });
        }

        // Если hCaptcha прошла успешно, сохраняем пользователя (пример)
        // В реальном приложении здесь будет логика сохранения в базу данных
        console.log(`Пользователь ${nickname} из ${country} успешно зарегистрирован!`);

        res.status(200).json({ message: 'Пользователь успешно зарегистрирован!' });

    } catch (error) {
        // Более детальное логирование ошибок axios
        if (error.response) {
            // Запрос был сделан, и сервер ответил статусом, выходящим за пределы 2xx
            console.error('Ошибка HCaptcha API (response):', error.response.data);
            console.error('Статус HCaptcha API (status):', error.response.status);
            console.error('Заголовки HCaptcha API (headers):', error.response.headers);
            return res.status(500).json({ message: 'Ошибка при проверке hCaptcha на сервере.', details: error.response.data });
        } else if (error.request) {
            // Запрос был сделан, но ответа не получено (например, нет соединения)
            console.error('Ошибка HCaptcha API (request): Нет ответа от сервера HCaptcha.');
            return res.status(500).json({ message: 'Ошибка при проверке hCaptcha на сервере: Нет ответа от HCaptcha API.', details: error.message });
        } else {
            // Произошла ошибка при настройке запроса
            console.error('Ошибка HCaptcha API (other):', error.message);
            return res.status(500).json({ message: 'Неизвестная ошибка при проверке hCaptcha на сервере.', details: error.message });
        }
    }
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});