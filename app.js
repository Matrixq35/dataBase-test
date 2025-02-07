const express = require('express')
const path = require('path')
const fs = require('fs')
const bodyParser = require('body-parser')
const multer = require('multer')
const { getOrCreateUser, updateBalance, getTopPlayers } = require('./database')

const app = express()
const PORT = process.env.PORT || 3000
const ADMIN_KEY = 'Lesha_Self1'
const dbPath = '/data/trump_game.db'

app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.json())

const upload = multer({ dest: '/tmp/' })

/**
 * Получить баланс пользователя
 */
app.post('/api/getBalance', async (req, res) => {
	try {
		const { telegramUserId, username } = req.body
		if (!telegramUserId)
			return res.status(400).json({ error: '⛔ No Telegram user ID provided' })

		const userData = await getOrCreateUser(telegramUserId, username)
		res.json({ balance: userData.balance, username: userData.username })
	} catch (err) {
		console.error('Ошибка в /api/getBalance:', err)
		res.status(500).json({ error: '❌ Internal Server Error' })
	}
})

/**
 * Инкрементировать баланс
 */
app.post('/api/incrementBalance', async (req, res) => {
	try {
		const { telegramUserId } = req.body
		if (!telegramUserId)
			return res.status(400).json({ error: '⛔ No Telegram user ID provided' })

		const userData = await getOrCreateUser(telegramUserId)
		const newBalance = userData.balance + 1

		await updateBalance(telegramUserId, newBalance)
		res.json({ balance: newBalance })
	} catch (err) {
		console.error('Ошибка в /api/incrementBalance:', err)
		res.status(500).json({ error: '❌ Internal Server Error' })
	}
})

/**
 * Лидерборд (топ 100)
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
 * Скачать базу данных
 */
app.get('/download-db', (req, res) => {
	if (req.query.key !== ADMIN_KEY)
		return res.status(403).send('⛔ Доступ запрещён.')

	if (!fs.existsSync(dbPath))
		return res.status(404).send('❌ База данных не найдена.')

	res.download(dbPath, 'trump_game.db')
})

/**
 * Загрузить новую базу
 */
app.post('/upload-db', upload.single('database'), (req, res) => {
	if (req.query.key !== ADMIN_KEY)
		return res.status(403).send('⛔ Доступ запрещён.')

	if (!req.file) return res.status(400).send('❌ Файл базы не загружен.')

	fs.rename(req.file.path, dbPath, err => {
		if (err) return res.status(500).send('❌ Ошибка загрузки.')
		res.send('✅ База успешно обновлена!')
	})
})

app.listen(PORT, () => {
	console.log(`🚀 Сервер работает на http://localhost:${PORT}`)
})
