async function playStation(stationName, voiceChannelId, announceChannelId) {
    console.log(`Attempting to play station: ${stationName}`);
    try {
        const stationUrl = await getRadioStationUrl(stationName);

        if (!stationUrl) {
            console.log(`Could not find a station with the name: ${stationName}`);
            return;
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            console.error('Guild not found');
            return;
        }

        console.log(`Joining voice channel: ${voiceChannelId}`);
        const connection = joinVoiceChannel({
            channelId: voiceChannelId,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
        });

        const process = spawn(ffmpegStatic, [
            '-reconnect', '1', '-reconnect_at_eof', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '2',
            '-i', stationUrl, '-f', 's16le', '-ac', '2', '-ar', '48000', '-bufsize', '64k', '-'
        ]);

        process.stderr.on('data', (data) => {
            console.error(`FFmpeg error detail: ${data.toString()}`);
        });

        const resource = createAudioResource(process.stdout, {
            inputType: StreamType.Raw,
        });

        const player = createAudioPlayer();
        player.play(resource);
        connection.subscribe(player);

        player.on(AudioPlayerStatus.Idle, async () => {
            console.log(`Player is idle, attempting to reconnect.`);
            await playStation(stationName, voiceChannelId, announceChannelId);
        });

        player.on('stateChange', (oldState, newState) => {
            console.log(`Player transitioned from ${oldState.status} to ${newState.status}`);
        });

        console.log(`Now playing: ${stationUrl}`);

        if (announceChannelId) {
            const announceChannel = client.channels.cache.get(announceChannelId);
            if (announceChannel) {
                announceChannel.send(`Now playing: **${stationName}**`).catch(err => console.error('Error sending message:', err));
            } else {
                console.warn('Announcement channel not found!');
            }
        }

    } catch (error) {
        console.error('Error playing the radio station:', error);
    }
}