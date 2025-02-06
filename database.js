// database.js
const sqlite3 = require('sqlite3').verbose()
const path = require('path')

// Создаём или открываем файл БД
const dbPath = path.join(__dirname, 'trump_game.db')
const db = new sqlite3.Database(dbPath)

// Инициализация таблицы для хранения балансов
db.serialize(() => {
	db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id TEXT UNIQUE,
      balance INTEGER DEFAULT 0
    )
  `)
})

// Функция для получения баланса (или создания записи, если её нет)
function getOrCreateUserBalance(telegramUserId) {
	return new Promise((resolve, reject) => {
		db.get(
			'SELECT balance FROM users WHERE telegram_user_id = ?',
			[telegramUserId],
			(err, row) => {
				if (err) return reject(err)

				if (row) {
					// Запись есть, возвращаем баланс
					return resolve(row.balance)
				} else {
					// Создаём запись с балансом 0
					db.run(
						'INSERT INTO users (telegram_user_id, balance) VALUES (?, 0)',
						[telegramUserId],
						function (insertErr) {
							if (insertErr) return reject(insertErr)
							return resolve(0)
						}
					)
				}
			}
		)
	})
}

// Функция для обновления баланса
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

module.exports = {
	getOrCreateUserBalance,
	updateBalance,
}
