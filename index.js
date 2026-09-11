const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const config = require('./src/config');
const { loadEvents } = require('./src/handlers/eventHandler');
const { loadCommands } = require('./src/handlers/commandHandler');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

// Collection để lưu commands (dùng cho handler)
client.commands = new Collection();

// Load events và commands
loadEvents(client);
loadCommands(client);

// Login
client.login(config.TOKEN).catch(err => {
    console.error('❌ Không thể đăng nhập:', err);
    process.exit(1);
});

// Bắt lỗi để bot không bị crash
process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));