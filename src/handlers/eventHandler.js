const fs = require('fs');
const path = require('path');

function loadEvents(client) {
    const eventsPath = path.join(__dirname, '..', 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

    let count = 0;
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        delete require.cache[require.resolve(filePath)]; // hot reload
        const event = require(filePath);

        if (!event.name || !event.execute) {
            console.warn(`⚠️ File ${file} thiếu name hoặc execute, bỏ qua.`);
            continue;
        }

        if (event.once) {
            client.once(event.name, (...args) => event.execute(client, ...args));
        } else {
            client.on(event.name, (...args) => event.execute(client, ...args));
        }
        count++;
        console.log(`📁 Loaded event: ${event.name}`);
    }
    console.log(`✅ Đã load ${count} events\n`);
}

module.exports = { loadEvents };