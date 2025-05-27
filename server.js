// ��������� ���������� ��������� �� ����� .env
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
// ���������� ���� �� ���������� ��������� (��� Render) ��� 3000 ��� ���������� �������
const PORT = process.env.PORT || 3000;

// --- Middleware: ������������� �� ---
// ��������� ������� �� ������ ��������� (����� ��� ������� ����� ������� ��������)
app.use(cors());
// ��������� Express ������� JSON-���� ��������. ����������� ����� �� 5 �� ��� ��������.
app.use(express.json({ limit: '5mb' }));

// --- ����������� � MongoDB ---
// �������� URI ����������� �� ���������� ���������
const mongoUri = process.env.MONGODB_URI;

// ���������, ��������� �� URI
if (!mongoUri) {
    console.error('������: MONGODB_URI �� ���������� � ����� .env.');
    console.error('���������, ��� ���� .env ���������� � �������� MONGODB_URI=����_������_�����������');
    process.exit(1); // ������� �� ����������, ���� URI �����������
}

// ������������ � ���� ������
mongoose.connect(mongoUri)
    .then(() => console.log('MongoDB ������� ����������!'))
    .catch(err => {
        console.error('������ ����������� MongoDB:');
        console.error('��������� MONGODB_URI � .env � ��������� ������� � MongoDB Atlas.');
        console.error(err);
        process.exit(1); // ������� ��� ������ ����������� � ��
    });

// --- ����������� ����� ������������ (��� ������ �������� � ���� ������) ---
const userSchema = new mongoose.Schema({
    nickname: { type: String, required: true, maxlength: 20 },
    country: { type: String, required: true },
    lat: { type: Number, required: true }, // ������
    lng: { type: Number, required: true }, // �������
    avatar: { type: String } // ������ � ���� Base64 ������ (����� ���� ������)
});

// ������� ������ 'User' �� ������ �����
const User = mongoose.model('User', userSchema);

// --- API ��������� ---

// 1. GET /api/users: �������� ���� �������������
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find(); // ������� ���� ������������� � ��
        res.json(users); // ���������� �� � ������� JSON
    } catch (err) {
        console.error('������ ��� ��������� �������������:', err);
        res.status(500).json({ message: '������ ������� ��� ��������� �������������', error: err.message });
    }
});

// 2. POST /api/users: �������� ������ ������������
app.post('/api/users', async (req, res) => {
    // ��������������� ������ �� ���� �������
    const { nickname, country, lat, lng, avatar } = req.body;

    // ��������� ������� ������
    if (!nickname || !country || lat === undefined || lng === undefined) {
        return res.status(400).json({ message: '����������� ������������ ����: nickname, country, lat, lng' });
    }

    try {
        // ������� ����� ��������� ������������ �� ������ ������
        const newUser = new User({ nickname, country, lat, lng, avatar });
        await newUser.save(); // ��������� ������ ������������ � ���� ������
        res.status(201).json(newUser); // ���������� ������� ��������� ������ ������������ � HTTP �������� 201 (Created)
    } catch (err) {
        // ��������� ������ ��������� Mongoose (���� ���� �� ������������� �����)
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: err.message });
        }
        console.error('������ ��� ���������� ������������:', err);
        res.status(500).json({ message: '������ ������� ��� ���������� ������������', error: err.message });
    }
});

// ������ �������
app.listen(PORT, () => {
    console.log(`������ ������� �� ����� ${PORT}`);
    console.log(`��������� �����: http://localhost:${PORT}`);
});