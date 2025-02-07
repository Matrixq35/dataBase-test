const express = require('express')
const path = require('path')
const fs = require('fs')
const bodyParser = require('body-parser')
const multer = require('multer')
const { getOrCreateUser, updateBalance, getTopPlayers } = require('./database')

const app = express()
const PORT = process.env.PORT || 3000
const ADMIN_KEY = '2019,Dog'

// Определяем каталог для базы данных
const dataDir = path.join(__dirname, 'data')
if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir, { recursive: true })
}
const dbPath = path.join(dataDir, 'trump_game.db')

// Если ваши статики (например, index.html, css, js) лежат в папке public, оставляем так:
app.use(express.static(path.join(__dirname, 'public')))

// Если index.html лежит в корне проекта, можно добавить:
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'index.html'));
// });

app.use(bodyParser.json())

// Для загрузки файлов можно указать временную папку (можно использовать системную папку или создать свою)
const upload = multer({ dest: path.join(__dirname, 'tmp') })

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
		const { telegramUserId, username } = req.body
		if (!telegramUserId)
			return res.status(400).json({ error: '⛔ No Telegram user ID provided' })

		// Передаём username, чтобы обновлять его при изменении
		const userData = await getOrCreateUser(telegramUserId, username)
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
