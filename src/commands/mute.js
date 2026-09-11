const {
    SlashCommandBuilder,
    PermissionsBitField,
    MessageFlags
} = require('discord.js');
const { findTarget, executeMute, executeUnmute } = require('../utils/muteParser');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Quản lý mute thành viên')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)

        // /mute add
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Mute một thành viên')
                .addStringOption(opt =>
                    opt.setName('target')
                        .setDescription('@mention, ID, hoặc username')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('duration')
                        .setDescription('Thời gian (VD: 10m, 2h, 1d, 1mo, 1y). Mặc định: 10 phút')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('reason')
                        .setDescription('Lý do mute')
                        .setRequired(false)
                )
        )

        // /mute remove
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Unmute một thành viên')
                .addStringOption(opt =>
                    opt.setName('target')
                        .setDescription('@mention, ID, hoặc username')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const botMember = interaction.guild.members.me;

        if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.reply({
                content: '❌ Bot chưa được cấp quyền Moderate Members (Timeout)!',
                flags: MessageFlags.Ephemeral
            });
        }

        const targetInput = interaction.options.getString('target');
        const target = await findTarget(interaction.guild, targetInput);

        if (!target) {
            return interaction.reply({
                content: `⚠️ Không tìm thấy user: \`${targetInput}\``,
                flags: MessageFlags.Ephemeral
            });
        }

        if (target.id === interaction.user.id) {
            return interaction.reply({
                content: '❌ Bạn không thể tự mute chính mình!',
                flags: MessageFlags.Ephemeral
            });
        }

        if (target.id === interaction.client.user.id) {
            return interaction.reply({
                content: '❌ Bạn không thể mute Bot!',
                flags: MessageFlags.Ephemeral
            });
        }

        // /mute add
        if (sub === 'add') {
            const durationStr = interaction.options.getString('duration');
            const reasonStr = interaction.options.getString('reason');

            await interaction.deferReply();
            await executeMute({
                interaction,
                guild: interaction.guild,
                member: interaction.member,
                botMember,
                author: interaction.user,
                target,
                durationStr,
                reasonStr,
                client: interaction.client
            });
            return;
        }

        // /mute remove
        if (sub === 'remove') {
            await interaction.deferReply();
            await executeUnmute({
                interaction,
                guild: interaction.guild,
                author: interaction.user,
                target
            });
            return;
        }
    }
};