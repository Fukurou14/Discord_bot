require('dotenv').config();

module.exports = {
    TOKEN: process.env.TOKEN,
    GUILD_ID: process.env.GUILD_ID,
    DATABASE_CHANNEL_ID: process.env.DATABASE_CHANNEL_ID,
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
    FAST_DATA_CHANNEL_ID: process.env.FAST_DATA_CHANNEL_ID,
    DB_FILE: 'logs.db'
};