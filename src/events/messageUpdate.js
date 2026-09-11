const { Events } = require('discord.js');
const config = require('../config');
const { getLogById, updateContent, getIgnoredChannel } = require('../database');
const { createEditedLogEmbed } = require('../utils/embeds');

module.exports = {
    name: Events.MessageUpdate,
    async execute(client, oldMessage, newMessage) {
        if (newMessage.author?.bot) return;
        if (!newMessage.guild) return;
        if (newMessage.channel.id === config.DATABASE_CHANNEL_ID) return;
        if (oldMessage.content === newMessage.content) return;

        let oldContent = oldMessage.content;
        if (oldContent === null) {
            try {
                const fetched = await oldMessage.fetch();
                oldContent = fetched.content;
            } catch {
                oldContent = '*[Không lấy được nội dung cũ]*';
            }
        }

        const log = getLogById.get(newMessage.id);
        if (!log) return;

        // Cập nhật nội dung mới vào DB
        try {
            updateContent.run(newMessage.content || '', newMessage.id);
        } catch (err) {
            console.error('❌ Lỗi update DB:', err.message);
        }

        // Kiểm tra kênh có bị ignore không
        const ignored = getIgnoredChannel.get(newMessage.channel.id);
        if (ignored) return; // Có trong blacklist -> không gửi log

        try {
            const logChannel = await client.channels
                .fetch(config.LOG_CHANNEL_ID)
                .catch(() => null);
            if (!logChannel) return;

            const logData = { ...log, content: newMessage.content || '' };
            const embed = createEditedLogEmbed(logData, oldContent, client);
            await logChannel.send({ embeds: [embed] });
        } catch (err) {
            console.error('❌ Lỗi gửi log edit:', err.message);
        }
    }
};