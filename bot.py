import logging
from telegram import Update, KeyboardButton, ReplyKeyboardMarkup, WebAppInfo
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes
)

BOT_TOKEN = "7622808496:AAHg0lQ7-1lOFkkjTN8Y_yfzhRROdEj9SNA"  # Токен, выданный BotFather
WEBAPP_URL = "https://database-test-production.up.railway.app/"  # HTTPS-ссылка на ваше приложение

# Включаем логгирование (не обязательно, но полезно)
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# Обработчик команды /start
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id

    # Создаём кнопку для WebApp
    inline_markup = InlineKeyboardMarkup([
    [InlineKeyboardButton(text="Открыть игру", web_app=WebAppInfo(url='https://database-test-production.up.railway.app/'))]
])
    # Reply-клавиатура (обычная)
    reply_markup = ReplyKeyboardMarkup([[webapp_button]], resize_keyboard=True)

    await context.bot.send_message(
        chat_id=chat_id,
        text="Привет! Нажми на кнопку, чтобы открыть игру:",
        reply_markup=reply_markup
    )

# Простейший обработчик обычных сообщений
async def echo_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    user_text = update.message.text
    await context.bot.send_message(chat_id=chat_id, text=f"Вы сказали: {user_text}")


def main() -> None:
    """Функция инициализирует и запускает бота в режиме polling."""
    # 1. Создаём приложение (бота)
    app = Application.builder().token(BOT_TOKEN).build()

    # 2. Регистрируем хендлеры
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, echo_message))

    # 3. Запускаем бота (polling)
    logging.info("Bot is starting with polling...")
    app.run_polling()  # НЕ вызываем asyncio.run()

if __name__ == "__main__":
    main()
