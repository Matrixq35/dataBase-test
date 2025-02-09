const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')

// Путь к базе данных (если переменная окружения DATABASE_URL не задана, используется '/data/trump_game.db')
const dbPath = process.env.DATABASE_URL || '/data/trump_game.db'

// Создаём папку для базы данных, если её нет
const dbDir = path.dirname(dbPath)
if (!fs.existsSync(dbDir)) {
	fs.mkdirSync(dbDir, { recursive: true })
	console.log(`✅ Папка для базы данных создана: ${dbDir}`)
}

// Если базы данных нет, создаём пустой файл
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

// Создаём таблицу пользователей с полями для реферальной системы:
// referral_code – уникальный код для приглашения,
// referred_by – telegram_user_id того, кто пригласил пользователя.
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
 * – если такой реферальный код найден, начисляется бонус (3000 токенов) рефереру,
 * – в новом пользователе сохраняется, кто его пригласил (referred_by).
 * Если пользователь уже существует, но поле referral_code пустое (например, старый пользователь),
 * то генерируется новый реферальный код и запись обновляется.
 * Если пользователь уже существует и referral_code присутствует, бонус не начисляется повторно,
 * но если в его записи еще не заполнено referred_by и передан referralCodeInput (не совпадающий с его собственным),
 * то производится обновление и начисление бонуса.
 */
function getOrCreateUser(telegramUserId, username, referralCodeInput) {
	return new Promise((resolve, reject) => {
		db.get(
			'SELECT balance, username, referral_code, referred_by FROM users WHERE telegram_user_id = ?',
			[telegramUserId],
			(err, row) => {
				if (err) return reject(err)

				if (row) {
					console.log('Запись для пользователя найдена:', row)
					// Если у пользователя отсутствует referral_code, обновляем его
					if (!row.referral_code) {
						const newReferralCode = generateReferralCode()
						db.run(
							'UPDATE users SET referral_code = ? WHERE telegram_user_id = ?',
							[newReferralCode, telegramUserId],
							updateErr => {
								if (updateErr) {
									console.error(
										'Ошибка обновления реферального кода:',
										updateErr
									)
									// Если обновление не удалось, возвращаем старую запись (хотя поле пустое)
									return resolve(row)
								}
								row.referral_code = newReferralCode
								console.log(
									'Обновлён реферальный код для существующего пользователя:',
									row
								)
								processReferralUpdate(row)
							}
						)
					} else {
						processReferralUpdate(row)
					}

					// Функция для обработки обновления referred_by, если передан referralCodeInput
					function processReferralUpdate(currentRow) {
						// Проверяем: если передан referralCodeInput, пользователь ещё не привязан и этот код не его собственный
						if (
							referralCodeInput &&
							!currentRow.referred_by &&
							referralCodeInput !== currentRow.referral_code
						) {
							console.log(
								'Попытка установить referred_by для пользователя',
								telegramUserId,
								'с кодом',
								referralCodeInput
							)
							db.get(
								'SELECT telegram_user_id FROM users WHERE referral_code = ?',
								[referralCodeInput],
								(err2, refRow) => {
									if (err2) {
										console.error('Ошибка проверки реферального кода:', err2)
										return resolve(currentRow)
									}
									if (refRow) {
										// Обновляем referred_by и начисляем бонус рефереру
										db.run(
											'UPDATE users SET referred_by = ? WHERE telegram_user_id = ?',
											[refRow.telegram_user_id, telegramUserId],
											err3 => {
												if (err3) {
													console.error('Ошибка обновления referred_by:', err3)
													return resolve(currentRow)
												}
												db.run(
													'UPDATE users SET balance = balance + 3000 WHERE telegram_user_id = ?',
													[refRow.telegram_user_id],
													err4 => {
														if (err4) {
															console.error('Ошибка начисления бонуса:', err4)
														} else {
															console.log(
																`✅ Бонус 3000 токенов начислен пользователю ${refRow.telegram_user_id}`
															)
														}
														currentRow.referred_by = refRow.telegram_user_id
														return resolve(currentRow)
													}
												)
											}
										)
									} else {
										console.log(
											'Переданный реферальный код не найден:',
											referralCodeInput
										)
										return resolve(currentRow)
									}
								}
							)
						} else {
							return resolve(currentRow)
						}
					}
				} else {
					// Новый пользователь: генерируем новый реферальный код
					const newReferralCode = generateReferralCode()
					function createUser(referrerValue = null) {
						db.run(
							'INSERT INTO users (telegram_user_id, balance, username, referral_code, referred_by) VALUES (?, 0, ?, ?, ?)',
							[telegramUserId, username, newReferralCode, referrerValue],
							function (insertErr) {
								if (insertErr) return reject(insertErr)
								const newUser = {
									balance: 0,
									username: username,
									referral_code: newReferralCode,
									referralCode: newReferralCode, // для единообразия
									referredBy: referrerValue,
								}
								console.log('Создан новый пользователь:', newUser)
								resolve(newUser)
							}
						)
					}
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
												createUser(refRow.telegram_user_id)
											}
										)
									} else {
										console.log(
											'Переданный реферальный код для нового пользователя не найден:',
											referralCodeInput
										)
										createUser()
									}
								}
							}
						)
					} else {
						createUser()
					}
				}
			}
		)
	})
}

/**
 * Обновить баланс пользователя.
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
 * Получить топ игроков (по убыванию баланса).
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
 * Выбираются все пользователи, у которых поле referred_by совпадает с telegram_user_id реферера.
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
