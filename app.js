require('dotenv').config() // Загружаем переменные окружения из .env

const express = require('express')
const path = require('path')
const fs = require('fs')
const bodyParser = require('body-parser')
const { getOrCreateUser, updateBalance, getTopPlayers } = require('./database')

const app = express()
const PORT = process.env.PORT || 3000

// Получаем путь к базе данных
const dbPath =
	process.env.DB_PATH || path.join(__dirname, 'database', 'trump_game.db')

// Middleware
app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.json())

/**
 * 1️⃣ Получить текущий баланс пользователя
 */
app.post('/api/getBalance', async (req, res) => {
	try {
		const { telegramUserId, username } = req.body
		if (!telegramUserId) {
			return res.status(400).json({ error: '⛔ No Telegram user ID provided' })
		}

		const userData = await getOrCreateUser(telegramUserId, username)
		res.json({ balance: userData.balance, username: userData.username })
	} catch (err) {
		console.error('Ошибка в /api/getBalance:', err)
		res.status(500).json({ error: '❌ Internal Server Error' })
	}
})

/**
 * 2️⃣ Инкрементировать баланс пользователя (увеличить на 1)
 */
app.post('/api/incrementBalance', async (req, res) => {
	try {
		const { telegramUserId, username } = req.body
		if (!telegramUserId) {
			return res.status(400).json({ error: '⛔ No Telegram user ID provided' })
		}

		// Получаем текущий баланс
		const userData = await getOrCreateUser(telegramUserId, username)
		const newBalance = userData.balance + 1

		// Обновляем баланс в БД
		await updateBalance(telegramUserId, newBalance)
		res.json({ balance: newBalance })
	} catch (err) {
		console.error('Ошибка в /api/incrementBalance:', err)
		res.status(500).json({ error: '❌ Internal Server Error' })
	}
})

/**
 * 3️⃣ Получить топ-100 игроков (лидерборд)
 */
app.get('/api/leaderboard', async (req, res) => {
	try {
		const topPlayers = await getTopPlayers(100)
		res.json(topPlayers)
	} catch (err) {
		console.error('Ошибка в /api/leaderboard:', err)
		res.status(500).json({ error: '❌ Internal Server Error' })
	}
})

/**
 * 4️⃣ Скачивание базы данных (только для админа)
 */
app.get('/download-db', (req, res) => {
	const adminKey = req.query.key || ''
	const expectedKey = process.env.ADMIN_KEY // Ключ из .env

	if (adminKey !== expectedKey) {
		return res.status(403).send('⛔ Доступ запрещён. Неверный ключ.')
	}

	if (!fs.existsSync(dbPath)) {
		return res.status(404).send('❌ Файл базы данных не найден.')
	}

	res.download(dbPath, 'trump_game.db', err => {
		if (err) {
			console.error('Ошибка при отправке файла:', err)
			res.status(500).send('❌ Ошибка при скачивании файла.')
		}
	})
})

// Запуск сервера
app.listen(PORT, () => {
	console.log(`🚀 Сервер запущен на http://localhost:${PORT}`)
})
