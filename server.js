const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const { channel } = require('diagnostics_channel');
require('dotenv').config();

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const PORT = process.env.PORT;
const URL = process.env.URL;
const SOUT= `${process.env.SOUT}/stream`;
const filePath = path.join(__dirname, `${process.env.FILE}`);

let vlcProcess;
let currentChannel = '';
let channelId;
let list1;
let list2;
let master = [];

function parseM3U(file, p_handle) {

    let handle = p_handle

    const lines = file.split(/\r?\n/);
    if ( !lines[0].startsWith('#EXTM3U') ) {
        throw new Error('Invalid M3U file: Missing #EXTM3U header');
    }

    let list = [];
    let currentItem = null;

    for ( const line of lines ) {
        if ( line.startsWith('#EXTINF') ) {
            // Extract metadata after #EXTINF:
            const metadata = line.substring(8).trim();

            // Parse `tvg-ID`
            const tvgIdMatch = metadata.match(/tvg-ID="(.*?)"/);
            const tvgId = tvgIdMatch ? tvgIdMatch[1] : null;

            // Parse `tvg-name`
            const tvgNameMatch = metadata.match(/tvg-name="(.*?)"/);
            const tvgName = tvgNameMatch ? tvgNameMatch[1] : null;

            // Parse `tvg-logo`
            const tvgLogoMatch = metadata.match(/tvg-logo="(.*?)"/);
            const tvgLogo = tvgLogoMatch ? tvgLogoMatch[1] : null;

            // Parse `group-title`
            const groupTitleMatch = metadata.match(/group-title="(.*?)"/);
            const groupTitle = groupTitleMatch ? groupTitleMatch[1] : null;

            // Parse channel name (text after last comma)
            const nameMatch = metadata.match(/,(.*)$/);
            let name = nameMatch ? nameMatch[1] : null;
            if (name) {
                name = name.substring(4);
            }

            currentItem = {
                tvg: {
                    id: tvgId,
                    name: tvgName,
                    logo: tvgLogo,
                },
                group: groupTitle,
                name,
                id: null,
            };
        } else if ( line.startsWith('http') && currentItem ) {
            const url = line.trim();
            const id = url.match(/\/(\d+)$/);
            currentItem.id = id ? id[1] : null;

            if( handle == "handle1" && currentItem.group.startsWith("Group A")) {
                list.push(currentItem);
            }
            if ( handle == "handle2" && currentItem.group.startsWith("Group B")) {
                list.push(currentItem)
            }           
            currentItem = null;    
        }  
    }
    return list;
}

// Read Channels
fs.readFile(filePath, 'utf8', (err, data) => {
    if ( err ) {
        console.error('Error reading the file:', err.message);
        return;
    }
    try {
        list1 = parseM3U(data, "handle1");
        list2 = parseM3U(data, "handle2");
        master.push(...list1);
        master.push(...list2);
    } catch ( error ) {
        console.error('Error parsing M3U:', error.message);
    }   
});

// Route to display main page
app.get('/', (req, res) => {
    
    let out = SOUT
    let channel = currentChannel

    try {
        res.render('index', { 
            SOUT: out,
            channel: channel,
            list_1: list1,
            list_2: list2
        });
    } catch (error) {
        console.error('Error parsing:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route to handle individual channel clicks
app.get('/channel/:id', (req, res) => {
    channelId = req.params.id;
    const streamUrl = URL + channelId;

    const selectedChannel = master.find(channel => channel.id === channelId);
    currentChannel = selectedChannel.name + "  ||  " + selectedChannel.group;

    if(vlcProcess) {
        vlcProcess.kill();  
    }

    vlcProcess = spawn('cvlc', [
        `${streamUrl}`, 
        '--sout', '#standard{access=http, mux=ts, dst=:8001}',
        '--sout-keep',
    ]);
    console.log('VLC process started with PID:', vlcProcess.pid);

    res.redirect('/vlc');
});

app.get('/vlc/kill', (req, res) => {
    if(vlcProcess) {
        vlcProcess.kill();
        currentChannel = "";
    }
    res.redirect('/vlc'); 
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
