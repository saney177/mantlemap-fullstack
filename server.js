require('dotenv').config(); // ��������� ���������� ��������� �� .env �����
const express = require('express');
const axios = require('axios'); // ��� ���������� HTTP-��������
const cors = require('cors'); // ��� ���������� CORS
const mongoose = require('mongoose'); // ��� ������ � MongoDB

const app = express();
const port = process.env.PORT || 3000;

// --- ����������� � MONGODB ---
// ���������, ��� process.env.MONGODB_URI ���������� (��������, � ����� .env)
mongoose.connect(process.env.MONGODB_URI || '���_����_�_MONGODB')
  .then(() => console.log('���������� � MongoDB!'))
  .catch(err => console.error('������ ����������� � MongoDB:', err));

// --- ����������� ����� � ������ MONGODB ---
const userSchema = new mongoose.Schema({
    nickname: { type: String, required: true, unique: true },
    country: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    avatar: { type: String },
    twitter_username: { type: String, unique: true, sparse: true }, // unique: true � sparse: true ��������� ���������� ���������� ����� null ��������
    twitter_profile_url: { type: String }
}, { timestamps: true }); // ��������� ���� createdAt � updatedAt

const User = mongoose.model('User', userSchema);

// --- MIDDLEWARE ---
// Middleware ��� ��������� JSON-��������
app.use(express.json());

// Middleware ��� ��������� URL-������������ ������ (��� ����), ���� ��� hCaptcha ���������� URLSearchParams
app.use(express.urlencoded({ extended: true }));

// ��������� CORS
app.use(cors({
    origin: ['https://mantlemap.xyz', 'http://localhost:8080'], // ����������� ������
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// --- �������� API ---

// ������� ������� ��� �������� ������ �������
app.get('/', (req, res) => {
    res.send('API Server is running!');
});

// ����� ������� ��� ��������� ���� ������������� �� MongoDB
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}); // �������� ���� ������������� �� ���������
        console.log(`�������� ${users.length} ������������� �� ��.`);
        res.status(200).json(users); // ���������� ������������� ��� JSON
    } catch (error) {
        console.error('������ ��� ��������� ������������� �� MongoDB:', error);
        res.status(500).json({ message: '���������� ������ ������� ��� ��������� �������������.' });
    }
});

// ������� ��� ����������� ������������
app.post('/api/users', async (req, res) => {
    // ��������: �������� h-captcha-response �� hcaptcha_response, ����� ��������������� ���������
    const { nickname, country, lat, lng, avatar, twitter_username, twitter_profile_url, hcaptcha_response } = req.body;

    console.log('�������� ������:', { nickname, country, hcaptcha_response: !!hcaptcha_response });

    // 1. ��������� �� ������� �������: �������� ������������ �����
    if (!nickname || !country || !hcaptcha_response || lat === undefined || lng === undefined) {
        console.warn('����������� ������������ ����:', { nickname, country, lat, lng, hcaptcha_response: !!hcaptcha_response });
        return res.status(400).json({ message: '����������� ������������ ���� (�������, ������, ���������� ��� ����� hCaptcha).' });
    }

    // 2. ��������� hCaptcha �� ������� �������
    const secret = process.env.HCAPTCHA_SECRET_KEY; // ��� ��������� ���� �� ���������� ���������
    const verificationUrl = 'https://hcaptcha.com/siteverify';

    // ��������, ��� ��������� ���� ����������
    if (!secret) {
        console.error('HCAPTCHA_SECRET_KEY �� ���������� � ���������� ���������!');
        return res.status(500).json({ message: '������ �������: HCAPTCHA_SECRET_KEY �� ��������.' });
    }

    try {
        // HCaptcha ������� ������ � ������� application/x-www-form-urlencoded
        const params = new URLSearchParams();
        params.append('secret', secret);
        params.append('response', hcaptcha_response);

        const verificationRes = await axios.post(verificationUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const hcaptchaData = verificationRes.data;
        console.log('����� ����������� hCaptcha:', hcaptchaData);

        if (!hcaptchaData.success) {
            console.warn('����������� hCaptcha �� ��������:', hcaptchaData['error-codes']);
            return res.status(401).json({ message: '�������� hCaptcha �� ������. ����������, ���������� ��� ���.', errorCodes: hcaptchaData['error-codes'] });
        }

        // ���� hCaptcha ������ �������, ��������� ������������ � MongoDB
        const newUser = new User({
            nickname,
            country,
            lat,
            lng,
            avatar,
            twitter_username,
            twitter_profile_url
        });

        await newUser.save(); // ��������� ������ ������������ � ���� ������
        console.log(`������������ ${nickname} �� ${country} ������� ��������������� � �������� � ��!`);

        // ���������� �������������� ������������ � ID �� ��
        res.status(201).json(newUser); // 201 Created - ��� ��������� �������� �������

    } catch (error) {
        // ����� ��������� ����������� ������ axios � MongoDB
        if (error.code === 11000) { // ��� ������ MongoDB ��� ���������� ������
            console.warn('������� ��������� ������������:', error.message);
            return res.status(409).json({ message: '������������ � ����� ��������� ��� ������ ������������ Twitter ��� ����������.', details: error.message });
        }
        if (error.response) {
            console.error('������ HCaptcha API (response):', error.response.data);
            console.error('������ HCaptcha API (status):', error.response.status);
            console.error('��������� HCaptcha API (headers):', error.response.headers);
            return res.status(500).json({ message: '������ ��� �������� hCaptcha �� �������.', details: error.response.data });
        } else if (error.request) {
            console.error('������ HCaptcha API (request): ��� ������ �� ������� HCaptcha.');
            return res.status(500).json({ message: '������ ��� �������� hCaptcha �� �������: ��� ������ �� HCaptcha API.', details: error.message });
        } else {
            console.error('����������� ������ HCaptcha API ��� ���������� � ��:', error.message);
            return res.status(500).json({ message: '����������� ������ ��� ��������� �������.', details: error.message });
        }
    }
});

// --- ������ ������� ---
app.listen(port, () => {
    console.log(`������ ������� �� ����� ${port}`);
});