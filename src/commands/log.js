const { SlashCommandBuilder } = require('discord.js');
const { getDeletedLogs, getLogsByUser, getLogById } = require('../database');
const {
    createQueryDeletedEmbed,
    createQueryUserEmbed,
    createQueryIdEmbed
} = require('../utils/embeds');

// ============ CẤU HÌNH ROLE ĐƯỢC PHÉP DÙNG ============
const ALLOWED_ROLE_IDS = [
    '1547981794802933790',
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('log')
        .setDescription('Truy xuất log tin nhắn')
        .addSubcommand(sub =>
            sub.setName('deleted')
                .setDescription('Xem các tin nhắn đã bị xóa gần đây')
                .addIntegerOption(opt =>
                    opt.setName('soluong')
                        .setDescription('Số lượng (mặc định 5, tối đa 20)')
                        .setMinValue(1).setMaxValue(20)
                )
        )
        .addSubcommand(sub =>
            sub.setName('user')
                .setDescription('Xem log của một user')
                .addUserOption(opt =>
                    opt.setName('user').setDescription('User cần xem').setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('id')
                .setDescription('Xem log theo ID tin nhắn (hiển thị công khai)')
                .addStringOption(opt =>
                    opt.setName('message_id').setDescription('ID tin nhắn').setRequired(true)
                )
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

        const client = interaction.client;
        const sub = interaction.options.getSubcommand();

        // ========== /log id -> PUBLIC (mọi người thấy) ==========
        if (sub === 'id') {
            // KHÔNG deferReply ephemeral, mà deferReply public
            await interaction.deferReply();

            const msgId = interaction.options.getString('message_id');
            const row = getLogById.get(msgId);

            if (!row) {
                return interaction.editReply('📭 Không tìm thấy log với ID này.');
            }

            const embed = createQueryIdEmbed(row, client);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // ========== /log deleted và /log user -> EPHEMERAL ==========
        await interaction.deferReply({ ephemeral: true });

        if (sub === 'deleted') {
            const limit = interaction.options.getInteger('soluong') || 5;
            const rows = getDeletedLogs.all(limit);
            if (rows.length === 0) {
                return interaction.editReply('📭 Không có tin nhắn nào bị xóa gần đây.');
            }
            const embeds = rows.slice(0, 10).map((row, i) => createQueryDeletedEmbed(row, client, i));
            await interaction.editReply({ embeds });
        }

        else if (sub === 'user') {
            const user = interaction.options.getUser('user');
            const rows = getLogsByUser.all(user.id, 10);
            if (rows.length === 0) {
                return interaction.editReply(`📭 Không có log nào của ${user.tag}.`);
            }
            const embeds = rows.map((row, i) => createQueryUserEmbed(row, client, i));
            await interaction.editReply({ embeds });
        }
    }
};