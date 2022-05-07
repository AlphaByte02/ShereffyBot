import fetch from "node-fetch";
import dayjs from "dayjs";

import { createQueryParams, trimRight } from "./strings.js";

export function isTwitchEventsubRequest(headers) {
    return (
        "twitch-eventsub-message-id" in headers &&
        "twitch-eventsub-message-timestamp" in headers &&
        "twitch-eventsub-message-signature" in headers
    );
}

export function isEmpty(element) {
    if ((element || null) === null) {
        return true;
    }

    switch (typeof element) {
        case "object":
            if (Array.isArray(element)) {
                return element.length === 0;
            } else {
                for (let i in element) {
                    return false;
                }
                return true;
            }
        default:
            return false;
    }
}

export function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

export function log(...element) {
    console.log(dayjs().format(), "-->", ...element);
}

export async function fetchJSON(url, data = {}, type = "GET", headers = null) {
    type = type.toUpperCase();

    if (isEmpty(headers)) {
        headers = {
            Accept: "application/json",
            "Content-Type": "application/json",
        };
    }

    var obj = {
        method: type,
        headers: headers,
    };

    if (["POST", "PUT", "PATCH"].includes(type)) {
        obj.body = JSON.stringify({ ...data });
    } else if (["GET"].includes(type) && !isEmpty(data)) {
        url = trimRight(url, " /") + "?" + createQueryParams(data);
    }

    const r = await fetch(url, obj).catch(() => null);
    const json = await r?.json()?.catch(() => null);
    // console.log(url, r, json);

    if (!r?.ok && isEmpty(json)) {
        return Promise.reject(r ? { status: r?.status, stautsText: r?.statusText } : undefined);
    }

    if (!r?.ok && !isEmpty(json)) {
        return Promise.reject(json);
    }

    return Promise.resolve(json);
}

export function alarm(date, callback) {
    if (typeof date === "string") {
        date = dayjs(date);
        if (typeof date === "string") {
            return false;
        }
    } else if (!dayjs.isDayjs(date)) {
        date = dayjs(date);
        if (!date.isValid()) {
            return false;
        }
    }

    const now = dayjs();
    if (date.isBefore(now)) {
        return false;
    } else if (date.isSame(now)) {
        callback();
    }

    return setLongTimeout(callback, date.diff(now));
}

export async function setLongTimeout(callback, time, callbackArguments) {
    if (!callback || typeof callback !== "function") {
        throw new Error("Invalid Callback");
    }

    const args =
        callbackArguments && typeof callbackArguments === "object" && callbackArguments.length > 0
            ? callbackArguments
            : [];
    const max = 2147483647;
    if (time > max) {
        let t = Math.floor(time / max);
        let r = time % max;
        for (let i = 0; i < t; i++) {
            await (() => new Promise((res) => setTimeout(() => res(), max)))();
        }
        if (r) {
            return setTimeout(() => callback(...args), r);
        } else {
            return callback(...args);
        }
    } else {
        return setTimeout(() => callback(...args), time);
    }
}
