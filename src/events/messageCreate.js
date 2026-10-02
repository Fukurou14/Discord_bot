const { Events, EmbedBuilder, PermissionsBitField } = require('discord.js');
const config = require('../config');
const { insertMsg, updateFile, updateLogMessageId, getLogById } = require('../database');
const { findTarget, executeMute, executeUnmute, parseDuration } = require('../utils/muteParser');
const { handleWordChain } = require('../utils/wordChainGame');

const EMOJIS = [
    '1495863169338310768',
    '1495863123394166975',
    '1514453224860422204',
    '1529108780074143835',
    '1493842777656528916',
    '1453988462851260528'
];

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
    name: Events.MessageCreate,
    async execute(client, message) {
        if (message.author.bot) return;
        if (!message.guild) return;

        const content = message.content;
        const lower = content.toLowerCase();

        // ============ PRIORITY 1: MUTE/UNMUTE ============
        if (lower.startsWith('e!mute')) {
            return await handlePrefixMute(client, message);
        }

        if (lower.startsWith('e!unmute')) {
            return await handlePrefixUnmute(client, message);
        }

        // ============ PRIORITY 2: WORD CHAIN GAME ============
        const isWordChain = await handleWordChain(client, message, content, lower);
        if (isWordChain) return;

        // ============ CHẶN LOOP ============
        if (message.channel.id === config.DATABASE_CHANNEL_ID) return;
        if (message.channel.id === config.LOG_CHANNEL_ID) return;
        if (message.channel.id === config.FAST_DATA_CHANNEL_ID) return;

        // ============ REACT EMOJI ============
        if (message.mentions.has(client.user) && !message.mentions.everyone) {
            const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
            try { await message.react(randomEmoji); } catch {}
        }

        if (!content && message.attachments.size === 0) return;

        // ============ INSERT DB ============
        try {
            insertMsg.run(
                message.id,
                message.author.id,
                message.author.tag,
                message.channel.id,
                content || '',
                null,
                null,
                Date.now()
            );
        } catch (err) {
            console.error('❌ Lỗi insert sớm:', err.message);
        }

        // ============ FORWARD FILE ============
        if (message.attachments.size > 0) {
            try {
                const dbChannel = await client.channels
                    .fetch(config.DATABASE_CHANNEL_ID)
                    .catch(() => null);
                if (!dbChannel) {
                    console.error('❌ Không tìm thấy kênh Database');
                    return;
                }

                const fastChannel = await client.channels
                    .fetch(config.FAST_DATA_CHANNEL_ID)
                    .catch(() => null);
                if (!fastChannel) {
                    console.error('❌ Không tìm thấy kênh Fast Data');
                    return;
                }

                const dbForwardedMsg = await message.forward(dbChannel);
                console.log(`✅ Forward gốc → DB: ${dbForwardedMsg.id}`);

                const fdForwardedMsg = await dbForwardedMsg.forward(fastChannel);
                console.log(`✅ Forward DB → Fast Data: ${fdForwardedMsg.id}`);

                const dbMessageId = fdForwardedMsg.id;

                updateFile.run(null, dbMessageId, message.id);

                let updatedLog = getLogById.get(message.id);

                if (updatedLog?.is_deleted === 1 && !updatedLog.log_message_id) {
                    console.log(`⏳ Chờ 1s để messageDelete lưu log_message_id...`);
                    await new Promise(r => setTimeout(r, 1000));
                    updatedLog = getLogById.get(message.id);
                }

                if (updatedLog?.is_deleted === 1 && updatedLog.log_message_id) {
                    console.log(`🔄 Cập nhật log: xóa placeholder + forward + embed reply`);
                    try {
                        const logChannel = await client.channels
                            .fetch(config.LOG_CHANNEL_ID)
                            .catch(() => null);
                        if (!logChannel) return;

                        const placeholderMsg = await logChannel.messages
                            .fetch(updatedLog.log_message_id)
                            .catch(() => null);
                        if (placeholderMsg) {
                            await placeholderMsg.delete().catch(() => {});
                            console.log(`🗑️ Đã xóa placeholder`);
                        }

                        const logForwardedMsg = await fdForwardedMsg.forward(logChannel);
                        console.log(`✅ Đã forward file vào log`);

                        const metaEmbed = buildMetaEmbed(updatedLog, client);
                        try {
                            const embedMsg = await logChannel.send({
                                embeds: [metaEmbed],
                                reply: {
                                    messageReference: logForwardedMsg.id,
                                    failIfNotExists: false
                                }
                            });
                            updateLogMessageId.run(embedMsg.id, message.id);
                            console.log(`✅ Đã gửi embed reply`);
                        } catch (err) {
                            console.error(`❌ Lỗi reply embed: ${err.message}`);
                            const fallbackMsg = await logChannel.send({ embeds: [metaEmbed] });
                            updateLogMessageId.run(fallbackMsg.id, message.id);
                        }
                    } catch (err) {
                        console.error(`❌ Lỗi cập nhật log: ${err.message}`);
                    }
                }
            } catch (err) {
                console.error('❌ Lỗi cache DB:', err.message);
            }
        }
    }
};

// ==================================================================
// ============ MUTE HANDLERS =======================================
// ==================================================================
async function handlePrefixMute(client, message) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply('❌ Bạn không có quyền Quản Lý Thành Viên để dùng lệnh này!');
    }

    const botMember = message.guild.members.me;
    if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply('❌ Bot chưa được cấp quyền Moderate Members (Timeout) trong Server!');
    }

    const rawContent = message.content.slice('e!mute'.length).trim();
    if (!rawContent) {
        return message.reply('⚠️ Bạn chưa chỉ định người cần mute!\n👉 Cú pháp: `e!mute @user [thời gian] [lý do]`');
    }

    let args = rawContent.includes('/')
        ? rawContent.split('/').map(a => a.trim()).filter(Boolean)
        : rawContent.split(/\s+/).filter(Boolean);

    const targetArg = args.shift();
    const target = await findTarget(message.guild, targetArg);
    if (!target) {
        return message.reply(`⚠️ Không tìm thấy user: \`${targetArg}\``);
    }

    if (target.id === message.author.id) return message.reply('❌ Bạn không thể tự mute chính mình!');
    if (target.id === client.user.id) return message.reply('❌ Bạn không thể mute Bot!');

    let durationStr = null;
    let reasonParts = [];

    for (const arg of args) {
        const parsed = parseDuration(arg);
        if (parsed !== null && durationStr === null) {
            durationStr = arg;
        } else {
            reasonParts.push(arg);
        }
    }

    const reasonStr = reasonParts.join(' ').trim();

    await executeMute({
        message,
        guild: message.guild,
        member: message.member,
        botMember,
        author: message.author,
        target,
        durationStr,
        reasonStr,
        client
    });
}

async function handlePrefixUnmute(client, message) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply('❌ Bạn không có quyền Quản Lý Thành Viên để dùng lệnh này!');
    }

    const rawContent = message.content.slice('e!unmute'.length).trim();
    if (!rawContent) {
        return message.reply('⚠️ Bạn chưa chỉ định người cần tháo dọ mõm!\n👉 Cú pháp: `e!unmute @user`');
    }

    const targetArg = rawContent.split(/\s+/)[0];
    const target = await findTarget(message.guild, targetArg);
    if (!target) {
        return message.reply(`⚠️ Không tìm thấy user: \`${targetArg}\``);
    }

    await executeUnmute({
        message,
        guild: message.guild,
        author: message.author,
        target
    });
}
