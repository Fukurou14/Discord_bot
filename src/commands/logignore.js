const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const {
    addIgnoredChannel,
    removeIgnoredChannel,
    getIgnoredChannel,
    getAllIgnoredChannels
} = require('../database');

// ============ CẤU HÌNH ROLE ĐƯỢC PHÉP DÙNG ============
const ALLOWED_ROLE_IDS = [
    '1547981794802933790',
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logignore')
        .setDescription('Quản lý các kênh bỏ qua log')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Thêm kênh vào danh sách bỏ qua log')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Kênh muốn bỏ qua')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Bỏ kênh khỏi danh sách bỏ qua log')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Kênh muốn bỏ khỏi danh sách')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Xem danh sách các kênh đang bỏ qua log')
        ),

    async execute(interaction) {
        // ============ CHECK ROLE ============
        const hasPermission = interaction.member.roles.cache
            .some(role => ALLOWED_ROLE_IDS.includes(role.id));

        if (!hasPermission) {
            return interaction.reply({
                content: '❌ Bạn không có role được phép dùng lệnh này.',
                ephemeral: true
            });
        }

        // ============ CHẠY LỆNH ============
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: true });

        // ========== /logignore add ==========
        if (sub === 'add') {
            const channel = interaction.options.getChannel('channel');

            const existing = getIgnoredChannel.get(channel.id);
            if (existing) {
                return interaction.editReply(`⚠️ Kênh ${channel} đã có trong danh sách bỏ qua rồi.`);
            }

            addIgnoredChannel.run(channel.id, interaction.user.id, Date.now());

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setDescription(`✅ Đã thêm ${channel} vào danh sách **bỏ qua log**.\n\nBot vẫn sẽ cache ảnh trong kênh này, nhưng sẽ **không** gửi thông báo vào kênh log khi tin nhắn bị xóa/sửa.`);

            await interaction.editReply({ embeds: [embed] });
        }

        // ========== /logignore remove ==========
        else if (sub === 'remove') {
            const channel = interaction.options.getChannel('channel');

            const existing = getIgnoredChannel.get(channel.id);
            if (!existing) {
                return interaction.editReply(`⚠️ Kênh ${channel} không có trong danh sách bỏ qua.`);
            }

            removeIgnoredChannel.run(channel.id);

            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setDescription(`✅ Đã bỏ ${channel} khỏi danh sách **bỏ qua log**.\n\nTừ giờ bot sẽ gửi log bình thường cho kênh này.`);

            await interaction.editReply({ embeds: [embed] });
        }

        // ========== /logignore list ==========
        else if (sub === 'list') {
            const rows = getAllIgnoredChannels.all();

            if (rows.length === 0) {
                return interaction.editReply('📭 Chưa có kênh nào bị bỏ qua log.');
            }

            const list = rows.map((row, i) => {
                const addedBy = `<@${row.added_by}>`;
                const addedAt = `<t:${Math.floor(row.added_at / 1000)}:R>`;
                return `**${i + 1}.** <#${row.channel_id}>\n└ Thêm bởi: ${addedBy} • ${addedAt}`;
            }).join('\n\n');

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`📋 Danh sách kênh bỏ qua log (${rows.length})`)
                .setDescription(list.slice(0, 4000))
                .setFooter({ text: `Yêu cầu bởi ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }
};