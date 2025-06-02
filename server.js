require('dotenv').config(); // ��������� ���������� ��������� �� .env �����
const express = require('express');
const axios = require('axios'); // ��� ��� �����, ���� ���������� ������ HTTP-�������, �� �� ��� �����
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
    twitter_username: { type: String, unique: true, sparse: true },
    twitter_profile_url: { type: String }
}, { timestamps: true }); // ��������� ���� createdAt � updatedAt

const User = mongoose.model('User', userSchema);

// --- MIDDLEWARE ---
// Middleware ��� ��������� JSON-��������
app.use(express.json());

// Middleware ��� ��������� URL-������������ ������ (��� ����)
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

// ������� ��� ��������� ���� ������������� �� MongoDB
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

// ������� ��� ����������� ������������ (��� hCaptcha)
app.post('/api/users', async (req, res) => {
    // �������� ������ �� ���� ������� (hcaptcha_response ����� ������ �� �����)
    const { nickname, country, lat, lng, avatar, twitter_username, twitter_profile_url } = req.body;

    console.log('�������� ������:', { nickname, country });

    // 1. ��������� �� ������� �������: �������� ������������ �����
    if (!nickname || !country || lat === undefined || lng === undefined) {
        console.warn('����������� ������������ ����:', { nickname, country, lat, lng });
        return res.status(400).json({ message: '����������� ������������ ���� (�������, ������ ��� ����������).' });
    }

    try {
        // ��������� ������������ � MongoDB
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
        // ��������� ������ MongoDB
        if (error.code === 11000) { // ��� ������ MongoDB ��� ���������� ������
            console.warn('������� ��������� ������������:', error.message);
            return res.status(409).json({ message: '������������ � ����� ��������� ��� ������ ������������ Twitter ��� ����������.', details: error.message });
        }
        
        console.error('����������� ������ ��� ���������� � ��:', error.message);
        return res.status(500).json({ message: '����������� ������ ��� ��������� �������.', details: error.message });
    }
});

// --- ������ ������� ---
app.listen(port, () => {
    console.log(`������ ������� �� ����� ${port}`);
});