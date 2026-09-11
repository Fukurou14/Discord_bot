const fs = require('fs');
const path = require('path');

function loadCommands(client) {
    const commandsPath = path.join(__dirname, '..', 'commands');

    if (!fs.existsSync(commandsPath)) {
        console.log('⚠️ Chưa có thư mục commands');
        return;
    }

    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);

        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`📁 Loaded command: ${command.data.name}`);
        } else {
            console.warn(`⚠️ File ${file} thiếu data hoặc execute, bỏ qua.`);
        }
    }
    console.log(`✅ Đã load ${client.commands.size} commands\n`);
}

module.exports = { loadCommands };