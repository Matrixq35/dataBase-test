// app.js
const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')
const { getOrCreateUserBalance, updateBalance } = require('./database')

const app = express()
const PORT = process.env.PORT || 3000

// Чтобы Express мог раздавать статику из папки public
app.use(express.static(path.join(__dirname, 'public')))

// Поддержка JSON в body
app.use(bodyParser.json())

// Маршрут для получения текущего баланса
app.post('/api/getBalance', async (req, res) => {
	try {
		const { telegramUserId } = req.body
		if (!telegramUserId) {
			return res.status(400).json({ error: 'No Telegram user ID provided' })
		}
		const balance = await getOrCreateUserBalance(telegramUserId)
		res.json({ balance })
	} catch (err) {
		console.error('Error in /api/getBalance:', err)
		res.status(500).json({ error: 'Internal Server Error' })
	}
})

// Маршрут для инкремента
app.post('/api/incrementBalance', async (req, res) => {
	try {
		const { telegramUserId } = req.body
		if (!telegramUserId) {
			return res.status(400).json({ error: 'No Telegram user ID provided' })
		}
		// Получаем текущий баланс или создаём пользователя
		let balance = await getOrCreateUserBalance(telegramUserId)
		// Инкрементируем
		balance += 1
		// Сохраняем в БД
		await updateBalance(telegramUserId, balance)
		// Возвращаем новый баланс
		res.json({ balance })
	} catch (err) {
		console.error('Error in /api/incrementBalance:', err)
		res.status(500).json({ error: 'Internal Server Error' })
	}
})

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`)
})
