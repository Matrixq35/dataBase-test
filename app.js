// app.js
const express = require('express')
const path = require('path')
const fs = require('fs')
const bodyParser = require('body-parser')
const { getOrCreateUser, updateBalance, updateProgress } = require('./database')

const app = express()
const PORT = process.env.PORT || 3000

/**
 * Считываем секретный ключ из ENV:
 * Например, process.env.ADMIN_KEY.
 * Если не задан - подставим "NO_KEY" или пустую строку.
 */
const ADMIN_KEY = process.env.ADMIN_KEY || 'NO_KEY'

app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.json())

// ----- Ваши API-роуты (getUserData, incrementBalance, updateProgress) -----

// Админский маршрут для скачивания базы
app.get('/download-db', (req, res) => {
	const adminKey = req.query.key // ключ из query ?key=...

	// Сравниваем с переменной окружения
	if (adminKey !== ADMIN_KEY) {
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
