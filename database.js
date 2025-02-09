const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')

// Путь к базе данных (используется /data/trump_game.db, убедитесь, что папка /data смонтирована как persistent volume)
const dbPath = process.env.DATABASE_URL || '/data/trump_game.db'

// Создаём папку для базы данных, если её нет
const dbDir = path.dirname(dbPath)
if (!fs.existsSync(dbDir)) {
	fs.mkdirSync(dbDir, { recursive: true })
	console.log(`✅ Папка для базы данных создана: ${dbDir}`)
}

// Если базы нет, создаём пустой файл
if (!fs.existsSync(dbPath)) {
	console.log('⚠️ База данных не найдена! Создаём пустую базу...')
	fs.writeFileSync(dbPath, '')
}

// Подключаемся к базе данных
const db = new sqlite3.Database(dbPath, err => {
	if (err) {
		console.error('❌ Ошибка при подключении к БД:', err.message)
		process.exit(1)
	} else {
		console.log(`✅ База данных подключена: ${dbPath}`)
	}
})

// Создаём таблицу пользователей с колонками для реферальной системы:
// referral_code — уникальный код пользователя (для приглашения)
// referred_by — telegram_user_id реферера (того, кто пригласил)
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

// Функция для генерации уникального реферального кода (8 символов)
function generateReferralCode() {
	return Math.random().toString(36).substring(2, 10)
}

/**
 * Получить или создать пользователя.
 * Если пользователь новый и передан referralCodeInput, то:
 * - Проверяется наличие пользователя с таким referral_code.
 * - Если найден, начисляется бонус (3000 токенов) рефереру и в новом пользователе сохраняется referred_by.
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

					// Функция для вставки нового пользователя
					function createUser(referrerValue = null) {
						db.run(
							'INSERT INTO users (telegram_user_id, balance, username, referral_code, referred_by) VALUES (?, 0, ?, ?, ?)',
							[telegramUserId, username, newReferralCode, referrerValue],
							function (insertErr) {
								if (insertErr) return reject(insertErr)
								resolve({
									balance: 0,
									username: username,
									referralCode: newReferralCode,
									referredBy: referrerValue,
								})
							}
						)
					}

					// Если передан referralCodeInput, проверяем его
					if (referralCodeInput) {
						db.get(
							'SELECT telegram_user_id FROM users WHERE referral_code = ?',
							[referralCodeInput],
							(err2, refRow) => {
								if (err2) {
									console.error('Ошибка проверки реферального кода:', err2)
									createUser()
								} else {
									if (refRow) {
										// Начисляем бонус 3000 токенов рефереру
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
						// Если referralCodeInput не передан
						createUser()
					}
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
 * Получить топ игроков (по убыванию баланса)
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

/**
 * Получить список рефералов для заданного пользователя.
 * Выбираются пользователи, у которых поле referred_by совпадает с telegram_user_id реферера.
 */
function getReferrals(referrerTelegramId) {
	return new Promise((resolve, reject) => {
		db.all(
			'SELECT telegram_user_id, username, balance FROM users WHERE referred_by = ?',
			[referrerTelegramId],
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
	getReferrals,
}
