const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../muted.json');
const MUTED_ROLE_ID = '1506885606989500417';
const MAX_DISCORD_TIMEOUT = 28 * 24 * 60 * 60 * 1000; // 28 ngày

// ============ ĐỌC/GHI FILE ============
function getMutedData() {
    if (!fs.existsSync(DATA_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function saveMutedData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ============ PARSE DURATION ============
// Chỉ chấp nhận: số + đơn vị (không có chữ khác)
function parseDuration(timeStr) {
    if (!timeStr) return null;
    const regex = /^(\d+)\s*(s|sec|giây|m|min|phút|h|hr|giờ|d|day|ngày|mo|month|tháng|y|yr|year|năm)?$/i;
    const match = timeStr.trim().match(regex);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = (match[2] || 'm').toLowerCase();

    const SECOND = 1000;
    const MINUTE = 60 * SECOND;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;
    const MONTH = 30 * DAY;
    const YEAR = 365 * DAY;

    switch (unit) {
        case 's': case 'sec': case 'giây': return value * SECOND;
        case 'm': case 'min': case 'phút': return value * MINUTE;
        case 'h': case 'hr': case 'giờ': return value * HOUR;
        case 'd': case 'day': case 'ngày': return value * DAY;
        case 'mo': case 'month': case 'tháng': return value * MONTH;
        case 'y': case 'yr': case 'year': case 'năm': return value * YEAR;
        default: return value * MINUTE;
    }
}

// ============ FORMAT DURATION ============
function formatDuration(ms) {
    const SECOND = 1000;
    const MINUTE = 60 * SECOND;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;
    const MONTH = 30 * DAY;
    const YEAR = 365 * DAY;

    const years = Math.floor(ms / YEAR); ms %= YEAR;
    const months = Math.floor(ms / MONTH); ms %= MONTH;
    const days = Math.floor(ms / DAY); ms %= DAY;
    const hours = Math.floor(ms / HOUR); ms %= HOUR;
    const minutes = Math.floor(ms / MINUTE);

    const parts = [];
    if (years > 0) parts.push(`${years} năm`);
    if (months > 0) parts.push(`${months} tháng`);
    if (days > 0) parts.push(`${days} ngày`);
    if (hours > 0) parts.push(`${hours} giờ`);
    if (minutes > 0) parts.push(`${minutes} phút`);

    return parts.length > 0 ? parts.join(' ') : 'vài giây';
}

// ============ TÌM TARGET TỪ STRING ============
// Hỗ trợ: @mention, ID, username, displayName
async function findTarget(guild, input) {
    if (!input) return null;

    // 1. Mention: <@123456>
    const mentionMatch = input.match(/^<@!?(\d+)>$/);
    if (mentionMatch) {
        return await guild.members.fetch(mentionMatch[1]).catch(() => null);
    }

    // 2. ID thuần: 123456
    if (/^\d{17,20}$/.test(input)) {
        return await guild.members.fetch(input).catch(() => null);
    }

    // 3. Username / DisplayName (tìm trong cache)
    const lowerInput = input.toLowerCase();

    // Tìm exact match trước
    let member = guild.members.cache.find(m =>
        m.user.username.toLowerCase() === lowerInput ||
        m.user.tag.toLowerCase() === lowerInput ||
        m.displayName.toLowerCase() === lowerInput
    );
    if (member) return member;

    // Tìm partial match (bắt đầu bằng)
    member = guild.members.cache.find(m =>
        m.user.username.toLowerCase().startsWith(lowerInput) ||
        m.displayName.toLowerCase().startsWith(lowerInput)
    );
    if (member) return member;

    // Nếu không có trong cache, fetch toàn bộ members
    try {
        const members = await guild.members.fetch({ query: input, limit: 5 });
        if (members.size > 0) return members.first();
    } catch {}

    return null;
}

// ============ EXECUTE MUTE (dùng chung cho cả prefix và slash) ============
async function executeMute({ message, interaction, guild, member, botMember, author, target, durationStr, reasonStr, client }) {
    // durationStr và reasonStr là string thô
    let totalDuration = null;
    let reason = '';

    // Nếu durationStr có giá trị → parse
    if (durationStr) {
        totalDuration = parseDuration(durationStr);
    }

    // Nếu reasonStr có giá trị → ghép vào reason
    if (reasonStr) {
        reason = reasonStr.trim();
    }

    // Nếu chưa có duration → default 10 phút
    if (totalDuration === null) {
        totalDuration = 10 * 60 * 1000;
    }

    if (!reason) reason = 'Bố Láo';

    // Check hierarchy
    const isOwner = guild.ownerId === author.id;
    if (!isOwner && member.roles.highest.position <= target.roles.highest.position) {
        return replyError({ message, interaction }, '❌ Bạn không thể mute người có Role bằng hoặc cao hơn bạn!');
    }

    if (!target.moderatable) {
        return replyError({ message, interaction }, '❌ Bot không đủ thẩm quyền để mute người này! (Role của Bot đang đứng THẤP HƠN hoặc BẰNG Role của Target).');
    }

    const currentApplyTime = Math.min(totalDuration, MAX_DISCORD_TIMEOUT);
    const isLongTerm = totalDuration > MAX_DISCORD_TIMEOUT;

    try {
        await target.timeout(currentApplyTime, reason);

        if (botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            await target.roles.add(MUTED_ROLE_ID).catch(err => {
                console.error(`❌ Không thêm được role Muted: ${err.message}`);
            });
        }

        if (isLongTerm) {
            const mutedData = getMutedData();
            const key = `${guild.id}_${target.id}`;
            mutedData[key] = {
                guildId: guild.id,
                userId: target.id,
                unmuteAt: Date.now() + totalDuration,
                reason: reason,
                executorId: author.id
            };
            saveMutedData(mutedData);
        }

        const timeDisplay = formatDuration(totalDuration);

        const embed = new EmbedBuilder()
            .setColor('#00BFFF')
            .setTitle(`<:emoji:1497995905083773048> Đã thành công đeo dọ mõm cho ${target.user.username}`)
            .addFields(
                { name: 'Con Chó', value: `<@${target.id}> (\`${target.id}\`)`, inline: true },
                { name: 'Bố', value: `<@${author.id}>`, inline: true },
                { name: '⏳ Thời gian', value: timeDisplay, inline: true },
                { name: '📝 Lý do', value: reason, inline: false }
            )
            .setTimestamp();

        if (message) await message.channel.send({ embeds: [embed] });
        else if (interaction) await interaction.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Mute Error:', error);
        await replyError({ message, interaction }, '❌ Có lỗi xảy ra khi thực hiện lệnh mute (Hãy kiểm tra lại quyền của Bot).');
    }
}

// ============ EXECUTE UNMUTE ============
async function executeUnmute({ message, interaction, guild, author, target }) {
    try {
        await target.timeout(null);
        await target.roles.remove(MUTED_ROLE_ID).catch(() => {});

        const mutedData = getMutedData();
        const key = `${guild.id}_${target.id}`;
        if (mutedData[key]) {
            delete mutedData[key];
            saveMutedData(mutedData);
        }

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle(`<:emoji:1497995905083773048> Đã tháo dọ mõm cho ${target.user.username}`)
            .addFields(
                { name: 'Con Chó', value: `<@${target.id}> (\`${target.id}\`)`, inline: true },
                { name: 'Bố', value: `<@${author.id}>`, inline: true }
            )
            .setTimestamp();

        if (message) await message.channel.send({ embeds: [embed] });
        else if (interaction) await interaction.reply({ embeds: [embed] });

    } catch (error) {
        await replyError({ message, interaction }, '❌ Có lỗi xảy ra khi thực hiện lệnh unmute.');
    }
}

// ============ REPLY HELPER ============
async function replyError({ message, interaction }, text) {
    if (message) return message.reply(text);
    if (interaction) {
        if (interaction.replied || interaction.deferred) {
            return interaction.followUp({ content: text, ephemeral: true });
        }
        return interaction.reply({ content: text, ephemeral: true });
    }
}

module.exports = {
    MUTED_ROLE_ID,
    MAX_DISCORD_TIMEOUT,
    getMutedData,
    saveMutedData,
    parseDuration,
    formatDuration,
    findTarget,
    executeMute,
    executeUnmute
};