// app.js
const express = require('express')
const path = require('path')
const fs = require('fs') // <-- Добавляем для проверки и скачивания файла
const bodyParser = require('body-parser')
const { getOrCreateUser, updateBalance, updateProgress } = require('./database')

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.json())

// 1) Получить текущие данные пользователя (balance и progress)
app.post('/api/getUserData', async (req, res) => {
	try {
		const { telegramUserId } = req.body
		if (!telegramUserId) {
			return res.status(400).json({ error: 'No Telegram user ID provided' })
		}

		const { balance, progress } = await getOrCreateUser(telegramUserId)
		res.json({ balance, progress })
	} catch (err) {
		console.error('Error in /api/getUserData:', err)
		res.status(500).json({ error: 'Internal Server Error' })
	}
})

// 2) Инкрементируем баланс (пример — если нужна старая логика)
app.post('/api/incrementBalance', async (req, res) => {
	try {
		const { telegramUserId } = req.body
		if (!telegramUserId) {
			return res.status(400).json({ error: 'No Telegram user ID provided' })
		}

		// Получаем или создаём запись
		const { balance } = await getOrCreateUser(telegramUserId)

		// Увеличиваем баланс на 1
		const newBalance = balance + 1

		await updateBalance(telegramUserId, newBalance)
		res.json({ balance: newBalance })
	} catch (err) {
		console.error('Error in /api/incrementBalance:', err)
		res.status(500).json({ error: 'Internal Server Error' })
	}
})

// 3) Обновить прогресс (установить какое-то значение)
app.post('/api/updateProgress', async (req, res) => {
	try {
		const { telegramUserId, progress } = req.body
		if (!telegramUserId) {
			return res.status(400).json({ error: 'No Telegram user ID provided' })
		}
		if (typeof progress !== 'number') {
			return res.status(400).json({ error: 'Progress must be a number' })
		}

		// Убедимся, что запись есть (либо создаём)
		await getOrCreateUser(telegramUserId)

		// Сохраняем прогресс
		await updateProgress(telegramUserId, progress)

		res.json({ success: true })
	} catch (err) {
		console.error('Error in /api/updateProgress:', err)
		res.status(500).json({ error: 'Internal Server Error' })
	}
})

// ============ АДМИНСКИЙ МАРШРУТ ДЛЯ СКАЧИВАНИЯ БАЗЫ ДАННЫХ ============
app.get('/download-db', (req, res) => {
	const adminKey = req.query.key // получаем ключ из query-параметра ?key=...
	if (adminKey !== 'Lesha_Self1') {
		return res.status(403).send('Access denied.')
	}

	// Путь к файлу вашей БД (имя может отличаться, если вы его меняли)
	const dbPath = path.join(__dirname, 'trump_game.db')

	// Проверяем, существует ли файл
	if (!fs.existsSync(dbPath)) {
		return res.status(404).send('Database file not found.')
	}

	// Отправляем файл на скачивание
	res.download(dbPath, 'trump_game.db', err => {
		if (err) {
			console.error('Error sending file:', err)
			res.status(500).send('Error downloading file.')
		}
	})
})
// =====================================================================

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`)
})
