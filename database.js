// database.js
const sqlite3 = require('sqlite3').verbose()
const path = require('path')

const dbPath = path.join(__dirname, 'trump_game.db')
const db = new sqlite3.Database(dbPath)

db.serialize(() => {
	// Создаём таблицу при первом запуске
	db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id TEXT UNIQUE,
      balance INTEGER DEFAULT 0,
      progress INTEGER DEFAULT 0
    )
  `)
})

// Получить баланс (и progress), или создать запись, если нет
function getOrCreateUser(telegramUserId) {
	return new Promise((resolve, reject) => {
		db.get(
			'SELECT balance, progress FROM users WHERE telegram_user_id = ?',
			[telegramUserId],
			(err, row) => {
				if (err) return reject(err)

				if (row) {
					// Запись есть
					resolve(row) // объект { balance: ..., progress: ... }
				} else {
					// Создаём запись
					db.run(
						`INSERT INTO users (telegram_user_id, balance, progress) VALUES (?, 0, 0)`,
						[telegramUserId],
						function (insertErr) {
							if (insertErr) return reject(insertErr)
							resolve({ balance: 0, progress: 0 })
						}
					)
				}
			}
		)
	})
}

// Обновить баланс
function updateBalance(telegramUserId, newBalance) {
	return new Promise((resolve, reject) => {
		db.run(
			'UPDATE users SET balance = ? WHERE telegram_user_id = ?',
			[newBalance, telegramUserId],
			function (err) {
				if (err) return reject(err)
				resolve()
			}
		)
	})
}

// Обновить прогресс
function updateProgress(telegramUserId, newProgress) {
	return new Promise((resolve, reject) => {
		db.run(
			'UPDATE users SET progress = ? WHERE telegram_user_id = ?',
			[newProgress, telegramUserId],
			function (err) {
				if (err) return reject(err)
				resolve()
			}
		)
	})
}

module.exports = {
	db, // Если понадобится выполнять свои запросы
	getOrCreateUser,
	updateBalance,
	updateProgress,
}
