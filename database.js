const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')

// Используем переменную окружения DATA_FOLDER, если она задана
const dataDir = process.env.DATA_FOLDER || path.join(__dirname, 'data')

// Создаём каталог для базы данных, если его нет
if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir, { recursive: true })
}

// Путь к базе данных
const dbPath = path.join(dataDir, 'trump_game.db')

// Проверяем наличие базы данных
if (!fs.existsSync(dbPath)) {
	console.log('⚠️ База данных не найдена. Создаём новую...')
}

// Подключаемся к базе данных
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

// Экспортируем функции для работы с базой данных
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

function getTopPlayers(limit = 100) {
	return new Promise((resolve, reject) => {
		db.all(
			'SELECT telegram_user_id, username, balance FROM users ORDER BY balance DESC LIMIT ?',
			[limit],
			(err, rows) => {
				if (err) return reject(err)
				resolve(rows)
			}
		)
	})
}

module.exports = { db, getOrCreateUser, updateBalance, getTopPlayers }
