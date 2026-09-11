const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(client, interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) {
            console.warn(`⚠️ Không tìm thấy command: ${interaction.commandName}`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (err) {
            console.error(`❌ Lỗi command ${interaction.commandName}:`, err);

            const errorMsg = { content: '❌ Có lỗi xảy ra khi thực thi lệnh.', ephemeral: true };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMsg).catch(() => {});
            } else {
                await interaction.reply(errorMsg).catch(() => {});
            }
        }
    }
};