const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config');
const { markDeleted, getLogById, getIgnoredChannel, updateLogMessageId } = require('../database');

// ============ HELPER ============
function getAuthorDisplay(log, client) {
    const user = client.users.cache.get(log.author_id);
    if (user) return user.tag;
    if (log.author_tag) return log.author_tag;
    return 'Unknown User';
}

function getAuthorAvatar(log, client) {
    const user = client.users.cache.get(log.author_id);
    return user?.displayAvatarURL({ dynamic: true, size: 128 }) || null;
}

// ============ BUILD EMBED ============
function buildMetaEmbed(log, client) {
    const authorName = getAuthorDisplay(log, client);
    const authorAvatar = getAuthorAvatar(log, client);

    return new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🗑️ Tin nhắn bị xóa')
        .setAuthor({
            name: authorName,
            iconURL: authorAvatar || undefined
        })
        .setDescription(
            log.content
                ? log.content.slice(0, 4000)
                : '*[Chỉ chứa tập đính kèm — xem tin forward bên trên]*'
        )
        .addFields(
            { name: '👤 Tác giả', value: `\`${authorName}\` (\`${log.author_id}\`)`, inline: true },
            { name: '📍 Kênh', value: `<#${log.channel_id}>`, inline: true },
            { name: '🕐 Gửi lúc', value: `<t:${Math.floor(log.created_at / 1000)}:F>`, inline: false },
            { name: '🗑️ Xóa lúc', value: `<t:${Math.floor(log.deleted_at / 1000)}:F>`, inline: false }
        )
        .setFooter({ text: `Message ID: ${log.message_id}` })
        .setTimestamp(log.deleted_at || Date.now());
}

module.exports = {
    name: Events.MessageDelete,
    async execute(client, message) {
        if (message.author?.bot) return;
        if (!message.guild) return;
        if (message.channel.id === config.DATABASE_CHANNEL_ID) return;
        if (message.channel.id === config.LOG_CHANNEL_ID) return;
        if (message.channel.id === config.FAST_DATA_CHANNEL_ID) return;

        const info = markDeleted.run(Date.now(), message.id);
        if (info.changes === 0) return;

        const ignored = getIgnoredChannel.get(message.channel.id);
        if (ignored) return;

        const log = getLogById.get(message.id);
        if (!log) return;

        try {
            const logChannel = await client.channels
                .fetch(config.LOG_CHANNEL_ID)
                .catch(() => null);
            if (!logChannel) return;

            // ============ CÓ FILE ĐÃ CACHE → FORWARD + EMBED REPLY ============
            if (log.db_message_id) {
                const fastChannel = await client.channels
                    .fetch(config.FAST_DATA_CHANNEL_ID)
                    .catch(() => null);

                if (fastChannel) {
                    const fdMsg = await fastChannel.messages
                        .fetch(log.db_message_id)
                        .catch(() => null);

                    if (fdMsg) {
                        // BƯỚC 1: FORWARD tin Fast Data → log
                        const forwardedMsg = await fdMsg.forward(logChannel);
                        console.log(`✅ Đã forward file từ Fast Data`);

                        // BƯỚC 2: Gửi EMBED reply vào forward
                        const metaEmbed = buildMetaEmbed(log, client);
                        try {
                            const embedMsg = await logChannel.send({
                                embeds: [metaEmbed],
                                reply: {
                                    messageReference: forwardedMsg.id,
                                    failIfNotExists: false
                                }
                            });
                            updateLogMessageId.run(embedMsg.id, log.message_id);
                            console.log(`✅ Đã gửi embed reply vào forward`);
                        } catch (err) {
                            console.error(`❌ Lỗi reply embed: ${err.message}`);
                            // Fallback: gửi embed không reply
                            const fallbackMsg = await logChannel.send({ embeds: [metaEmbed] });
                            updateLogMessageId.run(fallbackMsg.id, log.message_id);
                        }
                        return;
                    }
                }
            }

            // ============ CHƯA CACHE → PLACEHOLDER ============
            if (message.attachments.size > 0) {
                const authorName = getAuthorDisplay(log, client);
                const placeholderText = `⏳ **Đang cập nhật ảnh/file...** (tin nhắn bị xóa quá nhanh)\n👤 Tác giả: \`${authorName}\`\n🆔 Msg ID: \`${log.message_id}\``;
                const sentMsg = await logChannel.send({ content: placeholderText });
                updateLogMessageId.run(sentMsg.id, log.message_id);
                console.log(`⏳ Placeholder cho msg ${log.message_id}`);
                return;
            }

            // ============ KHÔNG FILE → EMBED BÌNH THƯỜNG ============
            const metaEmbed = buildMetaEmbed(log, client);
            const sentMsg = await logChannel.send({ embeds: [metaEmbed] });
            updateLogMessageId.run(sentMsg.id, log.message_id);
            console.log(`✅ Log embed cho msg ${log.message_id}`);

        } catch (err) {
            console.error('❌ Lỗi gửi log delete:', err.message);
        }
    }
};