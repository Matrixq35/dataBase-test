const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')

// Определяем путь к базе данных
const defaultDbPath = path.join(__dirname, 'database', 'trump_game.db') // Локально
const dbPath = process.env.DB_PATH || defaultDbPath // Используем ENV-переменную, если она есть

// Проверяем, существует ли папка для БД, если её нет — создаём
const dbDir = path.dirname(dbPath)
if (!fs.existsSync(dbDir)) {
	fs.mkdirSync(dbDir, { recursive: true })
}

// Подключение к базе данных
const db = new sqlite3.Database(dbPath, err => {
	if (err) {
		console.error('❌ Ошибка при подключении к базе данных:', err.message)
	} else {
		console.log(`✅ База данных подключена: ${dbPath}`)
	}
})

// Создание таблицы пользователей (если её нет)
db.serialize(() => {
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
 * Получить или создать пользователя
 * @param {string} telegramUserId - Уникальный ID в Telegram
 * @param {string} username - Ник/имя пользователя (может быть пустым)
 */
function getOrCreateUser(telegramUserId, username = '') {
	return new Promise((resolve, reject) => {
		db.get(
			'SELECT balance, username FROM users WHERE telegram_user_id = ?',
			[telegramUserId],
			(err, row) => {
				if (err) return reject(err)

				if (row) {
					// Если username изменился, обновляем
					if (username && row.username !== username) {
						db.run(
							'UPDATE users SET username = ? WHERE telegram_user_id = ?',
							[username, telegramUserId],
							updateErr => {
								if (updateErr) return reject(updateErr)
								resolve({ balance: row.balance, username })
							}
						)
					} else {
						resolve({ balance: row.balance, username: row.username })
					}
				} else {
					// Если пользователя нет, создаём нового
					db.run(
						'INSERT INTO users (telegram_user_id, balance, username) VALUES (?, 0, ?)',
						[telegramUserId, username],
						function (insertErr) {
							if (insertErr) return reject(insertErr)
							resolve({ balance: 0, username })
						}
					)
				}
			}
		)
	})
}

/**
 * Обновить баланс пользователя
 * @param {string} telegramUserId - Уникальный ID в Telegram
 * @param {number} newBalance - Новый баланс
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
 * @param {number} limit - Количество записей (по умолчанию 100)
 * @returns {Promise<Array>} - Массив пользователей [{ telegram_user_id, username, balance }, ...]
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
