const { EmbedBuilder } = require('discord.js');

// ============ CẤU HÌNH ============
const THEME = {
    COLOR_DELETED: 0xED4245,      // Đỏ - tin nhắn bị xóa
    COLOR_EDITED: 0xFEE75C,       // Vàng - tin nhắn sửa
    COLOR_ALIVE: 0x57F287,        // Xanh lá - dùng cho kênh DB
    COLOR_INFO: 0x5865F2,         // Xanh Discord
    FOOTER_TEXT: 'Log System',
};

// ============ HÀM HỖ TRỢ ============
function getUserDisplayName(log, client) {
    const user = client.users.cache.get(log.author_id);
    if (user) return user.tag;
    if (log.author_tag) return log.author_tag;
    return `Unknown (${log.author_id})`;
}

function getUserAvatar(log, client) {
    const user = client.users.cache.get(log.author_id);
    return user?.displayAvatarURL({ dynamic: true, size: 128 }) || null;
}

// ============ EMBED LOG KHI TIN NHẮN BỊ XÓA ============
function createDeletedLogEmbed(log, client) {
    const authorName = getUserDisplayName(log, client);
    const authorAvatar = getUserAvatar(log, client);

    const description = log.content
        ? `**Message deleted in** <#${log.channel_id}>\n\n${log.content.slice(0, 1900)}`
        : `**Message deleted in** <#${log.channel_id}>\n\n*[Không có văn bản]*`;

    const embed = new EmbedBuilder()
        .setColor(THEME.COLOR_DELETED)
        .setAuthor({
            name: authorName,
            iconURL: authorAvatar || undefined
        })
        .setDescription(description)
        .setFooter({
            text: `Message ID: ${log.message_id} • User ID: ${log.author_id} • ${new Date(log.created_at).toLocaleString('vi-VN')}`
        });

    if (log.image_url) embed.setImage(log.image_url);
    return embed;
}

// ============ EMBED LOG KHI TIN NHẮN BỊ SỬA ============
function createEditedLogEmbed(log, oldContent, client) {
    const authorName = getUserDisplayName(log, client);
    const authorAvatar = getUserAvatar(log, client);

    const embed = new EmbedBuilder()
        .setColor(THEME.COLOR_EDITED)
        .setAuthor({
            name: authorName,
            iconURL: authorAvatar || undefined
        })
        .setTitle('✏️ Tin nhắn đã chỉnh sửa')
        .addFields(
            {
                name: 'Tác giả',
                value: `<@${log.author_id}> ( \`${log.author_id}\` )`,
                inline: true
            },
            {
                name: 'Kênh',
                value: `<#${log.channel_id}>`,
                inline: true
            },
            {
                name: 'Trước',
                value: oldContent ? oldContent.slice(0, 1020) : '*[Trống]*',
                inline: false
            },
            {
                name: 'Sau',
                value: log.content ? log.content.slice(0, 1020) : '*[Trống]*',
                inline: false
            }
        )
        .setFooter({
            text: `${new Date().toLocaleString('vi-VN')}`
        });

    return embed;
}

// ============ EMBED /log deleted ============
function createQueryDeletedEmbed(log, client, index = null) {
    const authorName = getUserDisplayName(log, client);
    const authorAvatar = getUserAvatar(log, client);

    const description = log.content
        ? `**Message deleted in** <#${log.channel_id}>\n\n${log.content.slice(0, 1900)}`
        : `**Message deleted in** <#${log.channel_id}>\n\n*[Không có văn bản]*`;

    const embed = new EmbedBuilder()
        .setColor(THEME.COLOR_DELETED)
        .setAuthor({
            name: authorName,
            iconURL: authorAvatar || undefined
        })
        .setDescription(description)
        .setFooter({
            text: `Message ID: ${log.message_id} • User ID: ${log.author_id} • ${new Date(log.deleted_at).toLocaleString('vi-VN')}`
        });

    if (index !== null) embed.setTitle(`🗑️ Log #${index + 1}`);
    if (log.image_url) embed.setImage(log.image_url);

    return embed;
}

// ============ EMBED /log user ============
function createQueryUserEmbed(log, client, index = null) {
    const authorName = getUserDisplayName(log, client);
    const authorAvatar = getUserAvatar(log, client);
    const isDeleted = log.is_deleted === 1;

    const embed = new EmbedBuilder()
        .setColor(isDeleted ? THEME.COLOR_DELETED : THEME.COLOR_ALIVE)
        .setAuthor({
            name: authorName,
            iconURL: authorAvatar || undefined
        })
        .setDescription(
            log.content
                ? log.content.slice(0, 2000)
                : '*[Không có văn bản]*'
        )
        .addFields(
            { name: 'Kênh', value: `<#${log.channel_id}>`, inline: true },
            { name: 'Trạng thái', value: isDeleted ? '🗑️ Đã xóa' : '✅ Còn', inline: true },
            { name: 'Gửi lúc', value: `<t:${Math.floor(log.created_at / 1000)}:R>`, inline: true }
        )
        .setFooter({
            text: `Message ID: ${log.message_id} • User ID: ${log.author_id}`
        });

    if (index !== null) embed.setTitle(`📄 Log #${index + 1}`);
    if (log.image_url) embed.setImage(log.image_url);

    return embed;
}

// ============ EMBED /log id ============
function createQueryIdEmbed(log, client) {
    const authorName = getUserDisplayName(log, client);
    const authorAvatar = getUserAvatar(log, client);
    const isDeleted = log.is_deleted === 1;

    const embed = new EmbedBuilder()
        .setColor(isDeleted ? THEME.COLOR_DELETED : THEME.COLOR_ALIVE)
        .setAuthor({
            name: authorName,
            iconURL: authorAvatar || undefined
        })
        .setTitle('📋 Chi tiết tin nhắn')
        .setDescription(
            log.content
                ? log.content.slice(0, 2000)
                : '*[Không có văn bản]*'
        )
        .addFields(
            { name: 'Tác giả', value: `<@${log.author_id}> ( \`${log.author_id}\` )`, inline: false },
            { name: 'Kênh', value: `<#${log.channel_id}>`, inline: true },
            { name: 'Trạng thái', value: isDeleted ? '🗑️ Đã xóa' : '✅ Còn', inline: true },
            { name: 'Gửi lúc', value: `<t:${Math.floor(log.created_at / 1000)}:F>`, inline: false }
        )
        .setFooter({
            text: `Message ID: ${log.message_id} • User ID: ${log.author_id}`
        });

    if (isDeleted && log.deleted_at) {
        embed.addFields({
            name: 'Xóa lúc',
            value: `<t:${Math.floor(log.deleted_at / 1000)}:F>`,
            inline: false
        });
    }

    if (log.image_url) embed.setImage(log.image_url);

    return embed;
}

// ============ EMBED TRONG KÊNH DATABASE ============
function createDatabaseCacheEmbed(message, client, cachedImageUrl = null) {
    const authorName = message.author.tag;
    const authorAvatar = message.author.displayAvatarURL({ dynamic: true, size: 128 });

    const contentDisplay = message.content
        ? message.content.slice(0, 1900)
        : '*[Chỉ chứa tập đính kèm]*';

    const description = `**Message sent in** <#${message.channel.id}>\n\n${contentDisplay}`;

    const embed = new EmbedBuilder()
        .setColor(THEME.COLOR_ALIVE)
        .setAuthor({
            name: authorName,
            iconURL: authorAvatar
        })
        .setDescription(description)
        .setFooter({
            text: `Original Msg ID: ${message.id} • User ID: ${message.author.id} • ${new Date(message.createdTimestamp).toLocaleString('vi-VN')}`
        });

    if (cachedImageUrl) embed.setImage(cachedImageUrl);

    return embed;
}

module.exports = {
    THEME,
    createDeletedLogEmbed,
    createEditedLogEmbed,
    createQueryDeletedEmbed,
    createQueryUserEmbed,
    createQueryIdEmbed,
    createDatabaseCacheEmbed
};