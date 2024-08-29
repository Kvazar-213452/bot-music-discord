const { Client, Intents, MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const fs = require('fs');
const url = require('url');

const client = new Client({ 
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_VOICE_STATES
    ] 
});
const prefix = '!';

client.once('ready', () => {
    console.log('Бот готовий!');
});



function addMusicToJson(guildId, videoName, videoUrl) {
    let jsonData = {};
    try {
        const jsonString = fs.readFileSync(`./music_data/${guildId}.json`, 'utf8');
        jsonData = JSON.parse(jsonString);
    } catch (err) {
        console.log(err);
    }

    jsonData[videoName] = videoUrl;

    fs.writeFileSync(`./music_data/${guildId}.json`, JSON.stringify(jsonData));
}



function playMusic(connection, videoUrl) {
    const stream = ytdl(videoUrl, { filter: 'audioonly' });
    const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
    const player = createAudioPlayer();
    player.play(resource);
    connection.subscribe(player);

    player.on('stateChange', (oldState, newState) => {
        if (oldState.status === 'playing' && newState.status === 'idle') {
            playMusic(connection, videoUrl);
        }
    });
}


client.on('messageCreate', async message => {
    if (!message.guild) return;

    if (message.content.startsWith(`${prefix}playlist`) || message.content.startsWith(`${prefix}play`)) {
        if (!message.member.voice.channel) {
            return message.reply('спочатку потрібно приєднатися до голосового каналу!');
        }

        if (!message.guild.me.permissionsIn(message.member.voice.channel).has('CONNECT') || !message.guild.me.permissionsIn(message.member.voice.channel).has('SPEAK')) {
            return message.reply('бот не має дозволів для голосового каналу!');
        }

        let videoUrl;
        if (message.content.startsWith(`${prefix}playlist`)) {
            const playlistName = message.content.split(' ')[1]; 

            try {
                const jsonString = fs.readFileSync(`./music_data/${message.guild.id}.json`, 'utf8');
                const jsonData = JSON.parse(jsonString);

                if (!jsonData.hasOwnProperty(playlistName)) {
                    return message.reply('вказаний плейлист не знайдено!');
                }

                videoUrl = jsonData[playlistName];
            } catch (err) {
                console.error(err);
                return message.reply('помилка при відтворенні музики з плейлисту.');
            }
        } else if (message.content.startsWith(`${prefix}play`)) {
            videoUrl = message.content.split(' ')[1];
        }

        try {
            const ytdl = require('ytdl-core');
            const { joinVoiceChannel, createAudioResource, createAudioPlayer, StreamType } = require('@discordjs/voice'); // Імпорт необхідних функцій та класів для відтворення аудіо

            const videoInfo = await ytdl.getInfo(videoUrl);
            const videoName = videoInfo.videoDetails.title;
            const videoThumbnail = videoInfo.videoDetails.thumbnails[0].url;
            const videoDuration = new Date(null);
            videoDuration.setSeconds(videoInfo.videoDetails.lengthSeconds);
            const formattedDuration = videoDuration.toISOString().substr(11, 8);

            const connection = joinVoiceChannel({
                channelId: message.member.voice.channel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });

            const stream = ytdl(videoUrl, { filter: 'audioonly' });
            const resource = createAudioResource(stream, {
                inputType: StreamType.Arbitrary,
            });
            const player = createAudioPlayer();
            player.play(resource);
            connection.subscribe(player);

            let isLooped = false;

            const { MessageButton, MessageActionRow, MessageEmbed } = require('discord.js');

            const loopButton = new MessageButton()
                .setCustomId('loop_button')
                .setLabel('Loop')
                .setStyle('PRIMARY');

            const exitButton = new MessageButton()
                .setCustomId('exit_button')
                .setLabel('Exit')
                .setStyle('PRIMARY');

            const row = new MessageActionRow()
                .addComponents(loopButton, exitButton);

            const embed = new MessageEmbed()
                .setTitle(videoName)
                .setThumbnail(videoThumbnail)
                .addFields(
                    { name: 'Тривалість', value: formattedDuration }
                );

            const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });

            const collector = sentMessage.createMessageComponentCollector({ componentType: 'BUTTON' });

            collector.on('collect', async i => {
                if (i.customId === 'loop_button') {
                    isLooped = !isLooped;
                    if (isLooped) {
                        player.pause();
                    } else {
                        player.unpause();
                    }
                    await i.update({ content: `Музика ${isLooped ? 'зациклена' : 'не зациклена'}`, components: [row] });
                } else if (i.customId === 'exit_button') {
                    connection.destroy();
                    sentMessage.delete();
                    collector.stop();
                    message.channel.send("End music.");
                }
            });

            playMusic(connection, videoUrl); 
        } catch (error) {
            console.error('Сталася помилка під час відтворення музики:', error);
            return message.reply('помилка під час відтворення музики. Будь ласка, спробуйте ще раз пізніше.');
        }
    }

    


    if (message.content.startsWith(`${prefix}add_music`)) {
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply('тільки адміністратори можуть додавати музику!');
        }

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (args.length < 2) {
            return message.reply('недостатньо параметрів. Потрібно вказати назву музики та URL.');
        }

        const videoName = args[0];
        const videoUrl = args[1];

        // Додаємо музику до JSON файлу
        addMusicToJson(message.guild.id, videoName, videoUrl);

        message.reply(`музика "${videoName}" успішно додана!`);
    }

    if (message.content.startsWith(`${prefix}remove_music`)) {
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply('тільки адміністратори можуть видаляти музику!');
        }

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        args.shift(); // Видаляємо префікс команди

        if (args.length < 1) {
            return message.reply('недостатньо параметрів. Потрібно вказати назву музики, яку потрібно видалити.');
        }

        const videoNameToRemove = args.join(' ');

        // Викликаємо функцію для видалення музики з файлу JSON
        removeMusicFromJson(message.guild.id, videoNameToRemove);

        message.reply(`музика "${videoNameToRemove}" успішно видалена з плейлисту!`);
    }

    if (message.content.startsWith(`${prefix}all_playlist`)) {
        try {
            const jsonString = fs.readFileSync(`./music_data/${message.guild.id}.json`, 'utf8');
            const jsonData = JSON.parse(jsonString);

            if (Object.keys(jsonData).length === 0) {
                return message.reply('у цьому сервері ще немає жодного плейлисту.');
            }

            let playlistsString = '**Music list view:**\n\n';
            Object.keys(jsonData).forEach((playlistName, index) => {
                playlistsString += `${index + 1}. **${playlistName}** - ${jsonData[playlistName]}\n`;
            });

            const embed = new MessageEmbed()
                .setTitle('List of music')
                .setDescription(playlistsString)
                .setColor('#00FF00');

            message.channel.send({ embeds: [embed] });
        } catch (err) {
            console.log(err);
            return message.reply('помилка при отриманні списку плейлистів.');
        }
    }
});









function removeMusicFromJson(guildId, videoNameToRemove) {
    try {
        const jsonString = fs.readFileSync(`./music_data/${guildId}.json`, 'utf8');
        let jsonData = JSON.parse(jsonString);

        // Видаляємо музику з об'єкта JSON за назвою
        delete jsonData[videoNameToRemove];

        // Перезаписуємо файл JSON з оновленими даними
        fs.writeFileSync(`./music_data/${guildId}.json`, JSON.stringify(jsonData));
    } catch (err) {
        console.log(err);
    }
}


client.login('');
