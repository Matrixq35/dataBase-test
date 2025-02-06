// database.js
const sqlite3 = require('sqlite3').verbose()
const path = require('path')

const dbPath = path.join(__dirname, 'trump_game.db')
const db = new sqlite3.Database(dbPath)

db.serialize(() => {
	// Создаём таблицу (при первом запуске),
	// без поля progress.
	db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id TEXT UNIQUE,
      balance INTEGER DEFAULT 0
    )
  `)
})

// Получить баланс или создать запись, если нет
function getOrCreateUser(telegramUserId) {
	return new Promise((resolve, reject) => {
		db.get(
			'SELECT balance FROM users WHERE telegram_user_id = ?',
			[telegramUserId],
			(err, row) => {
				if (err) return reject(err)

				if (row) {
					// Запись уже есть
					resolve(row) // { balance: ... }
				} else {
					// Создаём новую запись
					db.run(
						'INSERT INTO users (telegram_user_id, balance) VALUES (?, 0)',
						[telegramUserId],
						function (insertErr) {
							if (insertErr) return reject(insertErr)
							// Вернём баланс 0 для вновь созданного пользователя
							resolve({ balance: 0 })
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

// Экспортируем то, что нужно
module.exports = {
	db, // Если вам понадобится выполнять свои SQL-запросы вручную
	getOrCreateUser,
	updateBalance,
}
