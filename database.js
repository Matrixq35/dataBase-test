const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')

const dbPath = '/data/trump_game.db'

// Проверяем, есть ли база
if (!fs.existsSync(dbPath)) {
	console.log('⚠️ База данных не найдена. Создаём новую...')
}

// Подключаемся к БД
const db = new sqlite3.Database(dbPath, err => {
	if (err) {
		console.error('❌ Ошибка при подключении к БД:', err.message)
	} else {
		console.log(`✅ База данных подключена: ${dbPath}`)
	}
})

// Создаём таблицу, если её нет
db.serialize(() => {
	db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_user_id TEXT UNIQUE,
            balance INTEGER DEFAULT 0,
            username TEXT DEFAULT 'Аноним'
        )
    `)
})

/**
 * Получить или создать пользователя
 */
function getOrCreateUser(telegramUserId, username = 'Аноним') {
	return new Promise((resolve, reject) => {
		db.get(
			'SELECT balance, username FROM users WHERE telegram_user_id = ?',
			[telegramUserId],
			(err, row) => {
				if (err) return reject(err)

				if (row) {
					// Обновляем username, если изменился
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
 * Получить топ 100 игроков
 */
function getTopPlayers(limit = 100) {
	return new Promise((resolve, reject) => {
		db.all(
			'SELECT username, balance FROM users ORDER BY balance DESC LIMIT ?',
			[limit],
			(err, rows) => {
				if (err) return reject(err)
				resolve(rows)
			}
		)
	})
}

module.exports = { db, getOrCreateUser, updateBalance, getTopPlayers }
