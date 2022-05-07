import dayjs from "dayjs";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import http from "http";
import https from "https";
import fetch from "node-fetch";
import TelegramBot from "node-telegram-bot-api";
import TwitchApiPkg from "node-twitch";

import RandomArrayStore, { RandomArray } from "./lib/randomArray.js";
import { sanitizeMarkdown } from "./lib/strings.js";
import { alarm, fetchJSON, isTwitchEventsubRequest, log } from "./lib/utils.js";
import { verifyTwitchRequest } from "./lib/verifyTwitchSignature.js";

dotenv.config();
dotenv.config({
    path: ".env.local",
});

const TwitchApi = TwitchApiPkg.default;

// Constants

const requiredVars = {
    TG_TOKEN: process.env.TG_TOKEN,
    TWITCH_CLIENTID: process.env.TWITCH_CLIENTID,
    TWITCH_SECRET: process.env.TWITCH_SECRET,
    TWITCH_EVENTSUB_SECRET: process.env.TWITCH_EVENTSUB_SECRET,
    TG_ALPHA_ID: process.env.TG_ALPHA_ID,
    TG_EFFY_ID: process.env.TG_EFFY_ID,
    TG_GROUP_ID: process.env.TG_GROUP_ID,
};
for (const key in requiredVars) {
    if (!requiredVars[key]) {
        throw new Error(`Env '${key}' not found.`);
    }
}

const SRC_PATH = `${process.cwd()}/src`;
const PORT = parseInt(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

const TG_TOKEN = process.env.TG_TOKEN;

const IDS = {
    effy: parseInt(process.env.TG_EFFY_ID),
    alpha: parseInt(process.env.TG_ALPHA_ID),
    group: [parseInt(process.env.TG_GROUP_ID)], // -1001444586900
};

function GetID(key) {
    return IDS[key.toLowerCase()];
}

const CHECK_VAL_UPDATE = true;

const twitch = new TwitchApi({
    client_id: process.env.TWITCH_CLIENTID,
    client_secret: process.env.TWITCH_SECRET,
});

async function getStreamData(channel) {
    const streams = await twitch.getStreams({ channel: channel });
    if (streams?.data?.length > 0) {
        // console.log(streams.data[0]);
        return Promise.resolve(streams.data[0]);
    } else {
        return Promise.reject(false);
    }
}

const vocali = [
    "uh",
    "scusa",
    "cypher",
    "cosa",
    "gogo",
    "megustas",
    "alieno",
    "astra",
    "nuoh",
    "beep",
    "chug",
    "erpipo",
    "popipopi",
    "circo",
    "splash",
    "caggiafa",
    "foca",
    "comesparo",
    "grr",
];
const regcommand = new RegExp(`^[!/](${vocali.join("|")})`, "i");

const tgbot = new TelegramBot(TG_TOKEN, { polling: true });

async function sendStreamPhoto(channel, chatIds) {
    if (!Array.isArray(chatIds)) {
        chatIds = [chatIds];
    }
    const res = await getStreamData(channel.toLowerCase())
        .then(async (stream) => {
            const thumbUrl = `${stream.getThumbnailUrl({ height: 720, width: 1280 })}?time=${new Date().getTime()}`;
            let tgres = true;
            for (const chatId of chatIds) {
                tgres &= await tgbot
                    .sendPhoto(chatId, thumbUrl, {
                        caption: `${stream.title} - ${stream.game_name}`,
                        parse_mode: "HTML",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: `Twitch di ${stream.user_name}`,
                                        url: `https://www.twitch.tv/${stream.user_login}`,
                                    },
                                ],
                            ],
                        },
                    })
                    .then(() => true)
                    .catch((e) => {
                        console.error("SendPhotoError:", e.message);
                        return false;
                    });
            }
            return tgres;
        })
        .catch(() => {
            console.log("No stream avalaible.");
            return false;
        });

    return Promise.resolve(!!res);
}

async function isOnline(channel) {
    return await getStreamData(channel.toLowerCase())
        .then((stream) => stream)
        .catch(() => false);
}

tgbot.on("message", (msg) => {
    const chatId = msg.chat.id;
    if (msg.from.id == GetID("alpha")) {
        // console.log(msg);
    }

    if (msg.left_chat_member && !msg.left_chat_member.is_bot) {
        tgbot.sendMessage(
            chatId,
            `BB ${msg.left_chat_member.username || msg.left_chat_member.first_name} 👋\nNon sai che ti perdi 😇`
        );
    } else if (msg.new_chat_members) {
        for (const newMember of msg.new_chat_members) {
            const name = sanitizeMarkdown(newMember.username || newMember.first_name);
            if (!newMember.is_bot) {
                tgbot.sendMessage(
                    chatId,
                    `Benvenuto/a al circo [${name}](tg://user?id=${newMember.id}), spero ti divertirai 🤡❤️`,
                    { parse_mode: "MarkdownV2" }
                );
            } else {
                tgbot.sendMessage(chatId, `Helo brodah [${name}](tg://user?id=${newMember.id})\\!`, {
                    parse_mode: "MarkdownV2",
                });
            }
        }
    }
});

tgbot.onText(regcommand, (msg, match) => {
    const chatId = msg.chat.id;
    const voice = match[1];

    const voicePath = `${SRC_PATH}/audio/${voice}.ogg`;
    if (fs.existsSync(voicePath)) {
        tgbot.sendVoice(chatId, voicePath, {}, { contentType: "audio/ogg" });
    } else {
        tgbot.sendMessage(chatId, "Non ce lo ho questo vocale, la streamer me lo ha perso 😢");
    }
});

tgbot.onText(/^\/getStream(?:$|\s(\w+)$)/i, (msg, match) => {
    const chatId = msg.chat.id;
    const streamer = match[1] || "Seffyra";

    sendStreamPhoto(streamer.toLowerCase(), chatId).then(
        (res) => !res && tgbot.sendMessage(chatId, `${streamer} al momento è offline`)
    );
});

tgbot.onText(/^[!/](?:isOnline|status|online)(?:$|\s(\w+)$)/i, (msg, match) => {
    const chatId = msg.chat.id;
    const streamer = match[1] || "Seffyra";

    isOnline(streamer.toLowerCase()).then((online) => {
        tgbot.sendMessage(chatId, `${streamer} al momento è <b>${online ? "online" : "offline"}</b> su twitch`, {
            parse_mode: "HTML",
        });
    });
});

tgbot.onText(/^\/getChatInfo$/, (msg) => {
    if (msg.from.id !== GetID("alpha")) {
        return;
    }

    let s = msg.chat.title ? `*Title*: ${msg.chat.title} (${msg.chat.type})` : "Private Chat";
    s += "\n*Chat ID*: " + msg.chat.id;
    s += "\n*Sender ID*: " + msg.from.id;

    tgbot.sendMessage(msg.chat.id, s, { parse_mode: "MarkdownV2" });
});

tgbot.onText(/niente.+live/i, (msg) => {
    if (msg.from.id !== GetID("effy")) {
        return;
    }

    const s = "Can I cry? Im gonna cry now 😭";
    tgbot.sendMessage(msg.chat.id, s, { parse_mode: "MarkdownV2" });
});

tgbot.onText(/\/start/, (msg) => {
    const s =
        "Benvenuto/a clown, questo è il chatbot per la streamer Seffyra\nScrivi `\\!social` per avere tutti i posti dove puoi trovarla";
    tgbot.sendMessage(msg.chat.id, s, { parse_mode: "MarkdownV2" });
});

tgbot.onText(/^!unfollow/, (msg) => {
    const s = "Non mi tentare che ti kicko su serio 😈";
    tgbot.sendMessage(msg.chat.id, s, { parse_mode: "MarkdownV2" });
});

tgbot.onText(/^!effy/, (msg) => {
    const s =
        "Streamer, proplayer, caster, modella, scrittrice, insegnante, studentessa, boss di un circo, cantante dilettante, accalappia donne, meme vivente, run 'n' gunner professionista, scammer nei weekend e a volte pure muratore.\nQuante ne sa la nostra Effy ❤️";
    tgbot.sendMessage(msg.chat.id, s, { parse_mode: "HTML" });
});

tgbot.onText(/^!honey/, (msg) => {
    const s = "Oki addicted mod\nAlso best mod EU no cap 🧢";
    tgbot.sendMessage(msg.chat.id, s, { parse_mode: "MarkdownV2" });
});

tgbot.onText(/^!alpha/, (msg) => {
    const s = "Non è un clown ma l'intero circo, no cap 🧢";
    tgbot.sendMessage(msg.chat.id, s, { parse_mode: "MarkdownV2" });
});

tgbot.onText(/^[!/]developer/, (msg) => {
    const user = `[Alpha](tg://user?id=${GetID("alpha")})`;
    const s = `Mi ha fatto quel clown di ${user} 🤡\nInsultate pure lui se il bot non funziona 😜`;
    tgbot.sendMessage(msg.chat.id, s, { parse_mode: "MarkdownV2" });
});

tgbot.onText(/^!joke(?:$|\s(\w+)$)/, (msg, match) => {
    const type = match[1] || "safe";

    let url = "https://v2.jokeapi.dev/joke/";
    switch (type.toLowerCase()) {
        case "program":
        case "coding":
        case "code":
        case "programming":
            url += "Programming";
            break;
        case "dark":
            url += "Dark";
            break;
        case "any":
            url += "Any";
            break;
        default:
            url += "Any?safe-mode";
            break;
    }

    fetch(url)
        .then((res) => res.json().catch(() => undefined))
        .then((data) => {
            if (data) {
                if (data.type === "single") {
                    tgbot.sendMessage(msg.chat.id, data.joke);
                } else if (data.type === "twopart") {
                    tgbot.sendMessage(msg.chat.id, `${data.setup}\n\n${data.delivery}`);
                } else {
                    return Promise.reject();
                }
            } else {
                return Promise.reject();
            }
        })
        .catch(() => tgbot.sendMessage(msg.chat.id, "Nessuna barzelletta trovata, sry 😢"));
});

tgbot.onText(/^!kebab/, (msg) => {
    const s = "A me non me ne frega un cazzo, c'annamo a pija un kebab?!";
    tgbot.sendMessage(msg.chat.id, s);
});

tgbot.onText(/^[!/](?:gamechangers|vct|torneo)/i, (msg) => {
    let s = "*Effy* parteciperà ai *Game Changers* con il team _*5IQ*_\n";
    s += "Le qualifiche si terranno il *25/04* e il *26/04* delle *18:00* in poi\n\n";
    s += "Andate numerosi a supportarle e tifare per loro 💪";
    tgbot.sendMessage(msg.chat.id, s, {
        parse_mode: "MarkdownV2",
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "Team",
                        url: "https://www.vct.gg/leagues/vct22_gamechangers/2455-series-2/teams/183225-5iq",
                    },
                    {
                        text: "Twitter",
                        url: "https://twitter.com/5IQVALORANT",
                    },
                ],
                [
                    {
                        text: "Torneo",
                        url: "https://www.vct.gg/leagues/vct22_gamechangers/2455-series-2",
                    },
                ],
            ],
        },
    });
});

tgbot.onText(/^[!/]gamechangers1/i, (msg) => {
    let s = "Ho partecipato ai primi *Game Changers* con la mix *REJECTED*\n";
    s += "Sfortunatamente non ci siamo qualificate, ci troverete più pronte e forti che mai la prossima volta 💪";
    tgbot.sendMessage(msg.chat.id, s, {
        parse_mode: "MarkdownV2",
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "Team",
                        url: "https://www.vct.gg/leagues/vct22_gamechangers/2451-series-1/teams/177483-rejected",
                    },
                ],
                [
                    {
                        text: "Torneo",
                        url: "https://www.vct.gg/leagues/vct22_gamechangers/2451-series-1",
                    },
                ],
            ],
        },
    });
});

tgbot.onText(/^[!/](?:team|mix)/i, (msg) => {
    let s =
        "Al momento fanno parte del team _*5IQ*_ e si alleniamo duramente per le prossime competizioni, mi raccomando quando sarà il momento andate a tifare";
    tgbot.sendMessage(msg.chat.id, s, { parse_mode: "MarkdownV2" });
});

tgbot.onText(/^!gbw/i, (msg) => {
    tgbot.sendPhoto(msg.chat.id, `${SRC_PATH}/imgs/gbw_team.jpg`, {
        caption:
            "Le GBW in tutto il loro splendore.\nEffy (centro), Pixie (basso destra), Cath (basso sinistra), Reshi (alto destra) e Mochi(alto sinistra)",
        contentType: "image/jpeg",
    });
});

tgbot.onText(/^!boss/i, (msg) => {
    tgbot.sendPhoto(msg.chat.id, `${SRC_PATH}/imgs/effyclown.jpg`, { contentType: "image/jpeg" });
});

tgbot.onText(/^!libro/, (msg) => {
    tgbot.sendPhoto(msg.chat.id, `${SRC_PATH}/imgs/laGnoccaNelBosco.png`, {
        contentType: "image/png",
        parse_mode: "HTML",
        caption:
            "Addentrati anche te in questo incredibile romanzo, dall'autrice di best seller <b><i>Seffyra J. Effy</i></b>.\nUna esperienza seducente che vi terrà incollati alle pagine di questa storia emozionante per i prossimi giorni.\nDa oggi nelle maggiori ClownLibrerie. 📕",
    });
});

tgbot.onText(/^!rankimg/, (msg) => {
    tgbot.sendPhoto(msg.chat.id, `${SRC_PATH}/imgs/effyrank.png`, {
        caption: "Radiant nel Cuore",
        contentType: "image/png",
    });
});

const prayges = new RandomArray([
    "Ricordati sempre di lodare i piedi. 🙏",
    "Ricordati sempre di lodare le calze. 🙏",
    "Ricordati sempre di lodare le boobies. 🙏",
    "Ricordati sempre di lodare i meme. 🙏",
    "Ricordati sempre di lodare i 18cm di Effy. 🙏",
    "Ricordati sempre di lodare la pizza. 🙏",
    "Ricordati sempre di lodare le GBW. 🙏",
]);
tgbot.onText(/^!prayge/, (msg) => {
    const prayge = RandomArrayStore.add(`prayge-${msg.chat.id}`, prayges);

    tgbot.sendMessage(msg.chat.id, prayge.next());
});

const curses = new RandomArray([
    "Perdindirindina 😡",
    "Acciderbolina 😡",
    "Perbacco 😡",
    "Porto io... i nuggets 😡",
    "Porca porchetta 😡",
    "Arcipigna 😡",
    "Anubi il dio sciacallo 😡",
    "Grande Giove 😡",
    "Quella bravissima signora del piano di sopra 😡",
    "Come una foglia, in un albero, d'inverno... Secca 😡",
    "Lode e basta, senza il 30 😡",
    "Chi ha tempo lo perdi pure 😡",
    "Ma porco me stesso 😡",
    "😡",
    "Ai miei tempi saltavo i fossi per lungo, guarda come siamo finiti 😡",
    "Il knife glitchpop fa cacare 😡",
    "Che schifo le boobies 😡",
]);
tgbot.onText(/^!imprecazione/, (msg) => {
    const course = RandomArrayStore.add(`course-${msg.chat.id}`, curses);

    tgbot.sendMessage(msg.chat.id, course.next());
});

tgbot.onText(/^!indirizzoEffy/i, (msg) => {
    const s = "Casa sua 😆";
    tgbot.sendMessage(msg.chat.id, s, { parse_mode: "HTML" });
});

tgbot.onText(/^!(?:twizkygovi|govitwizky)/i, (msg) => {
    const s =
        "Le leggende narrano che nelle notti più limpide e silenziose, prestando particolare attenzione, te riesca ancora a sentire <b>Twizky</b> e <b>GovernoLadro</b> parlare.\nQuel fatidico giorno il loro potere è stato tale da riuscire a curvare lo spazio-tempo e far riecheggiare in eterno le loro voci.\n\n~ Clown Anonimo 04:02";
    tgbot.sendMessage(msg.chat.id, s, { parse_mode: "HTML" });
});

tgbot.onText(/^[!/](?:posta|form)/i, (msg) => {
    const s = "Scrivi ad Effy i tuoi dubbi/pensieri/problemi in anonimo\nCompila questo semplice form";

    tgbot.sendMessage(msg.chat.id, s, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [[{ text: "Form", url: "https://shorturl.me/FzlO0" }]],
        },
    });
});

tgbot.onText(/^!comestai/i, (msg) => {
    const s = "Seduta o a letto, dipende 😆";
    tgbot.sendMessage(msg.chat.id, s, { parse_mode: "HTML" });
});

function sendLastYoutube(chatID) {
    const videoID = "3Al56F8vaPs";
    const s = `Come non hai ancora visto l'ultimo video?!\nNon mi fare arrabbiare eh! 😆\nhttps://www.youtube.com/watch?v=${videoID}`;
    return tgbot.sendMessage(chatID, s, { parse_mode: "HTML" });
}

tgbot.onText(/^[!/]video/, (msg) => {
    sendLastYoutube(msg.chat.id);
});

function getValVersion() {
    // const api = "https://rssbridge.boldair.dev/?action=display&bridge=Twitter&context=By+username&u=CheckValor&norep=on&noretweet=on&nopinned=on&nopic=on&noimg=on&format=Json"
    // const api = "https://nitter.net/CheckValor/rss" -> xml to json
    // const api = "https://api.henrikdev.xyz/valorant/v1/version/eu";
    const api = "https://valorant-api.com/v1/version";
    return fetchJSON(api).then((data) => {
        if (data?.status == 200) {
            return Promise.resolve(data.data);
        } else {
            return Promise.reject(data);
        }
    });
}

var lastValVersion;
function isValUpdated() {
    getValVersion()
        .then((ver) => {
            if (!ver.version) {
                throw new Error(ver);
            }
            if (!lastValVersion) {
                lastValVersion = ver.version;
            }
            if (lastValVersion === ver.version) {
                return;
            }

            console.log(new Date(), "| NewValVersion ->", lastValVersion, "=>", ver.version);

            const splitLastVer = lastValVersion.split(".");
            const splitVer = ver.version.split(".");

            lastValVersion = ver.version;

            let s = "Avviso la gentile clientela che";
            if (splitLastVer[0] !== splitVer[0] || splitLastVer[1] !== splitVer[1]) {
                s += ` la patch <b>${splitVer[0]}.${splitVer[1]}</b> di Valorant è uscita per l'Europa!\nSu su andate a scaricarla!`;
            } else {
                s += " è uscito un <b>hotfix</b> per Valorant!\nSu su andate a scaricarlo!";
            }

            for (const chatid of GetID("group")) {
                tgbot.sendMessage(chatid, s, { parse_mode: "HTML" });
            }
        })
        .catch(console.error);
}
if (CHECK_VAL_UPDATE) {
    isValUpdated();
    setInterval(isValUpdated, 1000 * 60 * 15); // mill * sec * min
}

tgbot.onText(/^[!/]valversion$/i, (msg) => {
    getValVersion()
        .then((ver) => {
            if (!ver.version) {
                throw new Error(ver);
            }

            tgbot.sendMessage(msg.chat.id, `Versione: ${ver.version}`, { parse_mode: "HTML" });
        })
        .catch((err) => {
            console.error(err);
        });
});

function getLastPatchNotes() {
    const api = "https://api.henrikdev.xyz/valorant/v1/website/it-it";
    return fetchJSON(api).then((data) => {
        if (data?.status == 200) {
            const res = data.data.filter(
                (el) =>
                    el.category == "game_updates" &&
                    el.external_link === null &&
                    el.title.toLowerCase().startsWith("note")
            )[0];
            return Promise.resolve(res);
        } else {
            return Promise.reject(data);
        }
    });
}

tgbot.onText(/^[!/]last(?:$|\s(\w+)$)/, (msg, match) => {
    const type = match?.[1];

    switch (type?.toLowerCase()) {
        case "video":
            sendLastYoutube(msg.chat.id);
            break;
        case "patch": {
            getLastPatchNotes()
                .then((patch) => {
                    if (!patch.url) {
                        throw new Error(patch);
                    }
                    tgbot.sendMessage(msg.chat.id, s, { parse_mode: "HTML" });
                    const s = `${patch.title}\n${patch.url}`;
                })
                .catch(console.error);
            break;
        }
        default:
            tgbot.sendMessage(msg.chat.id, "Last cosa?! Mele? Pere? Patate? Eh!? Eh!?", { parse_mode: "HTML" });
    }
});

tgbot.onText(/^[!/]patchnotes?$/i, (msg) => {
    getLastPatchNotes()
        .then((patch) => {
            if (!patch.url) {
                throw new Error(patch);
            }
            const s = `${patch.title}\n${patch.url}`;
            tgbot.sendMessage(msg.chat.id, s, { parse_mode: "HTML" });
        })
        .catch(console.error);
});

tgbot.onText(/^[!/]rank(?:$|\s(?<id>(?<uname>.+)#(?<tag>.+))$)/, (msg, match) => {
    const uname = (match?.groups?.uname || "IQ Effy").trim();
    const tag = (match?.groups?.tag || "6969").trim();

    fetchJSON(`https://api.henrikdev.xyz/valorant/v2/mmr/eu/${uname}/${tag}`)
        .then((rank) => {
            if (rank?.status != 200) {
                throw new Error(rank);
            }
            const s = `Al momento ${rank.data.name} è: ${rank.data.current_data.currenttierpatched} (${rank.data.current_data.ranking_in_tier}rr)`;
            tgbot.sendMessage(msg.chat.id, s, { parse_mode: "HTML" });
        })
        .catch(() => {
            // console.error(error);
            tgbot.sendMessage(msg.chat.id, "Giocatore non trovato o server occupati", { parse_mode: "HTML" });
        });
});

tgbot.onText(/^[!/](?:social|sc)$/i, (msg) => {
    const links = [
        { text: "Twitch", url: "https://www.twitch.tv/seffyra", icon: "" },
        { text: "Instagram", url: "https://www.instagram.com/seffyraa", icon: "" },
        { text: "Twitter", url: "https://twitter.com/Seffyraa", icon: "" },
        { text: "Youtube", url: "https://www.youtube.com/channel/UCOZ2RMDl-bWbquJkBB1BFGw", icon: "" },
        { text: "Reddit", url: "https://www.reddit.com/r/EffysCircus", icon: "" },
        { text: "Onlyfans", url: "https://shorturl.me/bznyUgx", icon: "" },
    ];
    tgbot.sendMessage(msg.chat.id, "Tutti i social del nostro BOSS, corri a seguirli!", {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: links.map((el) => [{ text: el.text, url: el.url }]),
        },
    });
});

tgbot.onText(/^[!/]sendnotify(?:$|\s(\w+)$)/, (msg, match) => {
    if (msg.from.id !== GetID("alpha")) {
        return;
    }

    const streamer = match[1] || "seffyra";

    sendStreamPhoto(streamer, GetID("group"));
});

const alertDates = [];

tgbot.onText(/^[!/]testdates/, (msg) => {
    if (msg.from.id !== GetID("alpha")) {
        return;
    }

    if (alertDates.length == 0) {
        tgbot.sendMessage(msg.chat.id, "No dates.");
        return;
    }

    for (const d of alertDates) {
        tgbot.sendMessage(msg.chat.id, d.msg || "", d.options || {});
    }
});

for (const d of alertDates) {
    alarm(d.date, () => {
        for (const chatId of d.sendTo || GetID("group")) {
            tgbot.sendMessage(chatId, d.msg || "", d.options || {});
        }
    });
}

// App
const app = express();

app.use(express.json({ extended: false }));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    next();
});

app.get("/", (req, res) => {
    res.sendStatus(403);
});

var lastNotify = null;
app.post("/", (req, res) => {
    if (isTwitchEventsubRequest(req.headers)) {
        if (verifyTwitchRequest(req)) {
            if (req.body.challenge) {
                res.write(req.body.challenge);
            } else {
                switch (req.headers?.["twitch-eventsub-subscription-type"]) {
                    case "stream.online":
                        if (
                            req.headers?.["twitch-eventsub-message-retry"] === "0" &&
                            (!lastNotify || dayjs().isAfter(lastNotify.add(15, "m"), "m"))
                        ) {
                            sendStreamPhoto(req.body.event.broadcaster_user_name.toLowerCase(), GetID("group"))
                                .then((tgres) => {
                                    res.json({ success: !!tgres });
                                    lastNotify = dayjs();
                                })
                                .catch(() => res.status(500).json({ success: false, error: "Error." }));
                        } else {
                            res.sendStatus(200);
                        }
                        break;
                    default:
                        res.status(400).json({ success: false, error: "Type not found." });
                        break;
                }
            }
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

var useHTTPS = true;
const certfiles = {
    key: `${SRC_PATH}/keys/privkey.pem`,
    cert: `${SRC_PATH}/keys/cert.pem`,
    ca: `${SRC_PATH}/keys/chain.pem`,
};
for (const key in certfiles) {
    if (!fs.existsSync(certfiles[key])) {
        useHTTPS = false;
        break;
    }
}

if (useHTTPS) {
    const options = {
        key: fs.readFileSync(certfiles["key"], "utf8"),
        cert: fs.readFileSync(certfiles["cert"], "utf8"),
        ca: fs.readFileSync(certfiles["ca"], "utf8"),
    };

    https
        .createServer(options, app)
        .listen(PORT + 443, HOST, () => log(`Server HTTPS started on ${HOST}:${PORT + 443}`));
}

http.createServer(app).listen(PORT, HOST, () => log(`Server HTTP started on ${HOST}:${PORT}`));
