require('dotenv').config(); // ��������� ���������� ��������� �� .env �����
const express = require('express');
const axios = require('axios'); // ��� ���������� HTTP-��������
const cors = require('cors'); // ��� ���������� CORS
const app = express();
const port = process.env.PORT || 3000;

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

// ������� ������� ��� �������� ������ �������
app.get('/', (req, res) => {
    res.send('API Server is running!');
});

// ������� ��� ����������� ������������
app.post('/api/users', async (req, res) => {
    const { nickname, country, 'h-captcha-response': hcaptcha_response } = req.body;

    console.log('Received data:', { nickname, country, hcaptcha_response: !!hcaptcha_response }); // �������� ���������� ������

    // 1. ��������� �� ������� �������: �������� ������������ �����
    if (!nickname || !country || !hcaptcha_response) {
        console.warn('����������� ������������ ����:', { nickname, country, hcaptcha_response: !!hcaptcha_response });
        return res.status(400).json({ message: '����������� ������������ ���� (�������, ������, ��� ����� hCaptcha).' });
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
        // *** �������� ������ �������� ������ � AXIOS ***
        // HCaptcha ������� ������ � ������� application/x-www-form-urlencoded
        // ���������� URLSearchParams ��� ����������� ������������ ���� �������
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
            return res.status(401).json({ message: '�������� hCaptcha �� ������. ����������, ���������� ��� ���.', errorCodes: hcaptchaData['error-codes'] });
        }

        // ���� hCaptcha ������ �������, ��������� ������������ (������)
        // � �������� ���������� ����� ����� ������ ���������� � ���� ������
        console.log(`������������ ${nickname} �� ${country} ������� ���������������!`);

        res.status(200).json({ message: '������������ ������� ���������������!' });

    } catch (error) {
        // ����� ��������� ����������� ������ axios
        if (error.response) {
            // ������ ��� ������, � ������ ������� ��������, ��������� �� ������� 2xx
            console.error('������ HCaptcha API (response):', error.response.data);
            console.error('������ HCaptcha API (status):', error.response.status);
            console.error('��������� HCaptcha API (headers):', error.response.headers);
            return res.status(500).json({ message: '������ ��� �������� hCaptcha �� �������.', details: error.response.data });
        } else if (error.request) {
            // ������ ��� ������, �� ������ �� �������� (��������, ��� ����������)
            console.error('������ HCaptcha API (request): ��� ������ �� ������� HCaptcha.');
            return res.status(500).json({ message: '������ ��� �������� hCaptcha �� �������: ��� ������ �� HCaptcha API.', details: error.message });
        } else {
            // ��������� ������ ��� ��������� �������
            console.error('������ HCaptcha API (other):', error.message);
            return res.status(500).json({ message: '����������� ������ ��� �������� hCaptcha �� �������.', details: error.message });
        }
    }
});

// ������ �������
app.listen(port, () => {
    console.log(`������ ������� �� ����� ${port}`);
});