module.exports = {
    commands: {
        startRegex: /^(e!startnoitu|e!stnt|bắt đầu nối từ|chơi nối từ|nối từ)$/i,
        resetRegex: /^(e!ntrs|e!resetnoitu|reset nối từ|chơi lại)$/i,
        stopRegex: /^(e!stpnt|e!dungnoitu|kết thúc nối từ|dừng nối từ|stop)$/i,
        addWordRegex: /^e!themtu\s+(.+)$/i,
    },

    emojis: {
        correct: '1554901670507323462',
        wrong: '1554901672529104896',
    },

    messages: {
        startTitle: '🎮 TRÒ CHƠI NỐI TỪ',
        startDescription: () =>
    `Vòng chơi mới đã bắt đầu! Hãy dùng vốn từ phong phú của bạn nào.\n` +
    `⚠️ **Luật:**\n` +
    `• Không còn từ nào nối tiếp được sẽ tự kết thúc trận\n` +
    `• Gõ \`e!themtu <từ>\` để đề xuất thêm từ`,
        startBotLabel: '🖥️ Mở Bát',
        startNextLabel: '👉 Nối tiếp từ',
        startFooter: (timestamp) => `⏱️ ${timestamp}`,

        resetTitle: '🔄 Đã reset trận',
        resetDescription: 'Trận mới đã bắt đầu, chơi tiếp nào!',

        stopTitle: '🛑 Kết thúc game',
        stopDescription: (totalWords, totalPlayers) =>
            `**Tổng từ đã nối:** ${totalWords}\n` +
            `**Người chơi:** ${totalPlayers}`,

        winTitle: '🏆 NGƯỜI CHIẾN THẮNG',
        winDescription: (userId, userWords, lastWord, totalWords) =>
            `🏆 **Người thắng cuộc:** <@${userId}>\n\n` +
            `📊 **Số từ đã nối:** \`${userWords}\`\n` +
            `💬 **Từ cuối cùng:** \`${lastWord}\`\n` +
            `🎯 **Tổng từ cả trận:** \`${totalWords}\``,
        winFooter: (username) => `Chúc mừng ${username}!`,

        selfChainTitle: '⏸️ Đợi người chơi khác!',
        selfChainDescription: (username) =>
            `**${username}** vừa nối rồi! Đợi người chơi khác nối tiếp nhé.`,

        addWordTitle: '📝 VOTE THÊM TỪ',
        addWordDescription: (word, authorName) =>
            `**${authorName}** muốn thêm từ **"${word}"** vào từ điển!\n\n` +
            `Ai đồng ý bấm nút bên dưới.`,
        addWordResultYes: (word) => `✅ Đa số đồng ý → Đã thêm từ **"${word}"**!`,
        addWordResultNo: (word) => `❌ Không đủ phiếu → Không thêm từ **"${word}"**.`,
        addWordInvalid: (word) => `❌ Từ **"${word}"** không hợp lệ (phải có đúng 2 âm tiết)!`,
        addWordExists: (word) => `⚠️ Từ **"${word}"** đã có trong từ điển rồi!`,

        errNotInDictionary: (word) => `❌ Từ **"${word}"** không có trong từ điển!\n💡 Gõ \`e!themtu ${word}\` để đề xuất thêm.`,
        errAlreadyUsed: (word) => `❌ Từ **"${word}"** đã dùng rồi!`,
        errWrongWord: (expected) => `❌ Từ phải bắt đầu bằng **"${expected}"**!`,
        errGameRunning: '⚠️ Game nối từ đang chơi ở kênh này rồi!',
        errNoGame: '⚠️ Không có game nối từ nào đang chơi!',
        errVoteRunning: '⚠️ Đang có vote khác!',

        colorStart: 0x57F287,
        colorStop: 0xED4245,
        colorSuccess: 0x57F287,
        colorWin: 0xFFA500,
        warnColor: 0x5865F2,
        colorVote: 0x5865F2,
    },

    rules: {
        maxWords: 0,
        requireTwoSyllables: true,
        blockSelfChain: true,
        voteDuration: 300,
    },
};