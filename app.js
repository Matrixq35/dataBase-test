// app.js
const express = require('express')
const path = require('path')
const fs = require('fs')
const bodyParser = require('body-parser')

// Импортируем нужные функции
const { getOrCreateUser, updateBalance, getTopPlayers } = require('./database')

const app = express()
const PORT = process.env.PORT || 3000

// Раздаём статические файлы из папки public
app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.json())

// 1) Получить/создать пользователя и вернуть баланс
app.post('/api/getBalance', async (req, res) => {
	try {
		const { telegramUserId, username } = req.body
		if (!telegramUserId) {
			return res.status(400).json({ error: 'No Telegram user ID provided' })
		}
		// Сохраняем (или обновляем) username, если передан
		const userData = await getOrCreateUser(telegramUserId, username)
		// userData => { balance, username }
		res.json({ balance: userData.balance })
	} catch (err) {
		console.error('Error in /api/getBalance:', err)
		res.status(500).json({ error: 'Internal Server Error' })
	}
})

// 2) Инкрементируем баланс
app.post('/api/incrementBalance', async (req, res) => {
	try {
		const { telegramUserId, username } = req.body
		if (!telegramUserId) {
			return res.status(400).json({ error: 'No Telegram user ID provided' })
		}

		// Сначала getOrCreate — вдруг пользователя нет или username нужно обновить
		const userData = await getOrCreateUser(telegramUserId, username)
		const currentBalance = userData.balance

		// Увеличиваем баланс на 1
		const newBalance = currentBalance + 1
		await updateBalance(telegramUserId, newBalance)

		res.json({ balance: newBalance })
	} catch (err) {
		console.error('Error in /api/incrementBalance:', err)
		res.status(500).json({ error: 'Internal Server Error' })
	}
})

// 3) Лидерборд (топ 100)
app.get('/api/leaderboard', async (req, res) => {
	try {
		const topPlayers = await getTopPlayers(100)
		// topPlayers: [{ telegram_user_id, username, balance }, ...]
		res.json(topPlayers)
	} catch (err) {
		console.error('Error in /api/leaderboard:', err)
		res.status(500).json({ error: 'Internal Server Error' })
	}
})

// Админский маршрут для скачивания БД (как прежде)
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

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`)
})
