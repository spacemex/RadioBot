require('dotenv').config();
const express = require('express');
const { Client, IntentsBitField } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const axios = require('axios');
const { spawn } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');

// Environment variables
const clientId = process.env.CLIENT_ID;
const guildId = process.env.SERVER_ID;
const token = process.env.TOKEN;
const voiceChannelId = process.env.VOICE_CHANNEL_ID;
const announceChannelId = process.env.ANNOUNCE_CHANNEL_ID;

const app = express();
const port = process.env.PORT || 3000;

// Serve the static files from the public directory
app.use(express.static('public'));

// Endpoint to search radio stations
app.get('/search', async (req, res) => {
    const query = req.query.query;
    console.log(`Search query: ${query}`);
    try {
        const response = await axios.get('https://de1.api.radio-browser.info/json/stations/search', {
            params: {
                name: query,
                tagList: query,
                order: 'name',
                hidebroken: true
            }
        });
        console.log(`Stations found: ${response.data.length}`);
        res.json(response.data);
    } catch (error) {
        console.error('Error retrieving stations:', error);
        res.status(500).send('Error retrieving stations');
    }
});

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildVoiceStates,
        IntentsBitField.Flags.GuildMessages,
    ],
});

// Function to join a voice channel and play a station
async function playStation(stationName, voiceChannelId, announceChannelId) {
    console.log(`Attempting to play station: ${stationName}`);
    try {
        const stationUrl = await getRadioStationUrl(stationName);

        if (!stationUrl) {
            console.log(`Could not find a station with the name: ${stationName}`);
            return;
        }

        console.log(`Joining voice channel: ${voiceChannelId}`);
        const connection = joinVoiceChannel({
            channelId: voiceChannelId,
            guildId,
            adapterCreator: client.guilds.cache.get(guildId).voiceAdapterCreator,
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

        player.on(AudioPlayerStatus.Idle, () => {
            console.log(`Player is now idle, disconnecting from channel.`);
            connection.destroy();
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

// Fetch radio station URL
async function getRadioStationUrl(stationName) {
    console.log(`Fetching URL for station: ${stationName}`);
    try {
        const response = await axios.get('https://de1.api.radio-browser.info/json/stations/search', {
            params: {
                name: stationName,
                limit: 1,
                order: 'name',
            }
        });

        if (response.status === 200 && response.data.length > 0) {
            const station = response.data[0];
            console.log(`Found station: ${station.name}, URL: ${station.url}`);
            return station.url;
        } else {
            console.warn(`No station found for: ${stationName}`);
        }
    } catch (error) {
        console.error('Error fetching the radio station:', error);
    }
    return null;
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    if (voiceChannelId) {
        await playStation("Shark", voiceChannelId, announceChannelId);
    }
});

// Start both the Discord bot and the web server
client.login(token);

app.listen(port, () => {
    console.log(`Web app is running at http://localhost:${port}`);
});