const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const {
    canChain,
    isValidWord,
    getLastWord,
    isTwoSyllableWord,
    getRandomWord,
    addWord,
    hasNextWord,
} = require('./wordChain');
const cfg = require('../config/wordchain');

const activeGames = new Map();

function formatTime() {
    const now = new Date();
    return now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
           ' ' +
           now.toLocaleDateString('vi-VN');
}

function formatVoteDuration(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    if (sec > 0) return `${min}p${sec}s`;
    return `${min} phút`;
}

async function reactEmoji(message, emojiId) {
    try {
        await message.react(emojiId);
    } catch {}
}

async function sendStartEmbed(channel, startWord) {
    const lastWord = getLastWord(startWord);

    const embed = new EmbedBuilder()
        .setColor(cfg.messages.colorStart)
        .setTitle(cfg.messages.startTitle)
        .setDescription(cfg.messages.startDescription())
        .addFields(
            { name: cfg.messages.startBotLabel, value: `\`${startWord}\``, inline: true },
            { name: cfg.messages.startNextLabel, value: `\`${lastWord}\``, inline: true }
        )
        .setFooter({ text: cfg.messages.startFooter(formatTime()) });

    await channel.send({ embeds: [embed] });
}

function pickStartWord() {
    let startWord = getRandomWord();
    let attempts = 0;

    while (startWord && !isTwoSyllableWord(startWord) && attempts < 20) {
        startWord = getRandomWord();
        attempts++;
    }

    if (!startWord) startWord = 'biển xanh';
    return startWord;
}

function createNewGame() {
    const startWord = pickStartWord();

    return {
        currentWord: startWord,
        usedWords: [startWord.toLowerCase()],
        players: new Map(),
        lastUserId: null,
        startedAt: Date.now(),
        voteActive: false,
    };
}

async function startWordChain(client, message) {
    if (activeGames.has(message.channel.id)) {
        return message.reply(cfg.messages.errGameRunning);
    }

    const game = createNewGame();
    activeGames.set(message.channel.id, game);

    await sendStartEmbed(message.channel, game.currentWord);
}

async function resetWordChain(client, message) {
    activeGames.delete(message.channel.id);

    const game = createNewGame();
    activeGames.set(message.channel.id, game);

    const embed = new EmbedBuilder()
        .setColor(cfg.messages.colorStart)
        .setTitle(cfg.messages.resetTitle)
        .setDescription(cfg.messages.resetDescription());

    await message.channel.send({ embeds: [embed] });
    await sendStartEmbed(message.channel, game.currentWord);
}

async function stopWordChain(client, message) {
    if (!activeGames.has(message.channel.id)) {
        return message.reply(cfg.messages.errNoGame);
    }

    const game = activeGames.get(message.channel.id);
    activeGames.delete(message.channel.id);

    let winnerId = game.lastUserId;
    let winnerCount = 0;

    if (winnerId && game.players.has(winnerId)) {
        winnerCount = game.players.get(winnerId).count;
    } else {
        for (const [userId, data] of game.players) {
            if (data.count > winnerCount) {
                winnerId = userId;
                winnerCount = data.count;
            }
        }
    }

    if (winnerId) {
        const winnerData = game.players.get(winnerId);
        const embed = new EmbedBuilder()
            .setColor(cfg.messages.colorWin)
            .setTitle(cfg.messages.winTitle)
            .setDescription(
                cfg.messages.winDescription(
                    winnerId,
                    winnerData?.count || 0,
                    game.currentWord,
                    game.usedWords.length - 1
                )
            )
            .setFooter({ text: cfg.messages.winFooter(winnerData?.username || 'Unknown') })
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
    } else {
        const embed = new EmbedBuilder()
            .setColor(cfg.messages.colorStop)
            .setTitle(cfg.messages.stopTitle)
            .setDescription(cfg.messages.stopDescription(0, 0));

        await message.channel.send({ embeds: [embed] });
    }
}

async function replyAndDelete(message, content, delayMs = 5000) {
    const botMsg = await message.reply(content);
    setTimeout(() => botMsg.delete().catch(() => {}), delayMs);
    return botMsg;
}

async function endGameByDeadEnd(message, game) {
    activeGames.delete(message.channel.id);

    const embed = new EmbedBuilder()
        .setColor(cfg.messages.colorWin || 0x00FF00)
        .setTitle('🏁 Trò chơi kết thúc')
        .setDescription(
            `👑 **Người chiến thắng:** <@${message.author.id}>\n\n` +
            `🔄 **Bắt đầu trận đấu mới:** gõ \`e!stnt\``
        );

    await message.channel.send({ embeds: [embed] });
}

async function handleWordChainMessage(client, message) {
    const game = activeGames.get(message.channel.id);
    if (!game) return false;

    if (game.voteActive) return false;

    const userWord = message.content.trim();

    if (cfg.rules.requireTwoSyllables && !isTwoSyllableWord(userWord)) {
        return false;
    }

    if (userWord.toLowerCase().startsWith('e!')) return false;

    if (cfg.rules.blockSelfChain && game.lastUserId === message.author.id) {
        const embed = new EmbedBuilder()
            .setColor(cfg.messages.warnColor)
            .setTitle(cfg.messages.selfChainTitle)
            .setDescription(cfg.messages.selfChainDescription(message.author.username));

        const botMsg = await message.channel.send({ embeds: [embed] });
setTimeout(() => botMsg.delete().catch(() => {}), 5000);
        return true;
    }

    if (!isValidWord(userWord)) {
        await reactEmoji(message, cfg.emojis.wrong);
        await replyAndDelete(message, cfg.messages.errNotInDictionary(userWord));
        return true;
    }

    if (game.usedWords.includes(userWord.toLowerCase())) {
        await reactEmoji(message, cfg.emojis.wrong);
        await replyAndDelete(message, cfg.messages.errAlreadyUsed(userWord));
        return true;
    }

    if (!canChain(game.currentWord, userWord)) {
        await reactEmoji(message, cfg.emojis.wrong);
        const expected = getLastWord(game.currentWord);
        await replyAndDelete(message, cfg.messages.errWrongWord(expected));
        return true;
    }

    await reactEmoji(message, cfg.emojis.correct);

    game.currentWord = userWord;
    game.usedWords.push(userWord.toLowerCase());

    const playerData = game.players.get(message.author.id) || { count: 0, username: message.author.username };
    playerData.count += 1;
    game.players.set(message.author.id, playerData);

    game.lastUserId = message.author.id;

    const embed = new EmbedBuilder()
        .setColor(cfg.messages.colorSuccess)
        .setDescription(
            `✅ **${message.author.username}:** \`${userWord}\`\n\n` +
            `👉 Nối từ bắt đầu bằng **"${getLastWord(userWord)}"**`
        )
        .setFooter({ text: `Đã nối: ${game.usedWords.length} từ` });

    await message.channel.send({ embeds: [embed] });

    if (!hasNextWord(userWord, game.usedWords)) {
        await endGameByDeadEnd(message, game);
        return true;
    }

    return true;
}

async function startAddWordVote(client, message, word) {
    if (!isTwoSyllableWord(word)) {
        return message.reply(cfg.messages.addWordInvalid(word));
    }

    if (isValidWord(word)) {
        return message.reply(cfg.messages.addWordExists(word));
    }

    const yesBtn = new ButtonBuilder()
        .setCustomId('addword_yes')
        .setLabel(cfg.messages.voteYes)
        .setStyle(ButtonStyle.Success);

    const noBtn = new ButtonBuilder()
        .setCustomId('addword_no')
        .setLabel(cfg.messages.voteNo)
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(yesBtn, noBtn);

    const durationText = formatVoteDuration(cfg.rules.voteDuration);

    const embed = new EmbedBuilder()
        .setColor(cfg.messages.colorVote)
        .setTitle(cfg.messages.addWordTitle)
        .setDescription(cfg.messages.addWordDescription(word, message.author.username))
        .setFooter({ text: `${cfg.messages.voteFooter} ${durationText}` });

    const voteMsg = await message.channel.send({ embeds: [embed], components: [row] });

    const votes = new Map();
    const voters = new Set();

    const game = activeGames.get(message.channel.id);
    const expectedVoters = game ? game.players.size : 0;

    const collector = voteMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: cfg.rules.voteDuration * 1000,
    });

    collector.on('collect', async (interaction) => {
        if (votes.has(interaction.user.id)) {
            return interaction.reply({ content: '❌ Bạn đã vote rồi!', flags: 64 });
        }
        votes.set(interaction.user.id, interaction.customId === 'addword_yes');
        voters.add(interaction.user.id);
        await interaction.reply({ content: '✅ Đã ghi nhận vote!', flags: 64 });

        if (expectedVoters > 0 && voters.size >= expectedVoters) {
            collector.stop('all_voted');
        }
    });

    collector.on('end', async (collected, reason) => {
        let yes = 0, no = 0;
        for (const v of votes.values()) {
            if (v) yes++;
            else no++;
        }

        const disabledRow = new ActionRowBuilder().addComponents(
            ButtonBuilder.from(yesBtn).setDisabled(true),
            ButtonBuilder.from(noBtn).setDisabled(true)
        );

        await voteMsg.edit({ components: [disabledRow] }).catch(() => {});

        let endReason = '';
        if (reason === 'all_voted') endReason = ' (tất cả đã vote)';
        else if (reason === 'time') endReason = ' (hết thời gian)';

        if (yes > no && yes > 0) {
            const result = addWord(word);
            if (result.success) {
                await message.channel.send({
                    content: `${cfg.messages.addWordResultYes(word)}${endReason}\n📊 Kết quả: **${yes}** đồng ý / **${no}** không đồng ý`
                });
            } else {
                await message.channel.send({ content: `❌ Lỗi: ${result.error || 'Không thể thêm'}` });
            }
        } else {
            await message.channel.send({
                content: `${cfg.messages.addWordResultNo(word)}${endReason}\n📊 Kết quả: **${yes}** đồng ý / **${no}** không đồng ý`
            });
        }
    });
}

async function handleWordChain(client, message, content, lower) {
    if (cfg.commands.resetRegex.test(lower)) {
        await resetWordChain(client, message);
        return true;
    }

    if (cfg.commands.startRegex.test(lower)) {
        await startWordChain(client, message);
        return true;
    }

    if (cfg.commands.stopRegex.test(lower)) {
        await stopWordChain(client, message);
        return true;
    }

    const addWordMatch = content.match(cfg.commands.addWordRegex);
    if (addWordMatch) {
        const word = addWordMatch[1].trim();
        await startAddWordVote(client, message, word);
        return true;
    }

    if (activeGames.has(message.channel.id)) {
        return await handleWordChainMessage(client, message);
    }

    return false;
}

module.exports = {
    handleWordChain,
    startWordChain,
    resetWordChain,
    stopWordChain,
    startAddWordVote,
};