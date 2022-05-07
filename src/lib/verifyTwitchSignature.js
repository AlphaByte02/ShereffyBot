import crypto from "crypto";

// Notification request headers
const TWITCH_MESSAGE_ID = "Twitch-Eventsub-Message-Id".toLowerCase();
const TWITCH_MESSAGE_TIMESTAMP = "Twitch-Eventsub-Message-Timestamp".toLowerCase();
const TWITCH_MESSAGE_SIGNATURE = "Twitch-Eventsub-Message-Signature".toLowerCase();

const TWITCH_EVENTSUB_SECRET = process.env.TWITCH_EVENTSUB_SECRET || "";

// Prepend this string to the HMAC that's created from the message
const HMAC_PREFIX = "sha256=";

// Build the message used to get the HMAC.
function getHmacMessage(request) {
    return (
        request.headers[TWITCH_MESSAGE_ID] + request.headers[TWITCH_MESSAGE_TIMESTAMP] + JSON.stringify(request.body)
    );
}

// Get the HMAC.
function getHmac(secret, message) {
    return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

export function buildTwitchHmac(request) {
    return HMAC_PREFIX + getHmac(TWITCH_EVENTSUB_SECRET, getHmacMessage(request));
}

// Verify whether your signature matches Twitch's signature.
export function verifyTwitchMessage(twitchHmac, verifyTwitchSignature) {
    return crypto.timingSafeEqual(Buffer.from(twitchHmac), Buffer.from(verifyTwitchSignature));
}

export function verifyTwitchRequest(request) {
    return verifyTwitchMessage(buildTwitchHmac(request), request.headers[TWITCH_MESSAGE_SIGNATURE]);
}
