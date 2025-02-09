const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')

// Путь к базе данных
const dbPath = process.env.DATABASE_URL || '/data/trump_game.db'

// Создаём папку для базы данных, если её нет
const dbDir = path.dirname(dbPath)
if (!fs.existsSync(dbDir)) {
	fs.mkdirSync(dbDir, { recursive: true })
	console.log(`✅ Папка для базы данных создана: ${dbDir}`)
}

// Проверка и создание базы данных, если она не существует
if (!fs.existsSync(dbPath)) {
	console.log('⚠️ База данных не найдена! Создаём пустую базу...')
	fs.writeFileSync(dbPath, '')
}

// Подключение к базе данных
const db = new sqlite3.Database(dbPath, err => {
	if (err) {
		console.error('❌ Ошибка при подключении к БД:', err.message)
		process.exit(1)
	} else {
		console.log(`✅ База данных подключена: ${dbPath}`)
	}
})

// Обновлённая схема таблицы пользователей с полями для реферальной системы
db.serialize(() => {
	db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_user_id TEXT UNIQUE,
            balance INTEGER DEFAULT 0,
            username TEXT,
            referral_code TEXT UNIQUE,
            referred_by TEXT
        )
    `)
})

// Функция для генерации уникального реферального кода
function generateReferralCode() {
	// Генерируем 8-символьную строку на основе случайного числа
	return Math.random().toString(36).substring(2, 10)
}

/**
 * Получить или создать пользователя
 * Если пользователь новый и referralCodeInput указан, проверяем его валидность и начисляем бонус рефереру.
 */
function getOrCreateUser(telegramUserId, username, referralCodeInput) {
	return new Promise((resolve, reject) => {
		db.get(
			'SELECT balance, username, referral_code, referred_by FROM users WHERE telegram_user_id = ?',
			[telegramUserId],
			(err, row) => {
				if (err) return reject(err)

				if (row) {
					// Пользователь уже существует – возвращаем его данные
					resolve({
						balance: row.balance,
						username: row.username,
						referralCode: row.referral_code,
						referredBy: row.referred_by,
					})
				} else {
					// Генерируем уникальный реферальный код для нового пользователя
					const newReferralCode = generateReferralCode()

					// Функция для вставки нового пользователя в БД
					function createUser(referrerValue = null) {
						db.run(
							'INSERT INTO users (telegram_user_id, balance, username, referral_code, referred_by) VALUES (?, 0, ?, ?, ?)',
							[telegramUserId, username, newReferralCode, referrerValue],
							function (insertErr) {
								if (insertErr) return reject(insertErr)
								resolve({
									balance: 0,
									username,
									referralCode: newReferralCode,
									referredBy: referrerValue,
								})
							}
						)
					}

					// Если в запросе передан реферальный код, проверяем его валидность
					if (referralCodeInput) {
						db.get(
							'SELECT telegram_user_id FROM users WHERE referral_code = ?',
							[referralCodeInput],
							(err2, refRow) => {
								if (err2) {
									console.error('Ошибка проверки реферального кода:', err2)
									// Создаём пользователя без привязки к рефералу
									createUser()
								} else {
									if (refRow) {
										// Если найден реферер, обновляем его баланс (+3000 токенов)
										db.run(
											'UPDATE users SET balance = balance + 3000 WHERE telegram_user_id = ?',
											[refRow.telegram_user_id],
											err3 => {
												if (err3) {
													console.error(
														'Ошибка начисления бонуса за реферала:',
														err3
													)
												} else {
													console.log(
														`✅ Бонус 3000 токенов начислен пользователю ${refRow.telegram_user_id}`
													)
												}
												// Создаём пользователя с указанием, что его пригласил найденный реферер
												createUser(refRow.telegram_user_id)
											}
										)
									} else {
										// Если введён неверный реферальный код – создаём пользователя без привязки
										createUser()
									}
								}
							}
						)
					} else {
						// Если реферальный код не передан – создаём пользователя без него
						createUser()
					}
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
