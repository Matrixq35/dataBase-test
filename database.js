// database.js
const sqlite3 = require('sqlite3').verbose()
const path = require('path')

const dbPath = path.join(__dirname, 'trump_game.db')
const db = new sqlite3.Database(dbPath)

db.serialize(() => {
	// Создаём/расширяем таблицу при первом запуске
	// Если таблица уже существует без username, можно сделать ALTER TABLE.
	db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id TEXT UNIQUE,
      balance INTEGER DEFAULT 0,
      username TEXT
    )
  `)
})

/**
 * Получить или создать пользователя:
 * @param {string} telegramUserId  - уникальный ID в Telegram
 * @param {string} username        - ник/имя пользователя из Telegram (может быть "")
 */
function getOrCreateUser(telegramUserId, username = '') {
	return new Promise((resolve, reject) => {
		db.get(
			'SELECT balance, username FROM users WHERE telegram_user_id = ?',
			[telegramUserId],
			(err, row) => {
				if (err) return reject(err)

				if (row) {
					// Запись уже есть
					// Обновим username, если он передан и отличается
					if (username && row.username !== username) {
						db.run(
							'UPDATE users SET username = ? WHERE telegram_user_id = ?',
							[username, telegramUserId],
							updateErr => {
								if (updateErr) return reject(updateErr)
								// Возвращаем обновлённые данные
								resolve({ balance: row.balance, username })
							}
						)
					} else {
						// Не меняем username, возвращаем что есть
						resolve({ balance: row.balance, username: row.username })
					}
				} else {
					// Запись не найдена — создаём
					db.run(
						'INSERT INTO users (telegram_user_id, balance, username) VALUES (?, 0, ?)',
						[telegramUserId, username],
						function (insertErr) {
							if (insertErr) return reject(insertErr)
							// Новая запись: balance=0
							resolve({ balance: 0, username })
						}
					)
				}
			}
		)
	})
}

/**
 * Обновить баланс существующего пользователя
 */
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

/**
 * Получить топ N игроков (по убыванию баланса)
 * Возвращает массив: [{ telegram_user_id, username, balance }, ...]
 */
function getTopPlayers(limit = 100) {
	return new Promise((resolve, reject) => {
		db.all(
			`
        SELECT telegram_user_id, username, balance
        FROM users
        ORDER BY balance DESC
        LIMIT ?
      `,
			[limit],
			(err, rows) => {
				if (err) return reject(err)
				resolve(rows)
			}
		)
	})
}

module.exports = {
	db,
	getOrCreateUser,
	updateBalance,
	getTopPlayers,
}
