// app.js
const express = require('express')
const path = require('path')
const fs = require('fs')
const bodyParser = require('body-parser')
const { getOrCreateUser, updateBalance } = require('./database')

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.json())

// 1) Получить текущий баланс
app.post('/api/getBalance', async (req, res) => {
	try {
		const { telegramUserId } = req.body
		if (!telegramUserId) {
			return res.status(400).json({ error: 'No Telegram user ID provided' })
		}

		// Получаем или создаём запись
		const { balance } = await getOrCreateUser(telegramUserId)
		res.json({ balance })
	} catch (err) {
		console.error('Error in /api/getBalance:', err)
		res.status(500).json({ error: 'Internal Server Error' })
	}
})

// 2) Инкрементируем баланс
app.post('/api/incrementBalance', async (req, res) => {
	try {
		const { telegramUserId } = req.body
		if (!telegramUserId) {
			return res.status(400).json({ error: 'No Telegram user ID provided' })
		}

		// Получаем/создаём запись
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

// ============ АДМИНСКИЙ МАРШРУТ ДЛЯ СКАЧИВАНИЯ БАЗЫ ============
app.get('/download-db', (req, res) => {
	const adminKey = req.query.key
	if (adminKey !== 'Lesha_Self1') {
		return res.status(403).send('Access denied.')
	}

	const dbPath = path.join(__dirname, 'trump_game.db')
	if (!fs.existsSync(dbPath)) {
		return res.status(404).send('Database file not found.')
	}

	res.download(dbPath, 'trump_game.db', err => {
		if (err) {
			console.error('Error sending file:', err)
			res.status(500).send('Error downloading file.')
		}
	})
})
// ============================================================

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`)
})
