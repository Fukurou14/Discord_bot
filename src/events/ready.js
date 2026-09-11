const { Events, REST, Routes, ActivityType } = require('discord.js');
const config = require('../config');
const { cleanOldLogs } = require('../database');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`✅ Bot đã online: ${client.user.tag}`);
        console.log(`📊 Đang ở ${client.guilds.cache.size} server\n`);

        // Đăng ký slash commands
        const commands = [...client.commands.values()].map(c => c.data.toJSON());
        const rest = new REST({ version: '10' }).setToken(config.TOKEN);

        try {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, config.GUILD_ID),
                { body: commands }
            );
            console.log(`✅ Đã đăng ký ${commands.length} slash commands\n`);
        } catch (err) {
            console.error('❌ Lỗi đăng ký commands:', err);
        }

        // Set presence
        client.user.setPresence({
            activities: [{ name: 'tin nhắn bị xóa 👀', type: ActivityType.Watching }],
            status: 'online'
        });

        // Dọn log cũ mỗi 24h (xóa log > 30 ngày)
        setInterval(() => {
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const info = cleanOldLogs.run(thirtyDaysAgo);
            if (info.changes > 0) {
                console.log(`🧹 Đã dọn ${info.changes} log cũ hơn 30 ngày`);
            }
        }, 24 * 60 * 60 * 1000);
    }
};