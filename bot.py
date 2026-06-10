import asyncio
import logging
import os
import random
import string
from datetime import datetime, timedelta

import aiohttp
from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(storage=MemoryStorage())

HEADERS = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

TARIFFS = {
    "1m": {"name": "1 месяц", "days": 30, "amount": 1490},
    "3m": {"name": "3 месяца", "days": 90, "amount": 3990},
    "12m": {"name": "12 месяцев", "days": 365, "amount": 11990},
}


def gen_key() -> str:
    chars = string.ascii_uppercase + string.digits
    parts = ["".join(random.choices(chars, k=4)) for _ in range(4)]
    return "KP-" + "-".join(parts)


async def sb_select(table: str, filters: str) -> list:
    url = f"{SUPABASE_URL}/rest/v1/{table}?{filters}"
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=HEADERS) as r:
            return await r.json()


@dp.message(Command("start"))
async def cmd_start(msg: Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💳 Тарифы", callback_data="tariffs")],
        [InlineKeyboardButton(text="🔑 Мой ключ", callback_data="mykey")],
        [InlineKeyboardButton(text="❓ Помощь", callback_data="help")],
    ])
    await msg.answer(
        "👋 Добро пожаловать в <b>КП Мастер</b>!\n\n"
        "Сервис для создания коммерческих предложений.\n\n"
        "Выберите действие:",
        reply_markup=kb,
        parse_mode="HTML",
    )


@dp.message(Command("tariffs"))
@dp.callback_query(F.data == "tariffs")
async def cmd_tariffs(event):
    msg = event if isinstance(event, Message) else event.message
    text = (
        "💳 <b>Тарифы КП Мастер</b>\n\n"
        "🗓 <b>1 месяц</b> — 1 490 ₽\n"
        "🗓 <b>3 месяца</b> — 3 990 ₽\n"
        "🗓 <b>12 месяцев</b> — 11 990 ₽\n\n"
        "Для оплаты и получения ключа напишите:\n"
        "@garimuradyan"
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✉️ Написать @garimuradyan", url="https://t.me/garimuradyan")],
        [InlineKeyboardButton(text="◀ Назад", callback_data="back")],
    ])
    await msg.answer(text, reply_markup=kb, parse_mode="HTML")
    if isinstance(event, CallbackQuery):
        await event.answer()


@dp.message(Command("mykey"))
@dp.callback_query(F.data == "mykey")
async def cmd_mykey(event):
    msg = event if isinstance(event, Message) else event.message
    uid = msg.chat.id
    rows = await sb_select(
        "license_keys",
        f"telegram_id=eq.{uid}&is_active=eq.true&order=created_at.desc&limit=1"
    )
    if rows and isinstance(rows, list) and len(rows) > 0:
        k = rows[0]
        expires = k.get("expires_at", "")[:10] if k.get("expires_at") else "—"
        await msg.answer(
            f"🔑 <b>Ваш ключ доступа:</b>\n\n"
            f"<code>{k['key']}</code>\n\n"
            f"📅 Действует до: <b>{expires}</b>\n"
            f"📦 Тариф: <b>{k.get('tariff_name', '—')}</b>",
            parse_mode="HTML",
        )
    else:
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="✉️ Написать @garimuradyan", url="https://t.me/garimuradyan")]
        ])
        await msg.answer(
            "У вас нет активного ключа.\n\n"
            "Для получения доступа напишите администратору:",
            reply_markup=kb
        )
    if isinstance(event, CallbackQuery):
        await event.answer()


@dp.message(Command("help"))
@dp.callback_query(F.data == "help")
async def cmd_help(event):
    msg = event if isinstance(event, Message) else event.message
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✉️ Написать @garimuradyan", url="https://t.me/garimuradyan")],
        [InlineKeyboardButton(text="◀ Назад", callback_data="back")],
    ])
    await msg.answer(
        "❓ <b>Помощь</b>\n\n"
        "По любым вопросам обращайтесь:\n"
        "@garimuradyan\n\n"
        "<b>Команды:</b>\n"
        "/start — главное меню\n"
        "/tariffs — тарифы\n"
        "/mykey — мой ключ\n"
        "/help — помощь",
        reply_markup=kb,
        parse_mode="HTML",
    )
    if isinstance(event, CallbackQuery):
        await event.answer()


@dp.callback_query(F.data == "back")
async def cb_back(cb: CallbackQuery):
    await cmd_start(cb.message)
    await cb.answer()


async def main():
    log.info("Bot started")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
