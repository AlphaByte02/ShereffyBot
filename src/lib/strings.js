export function escapeRegExp(string) {
    // eslint-disable-next-line no-useless-escape
    return string.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

export function trim(string, chars = " ") {
    if (!string || typeof string !== "string") {
        return string;
    }

    var escapedChars = escapeRegExp(chars);
    var regEx = new RegExp("^[" + escapedChars + "]+|[" + escapedChars + "]+$", "g");
    return string.replace(regEx, "");
}

export function trimRight(string, chars = " ") {
    if (!string || typeof string !== "string") {
        return string;
    }

    var escapedChars = escapeRegExp(chars);
    var regEx = new RegExp("[" + escapedChars + "]+$", "g");
    return string.replace(regEx, "");
}

export function sanitizeMarkdown(string) {
    if ((string || null) === null || typeof string !== "string") {
        return string;
    }

    return string.replace(/[_*!.]/g, "\\$&");
}

export function toTitleCase(string, convertSpaceTo = false) {
    if (!string || typeof string !== "string") {
        return string;
    }

    string = string.toLowerCase();
    string = string.replace(/_|-/gi, " ");
    string = string.replace(/(^|\s)\S/g, (char) => char.toUpperCase());
    if (convertSpaceTo === " " || convertSpaceTo === false) {
        return string;
    }

    return string.replace(/\s/gi, convertSpaceTo);
}

export function toCamelCase(string, convertSpaceTo = false) {
    if (!string || typeof string !== "string") {
        return string;
    }

    string = toTitleCase(string, convertSpaceTo);
    string = string.charAt(0).toLowerCase() + string.substr(1);

    return string;
}

export function createQueryParams(data) {
    const params = new URLSearchParams();
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            params.append(key, data[key]);
        }
    }

    return params.toString();
}
