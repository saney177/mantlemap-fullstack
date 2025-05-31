require('dotenv').config(); // Загружаем переменные окружения из файла .env
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios'); // Для выполнения HTTP-запросов (hCaptcha, Unavatar)
const rateLimit = require('express-rate-limit'); // Для ограничения запросов по IP-адресу

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const HCAPTCHA_SECRET_KEY = process.env.ES_2efad8d365774f438db08572da21f659; // Ваш секретный ключ hCaptcha

// Middleware
app.use(express.json()); // Для парсинга JSON-тел запросов
app.use(cors({
    origin: 'https://mantlemap.xyz' // Укажите здесь домен вашего фронтенда
})); // Включаем CORS. В продакшене рекомендуется ограничить домен фронтенда.

// Если ваш Express-сервер находится за прокси (например, Render, Nginx),
// вам может потребоваться эта строка, чтобы получать реальный IP-адрес клиента.
// Для Render обычно достаточно '1'.
app.set('trust proxy', 1);

// MongoDB Connection
mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        // Выходим из процесса, если подключение к БД критично для работы приложения.
        // Это предотвратит запуск приложения без рабочей базы данных.
        process.exit(1);
    });

// Определение схемы и модели пользователя
const userSchema = new mongoose.Schema({
    nickname: { type: String, required: true, unique: true, trim: true },
    country: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    avatar: { type: String, default: 'https://via.placeholder.com/50x50.png?text=Anon' }, // URL аватара из unavatar.io, с дефолтным значением
    twitter_username: { type: String, unique: true, sparse: true, trim: true }, // Очищенное имя пользователя Twitter без '@'
    twitter_profile_url: { type: String }
}, { timestamps: true }); // Добавляет поля createdAt и updatedAt

const User = mongoose.model('User', userSchema);

// --- Middleware для ограничения количества запросов по IP ---
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 5, // Максимум 5 запросов с одного IP в течение windowMs
    message:
        "Слишком много аккаунтов создано с этого IP-адреса, пожалуйста, попробуйте снова через 15 минут.",
    statusCode: 429, // 429 Too Many Requests
    headers: true, // Отправлять заголовки X-RateLimit-*
});

// --- Маршруты ---

// GET: Получить всех пользователей
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (error) {
        console.error('Ошибка при получении пользователей:', error);
        res.status(500).json({ message: 'Не удалось получить пользователей', error: error.message });
    }
});

// POST: Добавить нового пользователя (с применением ограничителя запросов)
app.post('/api/users', limiter, async (req, res) => {
    // Деструктурируем только необходимые поля из req.body.
    // lat и lng НЕ должны приходить с фронтенда, они определяются на бэкенде.
    // avatar также будет определен на бэкенде.
    let { nickname, country, twitter_username, hcaptcha_response } = req.body;

    // 1. Валидация на стороне сервера: проверка обязательных полей
    if (!nickname || !country || !hcaptcha_response) {
        return res.status(400).json({ message: 'Отсутствуют обязательные поля (никнейм, страна, или ответ hCaptcha).' });
    }

    // 2. Верификация hCaptcha
    try {
        const hCaptchaVerificationUrl = 'https://hcaptcha.com/siteverify';
        const hCaptchaVerificationData = new URLSearchParams(); // Используем URLSearchParams для x-www-form-urlencoded
        hCaptchaVerificationData.append('response', hcaptcha_response);
        hCaptchaVerificationData.append('secret', HCAPTCHA_SECRET_KEY);

        const hCaptchaRes = await axios.post(hCaptchaVerificationUrl, hCaptchaVerificationData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (!hCaptchaRes.data.success) {
            console.warn('Верификация hCaptcha не удалась:', hCaptchaRes.data);
            return res.status(401).json({ message: 'Верификация hCaptcha не удалась. Пожалуйста, попробуйте снова.' });
        }
        console.log('Верификация hCaptcha успешна.');
    } catch (hCaptchaError) {
        console.error('Ошибка при верификации hCaptcha:', hCaptchaError.response ? hCaptchaError.response.data : hCaptchaError.message);
        return res.status(500).json({ message: 'Ошибка верификации hCaptcha на стороне сервера.' });
    }

    // 3. Верификация Twitter Username и Avatar
    let verifiedAvatarUrl = 'https://via.placeholder.com/50x50.png?text=Anon'; // Дефолтный аватар
    let verifiedTwitterUsername = null;
    let verifiedTwitterProfileUrl = null;

    if (twitter_username) {
        // Очищаем имя пользователя Twitter от символа '@', если он присутствует
        twitter_username = twitter_username.replace(/^@/, '').trim();

        // Проверяем, что после очистки имя пользователя не пустое
        if (twitter_username) {
            try {
                // Выполняем запрос к unavatar.io с бэкенда для верификации и получения URL
                const unavatarUrl = `https://unavatar.io/twitter/${twitter_username}?size=400`;
                const unavatarResponse = await axios.get(unavatarUrl, {
                    // Не бросаем ошибку для 4xx статусов, чтобы мы могли обработать плейсхолдеры
                    validateStatus: status => status < 500
                });

                // Проверяем статус и убеждаемся, что это не стандартный плейсхолдер/ошибка от unavatar.io.
                // Unavatar возвращает 200 даже для несуществующих профилей, но URL будет указывать на их плейсхолдер.
                if (unavatarResponse.status === 200 && unavatarResponse.request.res.responseUrl && !unavatarResponse.request.res.responseUrl.includes('placeholder')) {
                    verifiedAvatarUrl = unavatarResponse.request.res.responseUrl;
                    verifiedTwitterProfileUrl = `https://twitter.com/${twitter_username}`; // Воссоздаем URL для консистентности
                    verifiedTwitterUsername = twitter_username; // Убеждаемся, что это очищенное имя пользователя
                } else {
                    console.warn(`Верификация Twitter-пользователя '${twitter_username}' не удалась или возвращен плейсхолдер. Используется аватар по умолчанию.`);
                    // verifiedAvatarUrl уже установлен в дефолтный
                    // verifiedTwitterProfileUrl и verifiedTwitterUsername остаются null
                }
            } catch (twitterVerificationError) {
                console.error(`Ошибка при верификации Twitter-пользователя '${twitter_username}':`, twitterVerificationError.message);
                // verifiedAvatarUrl уже установлен в дефолтный
                // verifiedTwitterProfileUrl и verifiedTwitterUsername остаются null
            }
        }
    }

    // 4. Валидация данных страны и получение координат
    const countryCoords = getCountryCoords(country); // Больше не async, так как данные локальны
    if (!countryCoords) {
        return res.status(400).json({ message: 'Предоставлена неверная страна.' });
    }

    // 5. Сохранение пользователя в базу данных
    try {
        const newUser = new User({
            nickname,
            country,
            lat: countryCoords.lat, // Координаты берутся из верифицированных данных страны
            lng: countryCoords.lng, // Координаты берутся из верифицированных данных страны
            avatar: verifiedAvatarUrl, // Используем верифицированный или дефолтный аватар
            twitter_username: verifiedTwitterUsername, // Используем верифицированное имя пользователя
            twitter_profile_url: verifiedTwitterProfileUrl // Используем верифицированный URL профиля
        });
        await newUser.save();
        res.status(201).json(newUser);
    } catch (error) {
        console.error('Ошибка при сохранении пользователя:', error);
        if (error.code === 11000) { // Ошибка дубликата ключа (например, никнейм или twitter_username уже существуют)
            let message = 'Произошла ошибка дубликата. Пользователь с таким никнеймом или Twitter-аккаунтом уже существует.';
            if (error.keyPattern && error.keyPattern.nickname) {
                message = 'Пользователь с таким никнеймом уже существует.';
            } else if (error.keyPattern && error.keyPattern.twitter_username) {
                message = 'Пользователь с таким Twitter-аккаунтом уже существует.';
            }
            return res.status(409).json({ message: message });
        }
        res.status(500).json({ message: 'Не удалось создать пользователя', error: error.message });
    }
});

// Вспомогательная функция для получения координат страны на бэкенде.
// ЭТО КРИТИЧЕСКИ ВАЖНО: Вставьте сюда ВЕСЬ ваш countryData объект из фронтенда!
// Функция теперь синхронна, так как данные локальны и не требуют await.
function getCountryCoords(countryName) {
    const countryDataBackend = {
        "Afghanistan": { lat: 33.93911, lng: 67.709953 },
        "Albania": { lat: 41.153332, lng: 20.168331 },
        "Algeria": { lat: 28.033886, lng: 1.659626 },
        "Andorra": { lat: 42.546245, lng: 1.601555 },
        "Angola": { lat: -11.202692, lng: 17.873887 },
        "Antigua and Barbuda": { lat: 17.060816, lng: -61.796428 },
        "Argentina": { lat: -38.416097, lng: -63.616672 },
        "Armenia": { lat: 40.069099, lng: 45.038189 },
        "Australia": { lat: -25.274398, lng: 133.775136 },
        "Austria": { lat: 47.516231, lng: 14.550072 },
        "Azerbaijan": { lat: 40.143105, lng: 47.576927 },
        "Bahamas": { lat: 25.03428, lng: -77.39628 },
        "Bahrain": { lat: 25.930414, lng: 50.637772 },
        "Bangladesh": { lat: 23.684994, lng: 90.356331 },
        "Barbados": { lat: 13.193887, lng: -59.543198 },
        "Belarus": { lat: 53.709807, lng: 27.953389 },
        "Belgium": { lat: 50.503887, lng: 4.469936 },
        "Belize": { lat: 17.189877, lng: -88.49765 },
        "Benin": { lat: 9.30769, lng: 2.315834 },
        "Bhutan": { lat: 27.514162, lng: 90.433601 },
        "Bolivia": { lat: -16.290154, lng: -63.588653 },
        "Bosnia and Herzegovina": { lat: 43.915886, lng: 17.679076 },
        "Botswana": { lat: -22.328474, lng: 24.684866 },
        "Brazil": { lat: -14.235004, lng: -51.92528 },
        "Brunei": { lat: 4.535277, lng: 114.727669 },
        "Bulgaria": { lat: 42.733883, lng: 25.48583 },
        "Burkina Faso": { lat: 12.238333, lng: -1.561593 },
        "Burundi": { lat: -3.373056, lng: 29.918888 },
        "Cabo Verde": { lat: 16.002082, lng: -24.013197 },
        "Cambodia": { lat: 12.565679, lng: 104.990963 },
        "Cameroon": { lat: 7.369722, lng: 12.354722 },
        "Canada": { lat: 56.130366, lng: -106.346771 },
        "Central African Republic": { lat: 6.611111, lng: 20.939444 },
        "Chad": { lat: 15.454166, lng: 18.732207 },
        "Chile": { lat: -35.675147, lng: -71.542969 },
        "China": { lat: 35.86166, lng: 104.195397 },
        "Colombia": { lat: 4.570868, lng: -74.297333 },
        "Comoros": { lat: -11.875001, lng: 43.872219 },
        "Congo": { lat: -0.228021, lng: 15.827659 },
        "Costa Rica": { lat: 9.748917, lng: -83.753428 },
        "Croatia": { lat: 45.1, lng: 15.2 },
        "Cuba": { lat: 21.521757, lng: -77.781167 },
        "Cyprus": { lat: 35.126413, lng: 33.429859 },
        "Czech Republic": { lat: 49.817492, lng: 15.472962 },
        "Denmark": { lat: 56.26392, lng: 9.501785 },
        "Djibouti": { lat: 11.825138, lng: 42.590275 },
        "Dominica": { lat: 15.414999, lng: -61.370976 },
        "Dominican Republic": { lat: 18.735693, lng: -70.162651 },
        "Ecuador": { lat: -1.831239, lng: -78.183406 },
        "Egypt": { lat: 26.820553, lng: 30.802498 },
        "El Salvador": { lat: 13.794185, lng: -88.89653 },
        "Equatorial Guinea": { lat: 1.650801, lng: 10.267895 },
        "Eritrea": { lat: 15.179384, lng: 39.782334 },
        "Estonia": { lat: 58.595272, lng: 25.013607 },
        "Eswatini": { lat: -26.522503, lng: 31.465866 },
        "Ethiopia": { lat: 9.145, lng: 40.489673 },
        "Fiji": { lat: -16.578193, lng: 179.414413 },
        "Finland": { lat: 61.92411, lng: 25.748151 },
        "France": { lat: 46.227638, lng: 2.213749 },
        "Gabon": { lat: -0.803689, lng: 11.609444 },
        "Gambia": { lat: 13.443182, lng: -15.310139 },
        "Georgia": { lat: 42.315407, lng: 43.356892 },
        "Germany": { lat: 51.165691, lng: 10.451526 },
        "Ghana": { lat: 7.946527, lng: -1.023194 },
        "Greece": { lat: 39.074208, lng: 21.824312 },
        "Grenada": { lat: 12.262776, lng: -61.604171 },
        "Guatemala": { lat: 15.783471, lng: -90.230759 },
        "Guinea": { lat: 9.945587, lng: -9.696645 },
        "Guinea-Bissau": { lat: 11.803749, lng: -15.180413 },
        "Guyana": { lat: 4.860416, lng: -58.93018 },
        "Haiti": { lat: 18.971187, lng: -72.285215 },
        "Honduras": { lat: 15.199999, lng: -86.241905 },
        "Hungary": { lat: 47.162494, lng: 19.503304 },
        "Iceland": { lat: 64.963051, lng: -19.020835 },
        "India": { lat: 20.593684, lng: 78.96288 },
        "Indonesia": { lat: -0.789275, lng: 113.921327 },
        "Iran": { lat: 32.427908, lng: 53.688046 },
        "Iraq": { lat: 33.223191, lng: 43.679291 },
        "Ireland": { lat: 53.41291, lng: -8.24389 },
        "Israel": { lat: 31.046051, lng: 34.851612 },
        "Italy": { lat: 41.87194, lng: 12.56738 },
        "Jamaica": { lat: 18.109581, lng: -77.297508 },
        "Japan": { lat: 36.204824, lng: 138.252924 },
        "Jordan": { lat: 30.585164, lng: 36.238414 },
        "Kazakhstan": { lat: 48.019573, lng: 66.923684 },
        "Kenya": { lat: -0.023559, lng: 37.906193 },
        "Kiribati": { lat: -3.370417, lng: -168.734039 },
        "Kuwait": { lat: 29.31166, lng: 47.481766 },
        "Kyrgyzstan": { lat: 41.20438, lng: 74.766098 },
        "Laos": { lat: 19.85627, lng: 102.495496 },
        "Latvia": { lat: 56.879635, lng: 24.603189 },
        "Lebanon": { lat: 33.854721, lng: 35.862285 },
        "Lesotho": { lat: -29.609988, lng: 28.233608 },
        "Liberia": { lat: 6.428055, lng: -9.429499 },
        "Libya": { lat: 26.3351, lng: 17.228331 },
        "Liechtenstein": { lat: 47.166, lng: 9.555373 },
        "Lithuania": { lat: 55.169438, lng: 23.881275 },
        "Luxembourg": { lat: 49.815273, lng: 6.129583 },
        "Madagascar": { lat: -18.766947, lng: 46.869107 },
        "Malawi": { lat: -13.254308, lng: 34.301525 },
        "Malaysia": { lat: 4.210484, lng: 101.975766 },
        "Maldives": { lat: 3.202778, lng: 73.22068 },
        "Mali": { lat: 17.570692, lng: -3.996166 },
        "Malta": { lat: 35.937496, lng: 14.375416 },
        "Marshall Islands": { lat: 7.131474, lng: 171.184478 },
        "Mauritania": { lat: 21.00789, lng: -10.940835 },
        "Mauritius": { lat: -20.348404, lng: 57.552152 },
        "Mexico": { lat: 23.634501, lng: -102.552784 },
        "Micronesia": { lat: 7.425554, lng: 150.550812 },
        "Moldova": { lat: 47.411631, lng: 28.369885 },
        "Monaco": { lat: 43.750298, lng: 7.412841 },
        "Mongolia": { lat: 46.862496, lng: 103.846656 },
        "Montenegro": { lat: 42.708678, lng: 19.37439 },
        "Morocco": { lat: 31.791702, lng: -7.09262 },
        "Mozambique": { lat: -18.665695, lng: 35.529562 },
        "Myanmar": { lat: 21.913965, lng: 95.956223 },
        "Namibia": { lat: -22.95764, lng: 18.49041 },
        "Nauru": { lat: -0.522778, lng: 166.931503 },
        "Nepal": { lat: 28.394857, lng: 84.124008 },
        "Netherlands": { lat: 52.132633, lng: 5.291266 },
        "New Zealand": { lat: -40.900557, lng: 174.885971 },
        "Nicaragua": { lat: 12.865416, lng: -85.207229 },
        "Niger": { lat: 17.607789, lng: 8.081666 },
        "Nigeria": { lat: 9.081999, lng: 8.675277 },
        "North Korea": { lat: 40.339852, lng: 127.510093 },
        "North Macedonia": { lat: 41.608635, lng: 21.745275 },
        "Norway": { lat: 60.472024, lng: 8.468946 },
        "Oman": { lat: 21.512583, lng: 55.923255 },
        "Pakistan": { lat: 30.375321, lng: 69.345116 },
        "Palau": { lat: 7.51498, lng: 134.58252 },
        "Palestine": { lat: 31.952162, lng: 35.233154 },
        "Panama": { lat: 8.537981, lng: -80.782127 },
        "Papua New Guinea": { lat: -6.314993, lng: 143.95555 },
        "Paraguay": { lat: -23.442503, lng: -58.443832 },
        "Peru": { lat: -9.189967, lng: -75.015152 },
        "Philippines": { lat: 12.879721, lng: 121.774017 },
        "Poland": { lat: 51.919438, lng: 19.145136 },
        "Portugal": { lat: 39.399872, lng: -8.224454 },
        "Qatar": { lat: 25.354826, lng: 51.183884 },
        "Romania": { lat: 45.943161, lng: 24.96676 },
        "Russia": { lat: 61.52401, lng: 105.318756 },
        "Rwanda": { lat: -1.940278, lng: 29.873888 },
        "Saint Kitts and Nevis": { lat: 17.357822, lng: -62.782998 },
        "Saint Lucia": { lat: 13.909444, lng: -60.978893 },
        "Saint Vincent and the Grenadines": { lat: 12.984305, lng: -61.287228 },
        "Samoa": { lat: -13.759029, lng: -172.104629 },
        "San Marino": { lat: 43.94236, lng: 12.457777 },
        "Sao Tome and Principe": { lat: 0.18636, lng: 6.613081 },
        "Saudi Arabia": { lat: 23.885942, lng: 45.079162 },
        "Senegal": { lat: 14.497401, lng: -14.452362 },
        "Serbia": { lat: 44.016521, lng: 21.005859 },
        "Seychelles": { lat: -4.679574, lng: 55.491977 },
        "Sierra Leone": { lat: 8.460555, lng: -11.779889 },
        "Singapore": { lat: 1.352083, lng: 103.819836 },
        "Slovakia": { lat: 48.669026, lng: 19.699024 },
        "Slovenia": { lat: 46.151241, lng: 14.995463 },
        "Solomon Islands": { lat: -9.64571, lng: 160.156194 },
        "Somalia": { lat: 5.152149, lng: 46.199616 },
        "South Africa": { lat: -30.559482, lng: 22.937506 },
        "South Korea": { lat: 35.907757, lng: 127.766922 },
        "South Sudan": { lat: 6.877, lng: 31.307 },
        "Spain": { lat: 40.463667, lng: -3.74922 },
        "Sri Lanka": { lat: 7.873054, lng: 80.771797 },
        "Sudan": { lat: 12.862807, lng: 30.217636 },
        "Suriname": { lat: 3.919305, lng: -56.027783 },
        "Sweden": { lat: 60.128161, lng: 18.643501 },
        "Switzerland": { lat: 46.818188, lng: 8.227512 },
        "Syria": { lat: 34.802075, lng: 38.996815 },
        "Taiwan": { lat: 23.69781, lng: 120.960515 },
        "Tajikistan": { lat: 38.861034, lng: 71.276093 },
        "Tanzania": { lat: -6.369028, lng: 34.888822 },
        "Thailand": { lat: 15.870032, lng: 100.992541 },
        "Timor-Leste": { lat: -8.874217, lng: 125.727539 },
        "Togo": { lat: 8.619543, lng: 0.824782 },
        "Tonga": { lat: -21.178986, lng: -175.198242 },
        "Trinidad and Tobago": { lat: 10.691803, lng: -61.222503 },
        "Tunisia": { lat: 33.886917, lng: 9.537499 },
        "Turkey": { lat: 38.963745, lng: 35.243322 },
        "Turkmenistan": { lat: 38.969719, lng: 59.556278 },
        "Tuvalu": { lat: -7.109535, lng: 177.64933 },
        "Uganda": { lat: 1.373333, lng: 32.290275 },
        "Ukraine": { lat: 48.379433, lng: 31.16558 },
        "United Arab Emirates": { lat: 23.424076, lng: 53.847818 },
        "United Kingdom": { lat: 55.378051, lng: -3.435973 },
        "United States": { lat: 37.09024, lng: -95.712891 },
        "Uruguay": { lat: -32.522779, lng: -55.765835 },
        "Uzbekistan": { lat: 41.377491, lng: 64.585262 },
        "Vanuatu": { lat: -15.376706, lng: 166.959158 },
        "Vatican City": { lat: 41.902916, lng: 12.453389 },
        "Venezuela": { lat: 6.42375, lng: -66.58973 },
        "Vietnam": { lat: 14.058324, lng: 108.277199 },
        "Yemen": { lat: 15.552727, lng: 48.516388 },
        "Zambia": { lat: -13.133897, lng: 27.849332 },
        "Zimbabwe": { lat: -19.015438, lng: 29.154857 }
    };
    return countryDataBackend[countryName];
}

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});