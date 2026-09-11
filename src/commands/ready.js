// ============ AUTO-UNMUTE (>28 ngày) ============
const { getMutedData, saveMutedData, MAX_DISCORD_TIMEOUT, MUTED_ROLE_ID } = require('../utils/muteParser');

setInterval(async () => {
    const mutedData = getMutedData();
    const now = Date.now();
    let changed = false;

    for (const [key, data] of Object.entries(mutedData)) {
        const remaining = data.unmuteAt - now;

        try {
            const guild = client.guilds.cache.get(data.guildId);
            if (!guild) continue;

            const member = await guild.members.fetch(data.userId).catch(() => null);
            if (!member) {
                // Member đã rời server → xóa khỏi data
                delete mutedData[key];
                changed = true;
                continue;
            }

            if (remaining <= 0) {
                // Hết hạn → unmute
                await member.timeout(null).catch(() => {});
                await member.roles.remove(MUTED_ROLE_ID).catch(() => {});
                delete mutedData[key];
                changed = true;
                console.log(`✅ Auto-unmute: ${member.user.tag} (hết hạn)`);
            } else if (remaining > MAX_DISCORD_TIMEOUT) {
                // Còn > 28 ngày → gia hạn timeout
                await member.timeout(MAX_DISCORD_TIMEOUT, data.reason).catch(() => {});
                console.log(`🔄 Gia hạn timeout: ${member.user.tag} (còn ${Math.floor(remaining / 86400000)} ngày)`);
            }
        } catch (err) {
            console.error(`❌ Lỗi auto-unmute cho ${data.userId}:`, err.message);
        }
    }

    if (changed) saveMutedData(mutedData);
}, 60 * 60 * 1000); // Check mỗi 1 giờ

console.log(`⏰ Đã bật auto-unmute (check mỗi 1h)`);