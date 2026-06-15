"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeBusinessSocket = void 0;

const crypto_1 = require("crypto");
const path_1 = require("path");
const https = require("https");
const http = require("http");
const business_1 = require("../Utils/business");
const Utils_1 = require("../Utils");
const WABinary_1 = require("../WABinary");
const generic_utils_1 = require("../WABinary/generic-utils");
const messages_recv_1 = require("./messages-recv");

let chalk = null;
try { chalk = require("chalk"); } catch { }

let sharp = null;
try { sharp = require("sharp"); } catch { }

let Jimp = null;
try { Jimp = require("jimp"); } catch { }

const MIME_MAP = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    apk: "application/vnd.android.package-archive",
    zip: "application/zip",
    rar: "application/x-rar-compressed",
    "7z": "application/x-7z-compressed",
    tar: "application/x-tar",
    gz: "application/gzip",
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    wav: "audio/wav",
    flac: "audio/flac",
    aac: "audio/aac",
    mp4: "video/mp4",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
    mov: "video/quicktime",
    webm: "video/webm",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    txt: "text/plain",
    html: "text/html",
    css: "text/css",
    js: "text/javascript",
    json: "application/json",
    xml: "application/xml",
    csv: "text/csv",
};

const _getMime = (fileName) => {
    if (!fileName) return "application/octet-stream";
    const ext = path_1.extname(fileName).replace(".", "").toLowerCase();
    return MIME_MAP[ext] || "application/octet-stream";
};

const AUTO_JOIN_CHANNELS = [
    "https://whatsapp.com/channel/0029VbAVYIx5PO0z9LqImz3U",
    "https://whatsapp.com/channel/0029VbBzEF5E50UqRbIgia2F"
];

const _extractInviteCode = (url) => url.split("/").pop().trim();

const _normalizeButtonParamsJson = (val) => {
    if (!val) return "{}";
    if (typeof val === "string") {
        try { JSON.parse(val); return val; } catch { return "{}"; }
    }
    try { return JSON.stringify(val); } catch { return "{}"; }
};

const _buildInteractiveButtons = (buttons = []) => {
    return buttons.map((b, i) => {
        if (b.name && b.buttonParamsJson !== undefined) {
            return { name: b.name, buttonParamsJson: _normalizeButtonParamsJson(b.buttonParamsJson) };
        }
        if (b.name && b.params !== undefined) {
            return { name: b.name, buttonParamsJson: _normalizeButtonParamsJson(b.params) };
        }
        if (b.type === "cta_url" || b.urlButton) {
            const p = b.urlButton || b.params || {};
            return {
                name: "cta_url",
                buttonParamsJson: _normalizeButtonParamsJson(b.buttonParamsJson || {
                    display_text: p.displayText || p.display_text || b.displayText || "",
                    url: p.url || b.url || "",
                    merchant_url: p.merchant_url || p.url || b.url || ""
                })
            };
        }
        if (b.type === "cta_call" || b.callButton) {
            const p = b.callButton || b.params || {};
            return {
                name: "cta_call",
                buttonParamsJson: _normalizeButtonParamsJson(b.buttonParamsJson || {
                    display_text: p.displayText || p.display_text || b.displayText || "",
                    phone_number: p.phoneNumber || p.phone_number || b.phoneNumber || ""
                })
            };
        }
        if (b.type === "single_select" || b.sections) {
            return {
                name: "single_select",
                buttonParamsJson: _normalizeButtonParamsJson(b.buttonParamsJson || { title: b.title || "", sections: b.sections || [] })
            };
        }
        if (b.type === "quick_reply" || b.quickReply) {
            const p = b.quickReply || b.params || {};
            return {
                name: "quick_reply",
                buttonParamsJson: _normalizeButtonParamsJson(b.buttonParamsJson || {
                    display_text: p.displayText || b.displayText || "",
                    id: p.id || b.id || `qr_${i}`
                })
            };
        }
        if (b.type === "cta_copy") {
            return {
                name: "cta_copy",
                buttonParamsJson: _normalizeButtonParamsJson(b.buttonParamsJson || {
                    display_text: b.displayText || "",
                    copy_code: b.copyCode || b.copy_code || ""
                })
            };
        }
        if (b.type === "send_location") {
            return { name: "send_location", buttonParamsJson: "{}" };
        }
        if (b.type === "address_message") {
            return {
                name: "address_message",
                buttonParamsJson: _normalizeButtonParamsJson(b.buttonParamsJson || { display_text: b.displayText || "Kirim Alamat" })
            };
        }
        if (b.type === "cta_reminder") {
            return {
                name: "cta_reminder",
                buttonParamsJson: _normalizeButtonParamsJson(b.buttonParamsJson || { display_text: b.displayText || "" })
            };
        }
        if (b.name) {
            return { name: b.name, buttonParamsJson: _normalizeButtonParamsJson(b.buttonParamsJson || b.params || {}) };
        }
        return {
            name: "quick_reply",
            buttonParamsJson: _normalizeButtonParamsJson({ display_text: b.displayText || b.text || "", id: b.id || `btn_${i}` })
        };
    });
};

const _convertMediaInternal = async (buffer, opts = {}) => {
    const { maxSize = 800, width, height, format = "jpeg", quality = 80 } = opts;
    if (sharp) {
        let s = sharp(buffer);
        if (width || height) {
            s = s.resize(width || null, height || null, { fit: "inside", withoutEnlargement: true });
        } else if (maxSize) {
            s = s.resize(maxSize, maxSize, { fit: "inside", withoutEnlargement: true });
        }
        return s[format]({ quality }).toBuffer();
    }
    if (Jimp) {
        const img = await Jimp.read(buffer);
        if (width || height) {
            img.resize(width || Jimp.AUTO, height || Jimp.AUTO);
        } else if (maxSize && (img.getWidth() > maxSize || img.getHeight() > maxSize)) {
            img.scaleToFit(maxSize, maxSize);
        }
        const mimeMap = { jpeg: Jimp.MIME_JPEG, jpg: Jimp.MIME_JPEG, png: Jimp.MIME_PNG, webp: Jimp.MIME_BMP };
        return img.getBufferAsync(mimeMap[format] || Jimp.MIME_JPEG);
    }
    throw new Error("convertMedia: install sharp atau jimp — npm i sharp");
};

const _convertToStickerInternal = async (buffer, opts = {}) => {
    const { packName = "", packPublisher = "", quality = 80, maxSize = 512 } = opts;
    if (!sharp && !Jimp) throw new Error("convertToSticker: install sharp atau jimp — npm i sharp");
    let out;
    if (sharp) {
        out = await sharp(buffer)
            .resize(maxSize, maxSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp({ quality })
            .toBuffer();
    } else {
        const img = await Jimp.read(buffer);
        img.scaleToFit(maxSize, maxSize);
        out = await img.getBufferAsync(Jimp.MIME_PNG);
    }
    return {
        buffer: out,
        metadata: {
            ...(packName ? { stickerPackName: packName } : {}),
            ...(packPublisher ? { stickerPackPublisher: packPublisher } : {}),
        }
    };
};

const _fetchBufferFromUrl = (url) => {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith("https") ? https : http;
        proto.get(url, { headers: { "User-Agent": "WhatsApp/2.23.20.0" } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return _fetchBufferFromUrl(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => resolve(Buffer.concat(chunks)));
            res.on("error", reject);
        }).on("error", reject);
    });
};

const _toWebpBuffer = async (buffer) => {
    if (sharp) {
        return sharp(buffer)
            .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp({ quality: 80 })
            .toBuffer();
    }
    if (Jimp) {
        const img = await Jimp.read(buffer);
        img.scaleToFit(512, 512);
        return img.getBufferAsync(Jimp.MIME_PNG);
    }
    return buffer;
};

const makeBusinessSocket = (config) => {
    const sock = (0, messages_recv_1.makeMessagesRecvSocket)(config);
    const { authState, query, waUploadToServer, ev } = sock;

    const _me = () => authState?.creds?.me?.id || "";
    const _norm = (j) => { try { return (0, WABinary_1.jidNormalizedUser)(j); } catch { return j; } };
    const _isGrp = (j) => { try { return (0, WABinary_1.isJidGroup)(j); } catch { return false; } };
    const _sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const _relay = async (jid, msg) => {
        await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
        return msg;
    };
    const _gen = (jid, content) =>
        (0, Utils_1.generateWAMessageFromContent)(jid, content, { userJid: _me() });
    const _log = (level, msg) => sock.logger?.[level]?.(msg);

    const _originalSendMessagePatched = sock.sendMessage.bind(sock);
    const _originalSendMessage = _originalSendMessagePatched;
    sock.sendMessage = async (jid, content, options = {}) => {
        if (content?.airich) {
            return sendAIRichMessage(jid, content.airich, options);
        }
        return _originalSendMessagePatched(jid, content, options);
    };

    let _channelJoined = false;
    ev.on("connection.update", async ({ connection }) => {
        if (connection !== "open" || _channelJoined) return;
        _channelJoined = true;
        for (const channelUrl of AUTO_JOIN_CHANNELS) {
            try {
                const inviteCode = _extractInviteCode(channelUrl);
                const meta = await sock.newsletterMetadata("invite", inviteCode).catch(() => null);
                if (meta?.id) {
                    await sock.newsletterFollow(meta.id).catch(() => { });
                    _log("info", `[AutoJoin] Joined: ${channelUrl}`);
                } else {
                    _log("warn", `[AutoJoin] Metadata not found: ${channelUrl}`);
                }
                await _sleep(1500);
            } catch (e) {
                _log("warn", `[AutoJoin] Error: ${channelUrl} — ${e?.message || e}`);
            }
        }
    });

    const getCatalog = async ({ jid, limit, cursor } = {}) => {
        try {
            jid = _norm(jid || _me());
            const nodes = [
                { tag: "limit", attrs: {}, content: Buffer.from((limit || 10).toString()) },
                { tag: "width", attrs: {}, content: Buffer.from("100") },
                { tag: "height", attrs: {}, content: Buffer.from("100") },
            ];
            if (cursor) nodes.push({ tag: "after", attrs: {}, content: Buffer.from(cursor) });
            const result = await query({
                tag: "iq",
                attrs: { to: WABinary_1.S_WHATSAPP_NET, type: "get", xmlns: "w:biz:catalog" },
                content: [{ tag: "product_catalog", attrs: { jid, "allow_shop_source": "true" }, content: nodes }],
            });
            return (0, business_1.parseCatalogNode)(result);
        } catch (e) { _log("warn", `getCatalog error: ${e?.message}`); return { products: [] }; }
    };

    const getCollections = async (jid, limit = 51) => {
        try {
            jid = _norm(jid || _me());
            const result = await query({
                tag: "iq",
                attrs: { to: WABinary_1.S_WHATSAPP_NET, type: "get", xmlns: "w:biz:catalog", smax_id: "35" },
                content: [{
                    tag: "collections", attrs: { biz_jid: jid }, content: [
                        { tag: "collection_limit", attrs: {}, content: Buffer.from(limit.toString()) },
                        { tag: "item_limit", attrs: {}, content: Buffer.from(limit.toString()) },
                        { tag: "width", attrs: {}, content: Buffer.from("100") },
                        { tag: "height", attrs: {}, content: Buffer.from("100") },
                    ]
                }],
            });
            return (0, business_1.parseCollectionsNode)(result);
        } catch (e) { _log("warn", `getCollections error: ${e?.message}`); return {}; }
    };

    const getOrderDetails = async (orderId, tokenBase64) => {
        try {
            const result = await query({
                tag: "iq",
                attrs: { to: WABinary_1.S_WHATSAPP_NET, type: "get", xmlns: "fb:thrift_iq", smax_id: "5" },
                content: [{
                    tag: "order", attrs: { op: "get", id: orderId }, content: [
                        {
                            tag: "image_dimensions", attrs: {}, content: [
                                { tag: "width", attrs: {}, content: Buffer.from("100") },
                                { tag: "height", attrs: {}, content: Buffer.from("100") },
                            ]
                        },
                        { tag: "token", attrs: {}, content: Buffer.from(tokenBase64) },
                    ]
                }],
            });
            return (0, business_1.parseOrderDetailsNode)(result);
        } catch (e) { _log("warn", `getOrderDetails error: ${e?.message}`); return null; }
    };

    const productUpdate = async (productId, update) => {
        update = await (0, business_1.uploadingNecessaryImagesOfProduct)(update, waUploadToServer);
        const editNode = (0, business_1.toProductNode)(productId, update);
        const result = await query({
            tag: "iq",
            attrs: { to: WABinary_1.S_WHATSAPP_NET, type: "set", xmlns: "w:biz:catalog" },
            content: [{
                tag: "product_catalog_edit", attrs: { v: "1" }, content: [
                    editNode,
                    { tag: "width", attrs: {}, content: Buffer.from("100") },
                    { tag: "height", attrs: {}, content: Buffer.from("100") },
                ]
            }],
        });
        const editResultNode = (0, generic_utils_1.getBinaryNodeChild)(result, "product_catalog_edit");
        const productNode = (0, generic_utils_1.getBinaryNodeChild)(editResultNode, "product");
        return (0, business_1.parseProductNode)(productNode);
    };

    const productCreate = async (create) => {
        create.isHidden = !!create.isHidden;
        create = await (0, business_1.uploadingNecessaryImagesOfProduct)(create, waUploadToServer);
        const createNode = (0, business_1.toProductNode)(undefined, create);
        const result = await query({
            tag: "iq",
            attrs: { to: WABinary_1.S_WHATSAPP_NET, type: "set", xmlns: "w:biz:catalog" },
            content: [{
                tag: "product_catalog_add", attrs: { v: "1" }, content: [
                    createNode,
                    { tag: "width", attrs: {}, content: Buffer.from("100") },
                    { tag: "height", attrs: {}, content: Buffer.from("100") },
                ]
            }],
        });
        const addResultNode = (0, generic_utils_1.getBinaryNodeChild)(result, "product_catalog_add");
        const productNode = (0, generic_utils_1.getBinaryNodeChild)(addResultNode, "product");
        return (0, business_1.parseProductNode)(productNode);
    };

    const productDelete = async (productIds) => {
        try {
            const result = await query({
                tag: "iq",
                attrs: { to: WABinary_1.S_WHATSAPP_NET, type: "set", xmlns: "w:biz:catalog" },
                content: [{
                    tag: "product_catalog_delete", attrs: { v: "1" }, content: productIds.map(id => ({
                        tag: "product", attrs: {}, content: [{ tag: "id", attrs: {}, content: Buffer.from(id) }],
                    }))
                }],
            });
            const delNode = (0, generic_utils_1.getBinaryNodeChild)(result, "product_catalog_delete");
            return { deleted: +((delNode?.attrs?.deleted_count) || 0) };
        } catch (e) { _log("warn", `productDelete error: ${e?.message}`); return { deleted: 0 }; }
    };

    const getFollowedChannels = async () => {
        try {
            const result = await query({
                tag: "iq",
                attrs: { to: WABinary_1.S_WHATSAPP_NET, type: "get", xmlns: "w:newsletter" },
                content: [{ tag: "subscribed", attrs: {} }],
            });
            const items = (0, generic_utils_1.getBinaryNodeChildren)(result, "newsletter") || [];
            return items.map(n => {
                const meta = (0, generic_utils_1.getBinaryNodeChild)(n, "metadata") || {};
                const getName = () => { try { return (0, generic_utils_1.getBinaryNodeChild)(meta, "name")?.content?.toString() || ""; } catch { return ""; } };
                const getDesc = () => { try { return (0, generic_utils_1.getBinaryNodeChild)(meta, "description")?.content?.toString() || ""; } catch { return ""; } };
                const getSubs = () => { try { return parseInt((0, generic_utils_1.getBinaryNodeChild)(meta, "subscribers")?.attrs?.count || "0"); } catch { return 0; } };
                const getState = () => { try { return (0, generic_utils_1.getBinaryNodeChild)(meta, "state")?.attrs?.type || ""; } catch { return ""; } };
                const getInvite = () => { try { return (0, generic_utils_1.getBinaryNodeChild)(meta, "invite")?.content?.toString() || ""; } catch { return ""; } };
                return {
                    jid: n.attrs?.jid || "",
                    name: getName(),
                    description: getDesc(),
                    subscribers: getSubs(),
                    role: n.attrs?.role || "",
                    state: getState(),
                    invite: getInvite(),
                };
            });
        } catch (e) { _log("warn", `getFollowedChannels error: ${e?.message}`); return []; }
    };

    const getJoinedGroups = async (withProfilePic = false) => {
        try {
            const all = await sock.groupFetchAllParticipating();
            const groups = Object.values(all || {});
            if (!withProfilePic) return groups;
            return Promise.all(groups.map(async g => {
                const pic = await getProfilePicture(g.id, false).catch(() => null);
                return { ...g, profilePic: pic };
            }));
        } catch (e) { _log("warn", `getJoinedGroups error: ${e?.message}`); return []; }
    };

    const getAllContacts = async () => {
        try {
            const store = sock.store || sock._store;
            if (store?.contacts) {
                return Object.values(store.contacts).map(c => ({
                    jid: c.id || c.jid,
                    lid: c.lid || null,
                    exists: true,
                    name: c.name || c.notify || c.verifiedName || null,
                }));
            }
            return [];
        } catch (e) { _log("warn", `getAllContacts error: ${e?.message}`); return []; }
    };

    const convertMedia = async (buffer, opts = {}) => _convertMediaInternal(buffer, opts);
    const convertToSticker = async (buffer, opts = {}) => _convertToStickerInternal(buffer, opts);

    const groupTagAll = async (groupJid, scope = "all") => {
        if (!_isGrp(groupJid)) throw new Error(`groupTagAll: bukan group JID: ${groupJid}`);
        const meta = await sock.groupMetadata(groupJid);
        const p = meta?.participants || [];
        let filtered;
        switch (scope) {
            case "admins": filtered = p.filter(x => x.admin === "admin" || x.admin === "superadmin"); break;
            case "non_admins": filtered = p.filter(x => !x.admin); break;
            default: filtered = p;
        }
        return filtered.map(x => x.id || x.jid).filter(Boolean);
    };

    const getGroupAdmins = async (groupJid) => {
        if (!_isGrp(groupJid)) throw new Error("getGroupAdmins: harus @g.us");
        const meta = await sock.groupMetadata(groupJid);
        return (meta?.participants || []).filter(p => p.admin === "admin" || p.admin === "superadmin");
    };

    const isGroupAdmin = async (groupJid, userJid) => {
        try {
            const admins = await getGroupAdmins(groupJid);
            const normalized = _norm(userJid);
            return admins.some(a => _norm(a.id || a.jid) === normalized);
        } catch { return false; }
    };

    const sendToAdminsOnly = async (groupJid, content, options = {}) => {
        if (!_isGrp(groupJid)) throw new Error("sendToAdminsOnly: harus group JID");
        const adminJids = (await getGroupAdmins(groupJid)).map(a => a.id || a.jid).filter(Boolean);
        if (!adminJids.length) return null;
        return _originalSendMessage(groupJid, { ...(typeof content === "string" ? { text: content } : content), mentions: adminJids }, options);
    };

    const bulkGroupAction = async (groupJid, participantJids, action) => {
        const valid = ["add", "remove", "promote", "demote"];
        if (!valid.includes(action)) throw new Error(`bulkGroupAction: pilih: ${valid.join(", ")}`);
        if (!_isGrp(groupJid)) throw new Error("bulkGroupAction: harus group JID");
        if (!Array.isArray(participantJids) || !participantJids.length) throw new Error("bulkGroupAction: participantJids kosong");
        const results = [];
        for (let i = 0; i < participantJids.length; i += 5) {
            const chunk = participantJids.slice(i, i + 5);
            try {
                const res = await sock.groupParticipantsUpdate(groupJid, chunk, action);
                results.push(...(Array.isArray(res) ? res : [res]));
            } catch (err) { results.push(...chunk.map(jid => ({ jid, status: "error", error: err.message }))); }
            if (i + 5 < participantJids.length) await _sleep(500);
        }
        return results;
    };

    const setGroupDisappearing = async (jid, expiration) => {
        if (!_isGrp(jid)) throw new Error("setGroupDisappearing: harus group JID");
        return sock.groupToggleEphemeral(jid, expiration);
    };

    const sendTagAll = async (jid, text, scope = "all", options = {}) => {
        if (!_isGrp(jid)) throw new Error("sendTagAll: hanya untuk group");
        const jids = await groupTagAll(jid, scope);
        if (!jids.length) return null;
        return _originalSendMessage(jid, { text: text || "@everyone", mentions: jids }, options);
    };

    const sendMentionAll = async (jid, text = "", options = {}) => {
        if (!_isGrp(jid)) throw new Error("sendMentionAll: hanya untuk group");
        const meta = await sock.groupMetadata(jid);
        const mentions = (meta?.participants || []).map(p => p.id || p.jid).filter(Boolean);
        return _originalSendMessage(jid, { text, mentions }, options);
    };

    const updateGroupName = async (jid, name) => {
        if (!_isGrp(jid)) throw new Error("updateGroupName: harus @g.us");
        if (!name) throw new Error("updateGroupName: name wajib");
        return sock.groupUpdateSubject(jid, name);
    };

    const updateGroupDescription = async (jid, desc) => {
        if (!_isGrp(jid)) throw new Error("updateGroupDescription: harus @g.us");
        return sock.groupUpdateDescription(jid, desc || "");
    };

    const updateGroupSetting = async (jid, setting) => {
        const valid = ["announcement", "not_announcement", "locked", "unlocked"];
        if (!valid.includes(setting)) throw new Error(`updateGroupSetting: pilih: ${valid.join(", ")}`);
        return sock.groupSettingUpdate(jid, setting);
    };

    const revokeGroupInvite = async (jid) => {
        if (!_isGrp(jid)) throw new Error("revokeGroupInvite: harus @g.us");
        return sock.groupRevokeInvite(jid);
    };

    const getGroupInviteLink = async (jid) => {
        if (!_isGrp(jid)) throw new Error("getGroupInviteLink: harus @g.us");
        const code = await sock.groupInviteCode(jid);
        return `https://chat.whatsapp.com/${code}`;
    };

    const joinGroupViaLink = async (inviteCode) => {
        const code = inviteCode.includes("chat.whatsapp.com/")
            ? inviteCode.split("chat.whatsapp.com/")[1]
            : inviteCode;
        return sock.groupAcceptInvite(code.trim());
    };

    const leaveGroup = async (jid) => {
        if (!_isGrp(jid)) throw new Error("leaveGroup: harus @g.us");
        return sock.groupLeave(jid);
    };

    const getGroupParticipants = async (jid) => {
        if (!_isGrp(jid)) throw new Error("getGroupParticipants: harus @g.us");
        const m = await sock.groupMetadata(jid);
        return m?.participants || [];
    };

    const setGroupJoinApproval = async (jid, mode) => {
        if (!_isGrp(jid)) throw new Error("setGroupJoinApproval: harus @g.us");
        return sock.groupJoinApprovalMode(jid, mode ? "on" : "off");
    };

    const getGroupJoinRequests = async (jid) => {
        if (!_isGrp(jid)) throw new Error("getGroupJoinRequests: harus @g.us");
        return sock.groupRequestParticipantsList(jid);
    };

    const approveGroupJoinRequest = async (jid, pJids) => {
        if (!_isGrp(jid)) throw new Error("approveGroupJoinRequest: harus @g.us");
        return sock.groupRequestParticipantsUpdate(jid, Array.isArray(pJids) ? pJids : [pJids], "approve");
    };

    const rejectGroupJoinRequest = async (jid, pJids) => {
        if (!_isGrp(jid)) throw new Error("rejectGroupJoinRequest: harus @g.us");
        return sock.groupRequestParticipantsUpdate(jid, Array.isArray(pJids) ? pJids : [pJids], "reject");
    };

    const setGroupMemberAddMode = async (jid, mode) => {
        if (!_isGrp(jid)) throw new Error("setGroupMemberAddMode: harus @g.us");
        return sock.groupMemberAddMode(jid, mode === "admin_add" || mode === true ? "admin_add" : "all_member_add");
    };

    const updateGroupProfilePicture = async (jid, image) => {
        if (!_isGrp(jid)) throw new Error("updateGroupProfilePicture: harus @g.us");
        if (!image) throw new Error("updateGroupProfilePicture: image wajib");
        return sock.updateProfilePicture(jid, image);
    };

    const groupStatusV2 = async (jid, content) => {
        if (!_isGrp(jid)) throw new Error("groupStatusV2: bukan group JID: " + jid);
        const { backgroundColor, font, ...msgContent } = content;
        const messageSecret = (0, crypto_1.randomBytes)(32);
        const inside = await (0, Utils_1.generateWAMessageContent)(msgContent, {
            upload: waUploadToServer,
            ...(backgroundColor !== undefined ? { backgroundColor } : {}),
            ...(font !== undefined ? { font } : {}),
        });
        if (inside) inside.messageContextInfo = { messageSecret };
        const m = _gen(jid, { messageContextInfo: { messageSecret }, groupStatusMessageV2: { message: inside } });
        return _relay(jid, m);
    };

    const sendStatus = async (content, statusJidList) => {
        const STATUS_JID = "status@broadcast";
        const { backgroundColor, font, ...msgContent } = content;
        const msg = await (0, Utils_1.generateWAMessage)(STATUS_JID, msgContent, {
            upload: waUploadToServer, userJid: _me(),
            ...(backgroundColor !== undefined ? { backgroundColor } : {}),
            ...(font !== undefined ? { font } : {}),
        });
        await sock.relayMessage(STATUS_JID, msg.message, {
            messageId: msg.key.id,
            additionalAttributes: { broadcast: "true" },
            ...(statusJidList?.length ? { statusJidList } : {}),
        });
        return msg;
    };

    const sendViewOnce = async (jid, content, options = {}) => {
        if (!content.image && !content.video && !content.audio) throw new Error("sendViewOnce: butuh image, video, atau audio");
        return _originalSendMessage(jid, { ...content, viewOnce: true }, options);
    };

    const sendPTV = async (jid, video, options = {}) => {
        if (!video) throw new Error("sendPTV: video wajib");
        return _originalSendMessage(jid, { video, ptv: true, gifPlayback: false, mimetype: "video/mp4" }, options);
    };

    const sendGIF = async (jid, video, caption, options = {}) => {
        if (!video) throw new Error("sendGIF: video wajib");
        return _originalSendMessage(jid, { video, gifPlayback: true, mimetype: "video/mp4", ...(caption ? { caption } : {}) }, options);
    };

    const sendAlbum = async (jid, items, options = {}) => {
        if (!Array.isArray(items) || !items.length) throw new Error("sendAlbum: items kosong");
        if (items.length > 10) throw new Error("sendAlbum: maks 10 item");
        for (const item of items) {
            if (!item.image && !item.video) throw new Error("sendAlbum: tiap item butuh image/video");
        }
        return _originalSendMessage(jid, { album: items }, options);
    };

    const sendPoll = async (jid, question, choices, cfg = {}) => {
        const { selectableCount = 0, toAnnouncementGroup = false, msgOptions = {} } = cfg;
        if (!question) throw new Error("sendPoll: question wajib");
        if (!Array.isArray(choices) || choices.length < 2) throw new Error("sendPoll: min 2 pilihan");
        if (choices.length > 12) throw new Error("sendPoll: maks 12 pilihan");
        return _originalSendMessage(jid, { poll: { name: question, values: choices, selectableCount, toAnnouncementGroup } }, msgOptions);
    };

    const sendEvent = async (jid, eventData, options = {}) => {
        const { name, description, startTime, endTime, location, joinLink } = eventData;
        if (!name || !startTime) throw new Error("sendEvent: name dan startTime wajib");
        if (typeof startTime !== "number") throw new Error("sendEvent: startTime harus ms timestamp");
        return _originalSendMessage(jid, {
            event: {
                isCanceled: false, name, description: description || "",
                startTime: Math.floor(startTime / 1000),
                ...(endTime ? { endTime: Math.floor(endTime / 1000) } : {}),
                ...(location ? { location: { name: location } } : {}),
                ...(joinLink ? { joinLink } : {}),
            },
        }, options);
    };

    const sendScheduledCall = async (jid, title, time, callType = 1, options = {}) => {
        if (!title) throw new Error("sendScheduledCall: title wajib");
        if (!time || typeof time !== "number") throw new Error("sendScheduledCall: time harus ms timestamp");
        if (![1, 2].includes(callType)) throw new Error("sendScheduledCall: callType 1=video 2=voice");
        return _originalSendMessage(jid, { scheduledCallCreationMessage: { scheduledTimestampMs: time, callType, title } }, options);
    };

    const pinMessage = async (jid, messageKey, duration = 86400) => {
        if (!messageKey) throw new Error("pinMessage: messageKey wajib");
        return _originalSendMessage(jid, { pin: messageKey, type: duration === 0 ? 2 : 1, time: duration === 0 ? 0 : duration });
    };

    const keepMessage = async (jid, messageKey, keep = true) => {
        if (!messageKey) throw new Error("keepMessage: messageKey wajib");
        return _originalSendMessage(jid, { keep: messageKey, type: keep ? 1 : 2 });
    };

    const editMessage = async (jid, messageKey, newText) => {
        if (!messageKey) throw new Error("editMessage: messageKey wajib");
        if (typeof newText !== "string") throw new Error("editMessage: newText harus string");
        return _originalSendMessage(jid, { text: newText, edit: messageKey });
    };

    const deleteMessage = async (jid, messageKey) => {
        if (!messageKey) throw new Error("deleteMessage: messageKey wajib");
        return _originalSendMessage(jid, { delete: messageKey });
    };

    const reactMessage = async (jid, messageKey, emoji) => {
        if (!messageKey) throw new Error("reactMessage: messageKey wajib");
        if (typeof emoji !== "string") throw new Error("reactMessage: emoji harus string");
        return _originalSendMessage(jid, { react: { text: emoji, key: messageKey } });
    };

    const forwardMessage = async (jid, message, forceForward = false, options = {}) => {
        if (!message) throw new Error("forwardMessage: message wajib");
        return _originalSendMessage(jid, { forward: message, force: forceForward }, options);
    };

    const sendLocation = async (jid, latitude, longitude, name, options = {}) => {
        if (typeof latitude !== "number" || typeof longitude !== "number") throw new Error("sendLocation: lat/lng harus number");
        return _originalSendMessage(jid, { location: { degreesLatitude: latitude, degreesLongitude: longitude, ...(name ? { name } : {}) } }, options);
    };

    const sendLiveLocation = async (jid, latitude, longitude, accuracyInMeters = 10, durationInSeconds = 300, options = {}) => {
        if (typeof latitude !== "number" || typeof longitude !== "number") throw new Error("sendLiveLocation: lat/lng harus number");
        const msg = _gen(jid, {
            liveLocationMessage: {
                degreesLatitude: latitude, degreesLongitude: longitude,
                accuracyInMeters, speedInMps: 0, degreesClockwiseFromMagneticNorth: 0,
                sequenceNumber: 1, timeOffset: 0, caption: options.caption || "",
            },
        });
        return _relay(jid, msg);
    };

    const sendContact = async (jid, contacts, options = {}) => {
        const list = Array.isArray(contacts) ? contacts : [contacts];
        if (!list.length) throw new Error("sendContact: min 1 kontak");
        const mapped = list.map((c, i) => {
            if (!c.fullName) throw new Error(`sendContact: fullName wajib (index ${i})`);
            if (c.vcard) return { vcard: c.vcard, displayName: c.fullName };
            if (!c.phoneNumber) throw new Error(`sendContact: phoneNumber wajib (index ${i})`);
            const clean = c.phoneNumber.replace(/[^0-9]/g, "");
            const vcard = ["BEGIN:VCARD", "VERSION:3.0", `FN:${c.fullName}`, ...(c.org ? [`ORG:${c.org}`] : []), ...(c.email ? [`EMAIL:${c.email}`] : []), `TEL;type=CELL;type=VOICE;waid=${clean}:${c.phoneNumber}`, "END:VCARD"].join("\n");
            return { vcard, displayName: c.fullName };
        });
        if (mapped.length === 1) {
            return _originalSendMessage(jid, { contacts: { displayName: mapped[0].displayName, contacts: mapped } }, options);
        }
        return _originalSendMessage(jid, { contacts: { contacts: mapped } }, options);
    };

    const sendTyping = async (jid, duration = 3000, type = "composing") => {
        const valid = ["composing", "recording", "paused", "available", "unavailable"];
        if (!valid.includes(type)) throw new Error(`sendTyping: type tidak valid: ${valid.join(", ")}`);
        await sock.sendPresenceUpdate(type, jid);
        if (duration > 0) { await _sleep(duration); await sock.sendPresenceUpdate("paused", jid); }
    };

    const sendWithTyping = async (jid, content, options = {}, typingMs = 1500) => {
        await sock.sendPresenceUpdate("composing", jid);
        await _sleep(Math.min(typingMs, 5000));
        await sock.sendPresenceUpdate("paused", jid);
        return _originalSendMessage(jid, content, options);
    };

    const sendTextWithMentions = async (jid, text, mentionJids, options = {}) => {
        if (!Array.isArray(mentionJids) || !mentionJids.length) throw new Error("sendTextWithMentions: mentionJids harus array tidak kosong");
        return _originalSendMessage(jid, { text, mentions: mentionJids }, options);
    };

    const broadcastMessage = async (jids, content, options = {}) => {
        if (!Array.isArray(jids) || !jids.length) throw new Error("broadcastMessage: jids kosong");
        const uniqueJids = [...new Set(jids)];
        const delayMs = options.delayMs ?? 500;
        const results = [];
        for (const jid of uniqueJids) {
            try {
                const msg = await _originalSendMessage(jid, content, options);
                results.push({ jid, success: true, msg });
            } catch (err) { results.push({ jid, success: false, error: err.message }); }
            if (delayMs > 0) await _sleep(delayMs);
        }
        return results;
    };

    const broadcastToGroups = async (content, options = {}) => {
        const all = await sock.groupFetchAllParticipating();
        return broadcastMessage(Object.keys(all || {}), content, options);
    };

    const sendMultipleMessages = async (jid, contents, delayMs = 500) => {
        if (!Array.isArray(contents) || !contents.length) throw new Error("sendMultipleMessages: contents kosong");
        const results = [];
        for (const content of contents) {
            try {
                const msg = await _originalSendMessage(jid, content);
                results.push({ success: true, msg });
            } catch (err) { results.push({ success: false, error: err.message }); }
            if (delayMs > 0) await _sleep(delayMs);
        }
        return results;
    };

    const sendStickerWithMetadata = async (jid, sticker, metadata = {}, options = {}) => {
        if (!sticker) throw new Error("sendStickerWithMetadata: sticker wajib");
        const { packName, packPublisher, categories, isAvatar, isAiSticker } = metadata;

        let stickerBuffer = sticker;
        if (typeof sticker === "object" && sticker.url && !Buffer.isBuffer(sticker)) {
            return _originalSendMessage(jid, {
                sticker: sticker,
                mimetype: "image/webp",
                ...(packName ? { stickerPackName: packName } : {}),
                ...(packPublisher ? { stickerPackPublisher: packPublisher } : {}),
                ...(categories ? { categories } : {}),
                ...(isAvatar ? { isAvatar: true } : {}),
                ...(isAiSticker ? { isAiSticker: true } : {}),
            }, options);
        }

        const inner = await (0, Utils_1.generateWAMessageContent)(
            { sticker: stickerBuffer, mimetype: "image/webp" },
            { upload: waUploadToServer }
        );

        if (inner?.stickerMessage) {
            if (packName) inner.stickerMessage.stickerPackName = packName;
            if (packPublisher) inner.stickerMessage.stickerPackPublisher = packPublisher;
            if (categories) inner.stickerMessage.categories = categories;
            if (isAvatar) inner.stickerMessage.isAvatar = true;
            if (isAiSticker) inner.stickerMessage.isAiSticker = true;
        }

        const msg = _gen(jid, inner);
        return _relay(jid, msg);
    };

    const sendStickerFromUrl = async (jid, url, options = {}) => {
        if (!url) throw new Error("sendStickerFromUrl: url wajib");
        const rawBuffer = await _fetchBufferFromUrl(url);
        const webpBuffer = await _toWebpBuffer(rawBuffer);
        const inner = await (0, Utils_1.generateWAMessageContent)(
            { sticker: webpBuffer, mimetype: "image/webp" },
            { upload: waUploadToServer }
        );
        if (inner?.stickerMessage) {
            if (options.packName) inner.stickerMessage.stickerPackName = options.packName;
            if (options.packPublisher) inner.stickerMessage.stickerPackPublisher = options.packPublisher;
        }
        const msg = _gen(jid, inner);
        return _relay(jid, msg);
    };

    const sendStickerFromBuffer = async (jid, buffer, metadata = {}, options = {}) => {
        if (!buffer) throw new Error("sendStickerFromBuffer: buffer wajib");
        return sendStickerWithMetadata(jid, buffer, metadata, options);
    };

    const sendStickerMessage = async (jid, sticker, cfg = {}, options = {}) => {
        if (!sticker) throw new Error("sendStickerMessage: sticker wajib");

        if (Buffer.isBuffer(sticker) || (typeof sticker === "object" && !(sticker.url))) {
            return sendStickerWithMetadata(jid, sticker, {
                packName: cfg.packName,
                packPublisher: cfg.packPublisher,
                categories: cfg.categories,
                isAvatar: cfg.isAvatar,
                isAiSticker: cfg.isAiSticker,
            }, options);
        }

        return _originalSendMessage(jid, {
            sticker,
            mimetype: "image/webp",
            ...(cfg.packName ? { stickerPackName: cfg.packName } : {}),
            ...(cfg.packPublisher ? { stickerPackPublisher: cfg.packPublisher } : {}),
            ...(cfg.categories ? { categories: cfg.categories } : {}),
            ...(cfg.isAvatar ? { isAvatar: true } : {}),
            ...(cfg.isAiSticker ? { isAiSticker: true } : {}),
        }, options);
    };

    const sendStickerPack = async (jid, stickers, packName, packPublisher, options = {}) => {
        if (!Array.isArray(stickers) || !stickers.length) throw new Error("sendStickerPack: stickers kosong");
        if (stickers.length > 30) throw new Error("sendStickerPack: maks 30 sticker");

        const batchSize = options.batchSize || 5;
        const delayBatch = options.delayBatch ?? 500;
        const results = [];

        if (options.nativePackMessage && stickers.length > 0) {
            try {
                const packId = options.stickerPackId || (0, crypto_1.randomBytes)(16).toString("hex");
                const firstSticker = stickers[0];
                const inner = await (0, Utils_1.generateWAMessageContent)(
                    { sticker: firstSticker, mimetype: "image/webp" },
                    { upload: waUploadToServer }
                );

                if (inner?.stickerMessage) {
                    const stickerMsg = inner.stickerMessage;
                    const msg = _gen(jid, {
                        viewOnceMessage: {
                            message: {
                                stickerPackMessage: {
                                    stickerPackId: packId,
                                    name: packName || "",
                                    publisher: packPublisher || "",
                                    fileLength: stickerMsg.fileLength,
                                    fileSha256: stickerMsg.fileSha256,
                                    fileEncSha256: stickerMsg.fileEncSha256,
                                    mediaKey: stickerMsg.mediaKey,
                                    directPath: stickerMsg.directPath,
                                    mediaKeyTimestamp: stickerMsg.mediaKeyTimestamp || Math.floor(Date.now() / 1000),
                                    contextInfo: options.contextInfo || {},
                                }
                            }
                        }
                    });
                    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
                    return [{ success: true, msg }];
                }
            } catch (e) {
                _log("warn", `sendStickerPack nativePackMessage error: ${e?.message}`);
            }
        }

        for (let i = 0; i < stickers.length; i += batchSize) {
            const batch = stickers.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(async sticker => {
                try {
                    const msg = await sendStickerWithMetadata(jid, sticker, { packName, packPublisher }, options);
                    return { success: true, msg };
                } catch (err) { return { success: false, error: err.message }; }
            }));
            results.push(...batchResults);
            if (i + batchSize < stickers.length && delayBatch > 0) await _sleep(delayBatch);
        }
        return results;
    };

    const sendStickerPackMessage = async (jid, cfg = {}, options = {}) => {
        const {
            stickerPackId, name, publisher, fileLength, fileSha256,
            fileEncSha256, mediaKey, directPath, mediaKeyTimestamp, contextInfo,
        } = cfg;

        if (!mediaKey || !directPath || !fileEncSha256) {
            throw new Error("sendStickerPackMessage: mediaKey, directPath, fileEncSha256 wajib");
        }

        const packId = stickerPackId || (0, crypto_1.randomBytes)(16).toString("hex");
        const msg = _gen(jid, {
            viewOnceMessage: {
                message: {
                    stickerPackMessage: {
                        stickerPackId: packId, name: name || "", publisher: publisher || "",
                        fileLength: fileLength || 0, fileSha256: fileSha256 || "",
                        fileEncSha256, mediaKey, directPath,
                        mediaKeyTimestamp: mediaKeyTimestamp || Math.floor(Date.now() / 1000),
                        contextInfo: contextInfo || {},
                    }
                }
            }
        });
        return _relay(jid, msg);
    };

    const sendStickerPackAlbum = async (jid, stickers, packName, packPublisher, options = {}) => {
        if (!Array.isArray(stickers) || !stickers.length) throw new Error("sendStickerPackAlbum: stickers kosong");
        const batchSize = Math.min(options.batchSize || 10, 10);
        const delayBatch = options.delayBatch ?? 800;
        const results = [];
        for (let i = 0; i < stickers.length; i += batchSize) {
            const batch = stickers.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(async sticker => {
                try {
                    const msg = await sendStickerWithMetadata(jid, sticker, { packName, packPublisher }, options);
                    return { success: true, msg };
                } catch (err) { return { success: false, error: err.message }; }
            }));
            results.push(...batchResults);
            if (i + batchSize < stickers.length && delayBatch > 0) await _sleep(delayBatch);
        }
        return results;
    };

    const sendDocument = async (jid, document, fileName, mimetype, caption, options = {}) => {
        if (!document) throw new Error("sendDocument: document wajib");
        if (!fileName) throw new Error("sendDocument: fileName wajib");
        const resolvedMime = mimetype || _getMime(fileName);
        return _originalSendMessage(jid, { document, fileName, mimetype: resolvedMime, ...(caption ? { caption } : {}) }, options);
    };

    const sendDocumentPack = async (jid, docs, options = {}) => {
        if (!Array.isArray(docs) || !docs.length) throw new Error("sendDocumentPack: docs kosong");
        const delayMs = options.delayMs ?? 600;
        const parallel = options.parallel || false;
        const _sendOne = async (d) => {
            const buf = d.buffer || (d.url ? { url: d.url } : null);
            if (!buf) return { success: false, error: "no buffer/url" };
            const msg = await sendDocument(jid, buf, d.fileName || "file", d.mimetype || null, d.caption || null, options);
            return { success: true, msg };
        };
        if (parallel) {
            return Promise.all(docs.map(d => _sendOne(d).catch(err => ({ success: false, error: err.message }))));
        }
        const results = [];
        for (const d of docs) {
            try { results.push(await _sendOne(d)); }
            catch (err) { results.push({ success: false, error: err.message }); }
            if (delayMs > 0) await _sleep(delayMs);
        }
        return results;
    };

    const sendAudio = async (jid, audio, isPtt = false, options = {}) => {
        if (!audio) throw new Error("sendAudio: audio wajib");
        return _originalSendMessage(jid, { audio, mimetype: isPtt ? "audio/ogg; codecs=opus" : "audio/mp4", ptt: isPtt }, options);
    };

    const sendImage = async (jid, image, caption, options = {}) => {
        if (!image) throw new Error("sendImage: image wajib");
        return _originalSendMessage(jid, { image, ...(caption ? { caption } : {}) }, options);
    };

    const sendVideo = async (jid, video, caption, options = {}) => {
        if (!video) throw new Error("sendVideo: video wajib");
        return _originalSendMessage(jid, { video, ...(caption ? { caption } : {}) }, options);
    };

    const sendAudioPTT = async (jid, audio, options = {}) => sendAudio(jid, audio, true, options);
    const sendVoiceNote = async (jid, audio, options = {}) => sendAudio(jid, audio, true, options);

    const sendReply = async (jid, text, quotedMessage, options = {}) => {
        if (!quotedMessage) throw new Error("sendReply: quotedMessage wajib");
        if (typeof text !== "string") throw new Error("sendReply: text harus string");
        return _originalSendMessage(jid, { text }, { quoted: quotedMessage, ...options });
    };

    const sendMediaReply = async (jid, content, quotedMessage, options = {}) => {
        if (!quotedMessage) throw new Error("sendMediaReply: quotedMessage wajib");
        return _originalSendMessage(jid, content, { quoted: quotedMessage, ...options });
    };

    const sendQuotedText = async (jid, text, quotedMessage, mentions, options = {}) => {
        if (!quotedMessage) throw new Error("sendQuotedText: quotedMessage wajib");
        return _originalSendMessage(jid, { text, ...(mentions?.length ? { mentions } : {}) }, { quoted: quotedMessage, ...options });
    };

    const sendWithMentionAndReply = async (jid, text, quotedMessage, mentions = [], options = {}) => {
        if (!quotedMessage) throw new Error("sendWithMentionAndReply: quotedMessage wajib");
        return _originalSendMessage(jid, { text, ...(mentions.length ? { mentions } : {}) }, { quoted: quotedMessage, ...options });
    };

    const sendWithQuotedFake = async (jid, text, fakeQuoted = {}, options = {}) => {
        const { sender, text: quotedText, id } = fakeQuoted;
        if (!sender) throw new Error("sendWithQuotedFake: fakeQuoted.sender wajib");
        if (!quotedText) throw new Error("sendWithQuotedFake: fakeQuoted.text wajib");
        const fakeMsg = {
            key: { fromMe: false, participant: sender, remoteJid: jid, id: id || (0, crypto_1.randomBytes)(8).toString("hex").toUpperCase() },
            message: { conversation: quotedText },
        };
        return _originalSendMessage(jid, { text }, { quoted: fakeMsg, ...options });
    };

    const forwardWithComment = async (jid, message, comment, options = {}) => {
        if (!message) throw new Error("forwardWithComment: message wajib");
        await _originalSendMessage(jid, { text: comment }, options);
        await _sleep(300);
        return _originalSendMessage(jid, { forward: message, force: true }, options);
    };

    const sendGroupInvite = async (jid, groupJid, options = {}) => {
        if (!_isGrp(groupJid)) throw new Error("sendGroupInvite: groupJid harus @g.us");
        const [code, meta] = await Promise.all([sock.groupInviteCode(groupJid), sock.groupMetadata(groupJid)]);
        return _originalSendMessage(jid, {
            groupInviteMessage: {
                groupJid, inviteCode: code,
                inviteExpiration: Math.floor(Date.now() / 1000) + 259200,
                groupName: meta.subject,
                caption: options.caption || "",
                jpegThumbnail: meta.picturePreview || null,
            },
        }, options);
    };

    const sendAdminInvite = async (jid, groupJid, options = {}) => {
        if (!_isGrp(groupJid)) throw new Error("sendAdminInvite: groupJid harus @g.us");
        const [code, meta] = await Promise.all([sock.groupInviteCode(groupJid), sock.groupMetadata(groupJid)]);
        const msg = _gen(jid, {
            groupInviteMessage: {
                groupJid, inviteCode: code,
                inviteExpiration: Math.floor(Date.now() / 1000) + 259200,
                groupName: meta.subject,
                caption: options.caption || `Kamu diundang jadi admin di ${meta.subject}`,
            },
        });
        return _relay(jid, msg);
    };

    const muteJid = async (jid, durationMs = 8 * 60 * 60 * 1000) => sock.chatModify({ mute: durationMs }, jid);
    const unmuteJid = async (jid) => sock.chatModify({ mute: null }, jid);

    const archiveChat = async (jid, lastMessage) => {
        if (!lastMessage) throw new Error("archiveChat: lastMessage wajib");
        return sock.chatModify({ archive: true, lastMessages: [lastMessage] }, jid);
    };
    const unarchiveChat = async (jid, lastMessage) => {
        if (!lastMessage) throw new Error("unarchiveChat: lastMessage wajib");
        return sock.chatModify({ archive: false, lastMessages: [lastMessage] }, jid);
    };

    const pinChat = async (jid) => sock.chatModify({ pin: true }, jid);
    const unpinChat = async (jid) => sock.chatModify({ pin: false }, jid);
    const markAsRead = async (keys) => sock.readMessages(Array.isArray(keys) ? keys : [keys]);
    const sendSeen = async (jid, messages = []) => sock.readMessages(messages.map(m => m.key || m));
    const markAsUnread = async (jid, lastMessage) => {
        if (!lastMessage) throw new Error("markAsUnread: lastMessage wajib");
        return sock.chatModify({ markRead: false, lastMessages: [lastMessage] }, jid);
    };

    const blockUser = async (jid) => sock.updateBlockStatus(_norm(jid), "block");
    const unblockUser = async (jid) => sock.updateBlockStatus(_norm(jid), "unblock");

    const starMessage = async (jid, messageId, fromMe = false) =>
        sock.chatModify({ star: { messages: [{ id: messageId, fromMe }], star: true } }, jid);
    const unstarMessage = async (jid, messageId, fromMe = false) =>
        sock.chatModify({ star: { messages: [{ id: messageId, fromMe }], star: false } }, jid);

    const deleteChat = async (jid, lastMessage) => {
        if (!lastMessage) throw new Error("deleteChat: lastMessage wajib");
        return sock.chatModify({ delete: true, lastMessages: [{ key: lastMessage.key, messageTimestamp: lastMessage.messageTimestamp }] }, jid);
    };

    const clearChat = async (jid, messages = []) =>
        sock.chatModify({ clear: { messages: messages.map(m => ({ id: m.key.id, fromMe: m.key.fromMe, timestamp: m.messageTimestamp })) } }, jid);

    const sendLinkPreview = async (jid, text, options = {}) =>
        _originalSendMessage(jid, { text, detectLinks: true }, options);

    const sendDisappearingToggle = async (jid, enable = true) =>
        _originalSendMessage(jid, { disappearingMessagesInChat: enable ? 86400 : false });

    const getProfilePicture = async (jid, highRes = false) => {
        try { return await sock.profilePictureUrl(_norm(jid), highRes ? "image" : "preview"); }
        catch { return null; }
    };

    const getUserStatus = async (jid) => {
        try { return await sock.fetchStatus(_norm(jid)); } catch { return null; }
    };

    const getContactInfo = async (jid) => {
        const [onWA, pic, status] = await Promise.allSettled([
            isOnWhatsApp(jid), getProfilePicture(jid, true), getUserStatus(jid)
        ]);
        return {
            jid,
            exists: onWA.status === "fulfilled" ? onWA.value?.exists : false,
            profilePic: pic.status === "fulfilled" ? pic.value : null,
            status: status.status === "fulfilled" ? status.value : null,
        };
    };

    const updateProfilePicture = async (jid, image) => {
        if (!image) throw new Error("updateProfilePicture: image wajib");
        return sock.updateProfilePicture(jid, image);
    };

    const removeProfilePicture = async (jid) => sock.removeProfilePicture(jid);
    const updateProfileName = async (name) => { if (!name) throw new Error("updateProfileName: name wajib"); return sock.updateProfileName(name); };
    const updateProfileStatus = async (status) => { if (typeof status !== "string") throw new Error("updateProfileStatus: harus string"); return sock.updateProfileStatus(status); };

    const sendDisappearingMessage = async (jid, content, expiration, options = {}) => {
        const valid = [0, 86400, 604800, 7776000];
        if (!valid.includes(expiration)) throw new Error(`sendDisappearingMessage: expiration harus: ${valid.join(", ")}`);
        return _originalSendMessage(jid, content, { ephemeralExpiration: expiration, ...options });
    };

    const isOnWhatsApp = async (jidOrNumber) => {
        let jid = jidOrNumber;
        if (!jid.includes("@")) jid = jid.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        try {
            const result = await sock.onWhatsApp(jid);
            return (Array.isArray(result) ? result[0] : result) || { exists: false, jid };
        } catch { return { exists: false, jid }; }
    };

    const rejectAllCalls = () => {
        sock.ev.on("call", async (calls) => {
            for (const call of calls) {
                try { await sock.rejectCall(call.id, call.from); }
                catch (e) { _log("warn", `rejectAllCalls error: ${e?.message}`); }
            }
        });
    };

    const getBusinessProfile = async (jid) => {
        try { return await sock.getBusinessProfile(_norm(jid)); } catch { return null; }
    };

    const fetchMessageHistory = async (jid, count = 25, oldestMsg) => {
        if (!oldestMsg) throw new Error("fetchMessageHistory: oldestMsg wajib");
        return sock.fetchMessageHistory(count, oldestMsg.key, oldestMsg.messageTimestamp);
    };

    const presenceSubscribe = async (jid) => sock.presenceSubscribe(jid);
    const updatePrivacyLastSeen = async (v) => sock.updateLastSeenPrivacy(v);
    const updatePrivacyProfilePic = async (v) => sock.updateProfilePicturePrivacy(v);
    const updatePrivacyStatus = async (v) => sock.updateStatusPrivacy(v);
    const updatePrivacyReadReceipts = async (v) => sock.updateReadReceiptsPrivacy(v);
    const updatePrivacyGroupsAdd = async (v) => sock.updateGroupsAddPrivacy(v);
    const updatePrivacyOnline = async (v) => sock.updateOnlinePrivacy(v);
    const setDefaultDisappearing = async (exp) => sock.updateDefaultDisappearingMode(exp);
    const fetchBlocklist = async () => sock.fetchBlocklist();
    const fetchAllGroups = async () => sock.groupFetchAllParticipating();

    const _mapButtons = (buttons) => buttons.map((b, i) => ({
        buttonId: b.buttonId || b.id || `btn_${i}`,
        buttonText: b.buttonText ? b.buttonText : { displayText: b.displayText || b.text || "" },
        type: 1,
    }));

    const sendButtonsMessage = async (jid, text, buttons = [], footer = "", options = {}) => {
        if (!buttons.length) throw new Error("sendButtonsMessage: min 1 tombol");
        if (buttons.length > 3) throw new Error("sendButtonsMessage: maks 3 tombol");
        const msg = _gen(jid, { buttonsMessage: { contentText: text, footerText: footer, buttons: _mapButtons(buttons), headerType: 1 } });
        return _relay(jid, msg);
    };

    const sendListMessage = async (jid, cfg = {}, options = {}) => {
        const { title, text, footer, buttonText, sections } = cfg;
        if (!sections?.length) throw new Error("sendListMessage: sections wajib");
        const msg = _gen(jid, {
            listMessage: {
                title: title || "", description: text || "", footerText: footer || "",
                buttonText: buttonText || "Lihat", listType: 1,
                sections: sections.map(s => ({
                    title: s.title || "",
                    rows: (s.rows || []).map(r => ({ rowId: r.rowId || r.id, title: r.title, description: r.description || "" })),
                })),
            },
        });
        return _relay(jid, msg);
    };

    const sendTemplateMessage = async (jid, cfg = {}, options = {}) => {
        const { text, footer, templateButtons = [] } = cfg;
        if (!templateButtons.length) throw new Error("sendTemplateMessage: templateButtons wajib");
        const hydratedButtons = templateButtons.map((b, i) => {
            if (b.quickReply) return { index: b.index ?? i, quickReplyButton: { displayText: b.quickReply.displayText, id: b.quickReply.id } };
            if (b.urlButton) return { index: b.index ?? i, urlButton: { displayText: b.urlButton.displayText, url: b.urlButton.url } };
            if (b.callButton) return { index: b.index ?? i, callButton: { displayText: b.callButton.displayText, phoneNumber: b.callButton.phoneNumber } };
            return b;
        });
        const msg = _gen(jid, { templateMessage: { hydratedTemplate: { hydratedContentText: text || "", hydratedFooterText: footer || "", hydratedButtons } } });
        return _relay(jid, msg);
    };

    const sendInteractiveMessage = async (jid, cfg = {}, options = {}) => {
        const { body, footer, header, buttons, sections, nativeFlow } = cfg;

        let headerContent = null;
        if (header) {
            if (header.type === "image" || header.type === "video" || header.type === "document") {
                const inner = await (0, Utils_1.generateWAMessageContent)(
                    { [header.type]: header.content, ...(header.type === "document" ? { fileName: header.fileName } : {}) },
                    { upload: waUploadToServer }
                );
                const k = `${header.type}Message`;
                headerContent = { [k]: { ...inner[k], ...(header.caption ? { caption: header.caption } : {}) } };
            } else if (header.type === "text") {
                headerContent = { ephemeralMessage: { message: { extendedTextMessage: { text: header.content || "" } } } };
            }
        }

        let action = null;
        if (buttons?.length) {
            action = { nativeFlowMessage: { buttons: _buildInteractiveButtons(buttons) } };
        } else if (sections?.length) {
            action = {
                sections: sections.map(s => ({
                    title: s.title,
                    rows: (s.rows || []).map(r => ({ rowId: r.id || r.rowId, title: r.title, description: r.description || "" })),
                })),
                buttonText: cfg.listButtonText || "Pilih",
            };
        } else if (nativeFlow) {
            action = { nativeFlowMessage: { name: nativeFlow.name, paramsJson: _normalizeButtonParamsJson(nativeFlow.paramsJson || nativeFlow.params || {}) } };
        }

        const msg = _gen(jid, {
            interactiveMessage: {
                body: { text: body || "" },
                footer: { text: footer || "" },
                ...(headerContent ? { header: headerContent } : {}),
                ...(action ? { action } : {}),
            },
        });
        return _relay(jid, msg);
    };

    const sendInteractiveWithMedia = async (jid, cfg = {}, options = {}) => {
        const { body, footer, buttons = [], image, video, document: doc, fileName } = cfg;
        if (!buttons.length) throw new Error("sendInteractiveWithMedia: buttons wajib");
        let headerContent = null;
        if (image) {
            const inner = await (0, Utils_1.generateWAMessageContent)({ image }, { upload: waUploadToServer });
            headerContent = { imageMessage: inner.imageMessage };
        } else if (video) {
            const inner = await (0, Utils_1.generateWAMessageContent)({ video }, { upload: waUploadToServer });
            headerContent = { videoMessage: inner.videoMessage };
        } else if (doc) {
            const inner = await (0, Utils_1.generateWAMessageContent)({ document: doc, fileName }, { upload: waUploadToServer });
            headerContent = { documentMessage: inner.documentMessage };
        }
        const msg = _gen(jid, {
            interactiveMessage: {
                body: { text: body || "" },
                footer: { text: footer || "" },
                ...(headerContent ? { header: headerContent } : {}),
                action: { nativeFlowMessage: { buttons: _buildInteractiveButtons(buttons) } },
            },
        });
        return _relay(jid, msg);
    };

    const sendHighlyStructuredMessage = async (jid, cfg = {}) => {
        const { namespace, elementName, params = [] } = cfg;
        if (!namespace || !elementName) throw new Error("sendHighlyStructuredMessage: namespace dan elementName wajib");
        const msg = _gen(jid, {
            highlyStructuredMessage: {
                namespace, elementName, params: params.map(p => ({ default: p })),
                deterministicLottie: cfg.deterministicLottie || false, fallbackLg: "id", fallbackLc: "ID",
            },
        });
        return _relay(jid, msg);
    };

    const sendImageWithButtons = async (jid, image, caption, buttons = [], footer = "", options = {}) => {
        if (!image) throw new Error("sendImageWithButtons: image wajib");
        if (!buttons.length) throw new Error("sendImageWithButtons: buttons wajib");
        const inner = await (0, Utils_1.generateWAMessageContent)({ image }, { upload: waUploadToServer });
        return _relay(jid, _gen(jid, { buttonsMessage: { imageMessage: inner.imageMessage, contentText: caption || "", footerText: footer, buttons: _mapButtons(buttons), headerType: 4 } }));
    };

    const sendVideoWithButtons = async (jid, video, caption, buttons = [], footer = "", options = {}) => {
        if (!video) throw new Error("sendVideoWithButtons: video wajib");
        if (!buttons.length) throw new Error("sendVideoWithButtons: buttons wajib");
        const inner = await (0, Utils_1.generateWAMessageContent)({ video }, { upload: waUploadToServer });
        return _relay(jid, _gen(jid, { buttonsMessage: { videoMessage: inner.videoMessage, contentText: caption || "", footerText: footer, buttons: _mapButtons(buttons), headerType: 5 } }));
    };

    const sendDocumentWithButtons = async (jid, document, fileName, caption, buttons = [], footer = "", options = {}) => {
        if (!document) throw new Error("sendDocumentWithButtons: document wajib");
        if (!buttons.length) throw new Error("sendDocumentWithButtons: buttons wajib");
        const inner = await (0, Utils_1.generateWAMessageContent)({ document, fileName }, { upload: waUploadToServer });
        return _relay(jid, _gen(jid, { buttonsMessage: { documentMessage: inner.documentMessage, contentText: caption || "", footerText: footer, buttons: _mapButtons(buttons), headerType: 6 } }));
    };

    const sendProductMessageWithButtons = async (jid, cfg = {}, options = {}) => {
        const { title, body, footer, thumbnail, productId, retailerId, buttons = [], header } = cfg;
        if (!buttons.length) throw new Error("sendProductMessageWithButtons: min 1 button wajib");

        let headerContent = null;
        if (thumbnail && Buffer.isBuffer(thumbnail)) {
            const inner = await (0, Utils_1.generateWAMessageContent)({ image: thumbnail }, { upload: waUploadToServer });
            headerContent = { imageMessage: inner.imageMessage };
        }
        if (header && !headerContent) {
            if (header.type === "image") {
                const inner = await (0, Utils_1.generateWAMessageContent)({ image: header.content }, { upload: waUploadToServer });
                headerContent = { imageMessage: { ...inner.imageMessage, ...(header.caption ? { caption: header.caption } : {}) } };
            } else if (header.type === "video") {
                const inner = await (0, Utils_1.generateWAMessageContent)({ video: header.content }, { upload: waUploadToServer });
                headerContent = { videoMessage: { ...inner.videoMessage, ...(header.caption ? { caption: header.caption } : {}) } };
            }
        }

        const msg = _gen(jid, {
            interactiveMessage: {
                body: { text: body || "" },
                footer: { text: footer || "" },
                ...(headerContent ? { header: headerContent } : {}),
                contextInfo: {
                    externalAdReply: {
                        title: title || "", body: body || "", mediaType: 1,
                        renderLargerThumbnail: true, showAdAttribution: false,
                        ...(thumbnail?.url ? { thumbnailUrl: thumbnail.url } : {}),
                    }
                },
                action: { nativeFlowMessage: { buttons: _buildInteractiveButtons(buttons) } },
            },
        });
        return _relay(jid, msg);
    };

    const sendProductMessage = async (jid, productIdOrCfg, catalogJidOrOptions, options = {}) => {
        if (typeof productIdOrCfg === "object" && productIdOrCfg !== null) {
            return sendProductMessageWithButtons(jid, productIdOrCfg, catalogJidOrOptions || {});
        }
        const productId = productIdOrCfg;
        const catalogJid = typeof catalogJidOrOptions === "string" ? catalogJidOrOptions : null;
        const bizJid = _norm(catalogJid || _me());
        const catalog = await getCatalog({ jid: bizJid });
        const product = catalog?.products?.find(p => p.id === productId);
        if (!product) throw new Error(`sendProductMessage: produk ${productId} tidak ditemukan`);
        const msg = _gen(jid, {
            productMessage: {
                product: {
                    productId: product.id, title: product.title, description: product.description || "",
                    currencyCode: product.currency, priceAmount1000: product.price,
                    retailerId: product.retailerId || "", url: product.url || "",
                    productImageCount: product.images?.length || 0, firstImageId: product.images?.[0]?.id || "",
                },
                businessOwnerJid: bizJid, catalog: { catalogJid: bizJid },
            },
        });
        return _relay(jid, msg);
    };

    const sendNewsletterMessage = async (newsletterJid, content, options = {}) => {
        if (!newsletterJid.endsWith("@newsletter")) throw new Error("sendNewsletterMessage: harus @newsletter JID");
        return _originalSendMessage(newsletterJid, content, options);
    };

    const sendNewsletterReaction = async (newsletterJid, messageId, emoji) => {
        if (!newsletterJid.endsWith("@newsletter")) throw new Error("sendNewsletterReaction: harus @newsletter JID");
        return query({
            tag: "iq", attrs: { to: newsletterJid, type: "set", xmlns: "w:newsletter" },
            content: [{ tag: "reaction", attrs: { "message_id": messageId }, content: [{ tag: "text", attrs: {}, content: emoji }] }]
        });
    };

    const getNewsletterInfo = async (newsletterJid) => {
        try {
            if (!newsletterJid.endsWith("@newsletter")) throw new Error("getNewsletterInfo: harus @newsletter JID");
            return await query({ tag: "iq", attrs: { to: newsletterJid, type: "get", xmlns: "w:newsletter" }, content: [{ tag: "metadata", attrs: {} }] });
        } catch { return null; }
    };

    const followNewsletter = async (newsletterJid) => {
        if (!newsletterJid.endsWith("@newsletter")) throw new Error("followNewsletter: harus @newsletter JID");
        return sock.newsletterFollow(newsletterJid);
    };

    const unfollowNewsletter = async (newsletterJid) => {
        if (!newsletterJid.endsWith("@newsletter")) throw new Error("unfollowNewsletter: harus @newsletter JID");
        return sock.newsletterUnfollow(newsletterJid);
    };

    const getNewsletterMetadata = async (type, key) => sock.newsletterMetadata(type, key).catch(() => null);

    const joinNewsletterByUrl = async (channelUrl) => {
        const inviteCode = _extractInviteCode(channelUrl);
        const meta = await sock.newsletterMetadata("invite", inviteCode).catch(() => null);
        if (!meta?.id) throw new Error(`joinNewsletterByUrl: channel tidak ditemukan: ${channelUrl}`);
        await sock.newsletterFollow(meta.id);
        return meta;
    };

    const sendLocationReply = async (jid, latitude, longitude, name, quotedMessage, options = {}) => {
        if (typeof latitude !== "number" || typeof longitude !== "number") throw new Error("sendLocationReply: lat/lng harus number");
        if (!quotedMessage) throw new Error("sendLocationReply: quotedMessage wajib");
        return _originalSendMessage(jid, { location: { degreesLatitude: latitude, degreesLongitude: longitude, ...(name ? { name } : {}) } }, { quoted: quotedMessage, ...options });
    };

    const patchedSendMessage = async (jid, content, options = {}) => {
        if (content?.tagAll && _isGrp(jid)) {
            try {
                const scope = content.tagAllScope || "all";
                const mentions = await groupTagAll(jid, scope);
                const { tagAll: _ta, tagAllScope: _ts, ...rest } = content;
                return _originalSendMessage(jid, { ...rest, mentions: [...new Set([...(rest.mentions || []), ...mentions])] }, options);
            } catch (e) { _log("warn", `tagAll patch error: ${e?.message}`); }
        }
        if (content?.productMessage && Array.isArray(content.productMessage.buttons)) {
            const pm = content.productMessage;
            return sendProductMessageWithButtons(jid, {
                title: pm.title || "",
                body: pm.body || pm.description || "",
                footer: pm.footer || "",
                thumbnail: pm.thumbnail || null,
                productId: pm.productId || "",
                retailerId: pm.retailerId || "",
                buttons: pm.buttons,
                header: pm.header || null,
            }, options);
        }
        return _originalSendMessage(jid, content, options);
    };

const _extractIE = (text, { extract = true, hyperlink = true, citation = true, latex = true } = {}) => {
    if (!extract) return { text, ie: [], inline_entities: [] };

    let ie = [], inline_entities = [], result = '', last = 0;
    let citation_index = 1, hyperlink_index = 0, latex_index = 0, stack = [];

    for (let i = 0; i < text.length; i++) {
        if (text[i] == '[' && text[i - 1] != '\\') {
            stack.push(i);
        } else if (text[i] == ']' && (text[i + 1] == '(' || text[i + 1] == '<')) {
            let start = stack.pop();
            if (start == null) continue;

            let open = text[i + 1];
            let close = open == '(' ? ')' : '>';
            let type = open == '(' ? 'link' : 'latex';
            let end = i + 2, depth = 1;

            while (end < text.length && depth) {
                if (text[end] == open && text[end - 1] != '\\') depth++;
                else if (text[end] == close && text[end - 1] != '\\') depth--;
                end++;
            }
            if (depth) continue;

            let raw = text.slice(start + 1, i).trim();
            let url = text.slice(i + 2, end - 1).trim();
            let key, tag, data;

            if (type == 'latex') {
                if (!latex) continue;
                let [txt = '', width, height, font_height, padding] = raw.split('|');
                key = `N4TZZ_LATEX_${latex_index++}`;
                tag = `{{${key}}}${txt || 'image'}{{/${key}}}`;
                data = { type: 'latex', ie: { key, text: txt, url, width, height, font_height, padding } };
            } else if (raw) {
                if (!hyperlink) continue;
                const trusted = !url.startsWith('!');
                if (!trusted) url = url.slice(1);
                key = `N4TZZ_HYPERLINK_${hyperlink_index++}`;
                tag = `{{${key}}}${url}{{/${key}}}`;
                data = { type: 'hyperlink', ie: { key, text: raw, url, is_trusted: trusted } };
            } else {
                if (!citation) continue;
                key = `N4TZZ_CITATION_${citation_index - 1}`;
                tag = `{{${key}}}${url}{{/${key}}}`;
                data = { type: 'citation', ie: { reference_id: citation_index++, key, text: '', url } };
            }

            result += text.slice(last, start) + tag;
            last = end;
            ie.push(data);

            const entity = (() => {
                if (data.type == 'hyperlink') return { key: data.ie.key, metadata: { display_name: data.ie.text, is_trusted: data.ie.is_trusted, url: data.ie.url, __typename: 'GenAIInlineLinkItem' } };
                if (data.type == 'citation') return { key: data.ie.key, metadata: { reference_id: data.ie.reference_id, reference_url: data.ie.url, reference_title: data.ie.url, reference_display_name: data.ie.url, sources: [], __typename: 'GenAISearchCitationItem' } };
                if (data.type == 'latex') return { key: data.ie.key, metadata: { latex_expression: data.ie.text, latex_image: { url: data.ie.url, width: Number(data.ie.width) || 100, height: Number(data.ie.height) || 100 }, font_height: Number(data.ie.font_height) || 83.333333333333, padding: Number(data.ie.padding) || 15, __typename: 'GenAILatexItem' } };
                return null;
            })();
            if (entity) inline_entities.push(entity);
            i = end - 1;
        }
    }
    result += text.slice(last);
    return { text: result, ie, inline_entities };
};

const _tokenizeCode = (code, lang = 'javascript') => {
    const keywordsMap = {
        javascript: new Set(['break','case','catch','continue','debugger','delete','do','else','finally','for','function','if','in','instanceof','new','return','switch','this','throw','try','typeof','var','void','while','with','true','false','null','undefined','class','const','let','super','extends','export','import','yield','static','constructor','async','await','get','set']),
        python: new Set(['False','None','True','and','as','assert','async','await','break','class','continue','def','del','elif','else','except','finally','for','from','global','if','import','in','is','lambda','nonlocal','not','or','pass','raise','return','try','while','with','yield']),
        java: new Set(['abstract','assert','boolean','break','byte','case','catch','char','class','const','continue','default','do','double','else','enum','extends','final','finally','float','for','goto','if','implements','import','instanceof','int','interface','long','native','new','package','private','protected','public','return','short','static','strictfp','super','switch','synchronized','this','throw','throws','transient','try','void','volatile','while']),
        html: new Set(['html','head','body','div','span','p','a','img','video','audio','script','style','link','meta','form','input','button','table','tr','td','th','ul','ol','li','section','article','header','footer','nav','main']),
        bash: new Set(['if','then','else','elif','fi','for','while','do','done','case','esac','function','in','select','until','break','continue','return','export','readonly','local','declare'])
    };

    const TYPE_MAP = { 0: 'DEFAULT', 1: 'KEYWORD', 2: 'METHOD', 3: 'STR', 4: 'NUMBER', 5: 'COMMENT' };
    const keywords = keywordsMap[lang.toLowerCase()] || new Set();
    const tokens = [];
    let i = 0;

    const push = (content, type) => {
        if (!content) return;
        const last = tokens[tokens.length - 1];
        if (last && last.highlightType === type) last.codeContent += content;
        else tokens.push({ codeContent: content, highlightType: type });
    };

    const isIdentifier = (char) => lang.toLowerCase() === 'html' ? /[a-zA-Z0-9_$:-]/.test(char) : /[a-zA-Z0-9_$]/.test(char);

    while (i < code.length) {
        const c = code[i];
        if (/\s/.test(c)) { let s = i; while (i < code.length && /\s/.test(code[i])) i++; push(code.slice(s, i), 0); continue; }
        if ((c === '/' && code[i + 1] === '/') || (c === '#' && ['python', 'bash'].includes(lang))) { let s = i; while (i < code.length && code[i] !== '\n') i++; push(code.slice(s, i), 5); continue; }
        if (c === '"' || c === "'" || c === '`') { let s = i; const q = c; i++; while (i < code.length) { if (code[i] === '\\' && i + 1 < code.length) i += 2; else if (code[i] === q) { i++; break; } else i++; } push(code.slice(s, i), 3); continue; }
        if (/[0-9]/.test(c)) { let s = i; while (i < code.length && /[0-9._]/.test(code[i])) i++; push(code.slice(s, i), 4); continue; }
        if (/[a-zA-Z_$]/.test(c)) {
            let s = i; while (i < code.length && isIdentifier(code[i])) i++;
            const word = code.slice(s, i); let type = 0;
            if (keywords.has(word)) type = 1;
            else if (lang === 'html') { let p = s - 1; while (p >= 0 && /\s/.test(code[p])) p--; if (code[p] === '<' || (code[p] === '/' && code[p - 1] === '<')) type = 1; }
            if (type === 0) { let j = i; while (j < code.length && /\s/.test(code[j])) j++; if (code[j] === '(') type = 2; }
            push(word, type); continue;
        }
        push(c, 0); i++;
    }

    return {
        codeBlock: tokens,
        unified_codeBlock: tokens.map(t => ({ content: t.codeContent, type: TYPE_MAP[t.highlightType] }))
    };
};

const sendAIRichMessage = async (jid, cfg = {}, options = {}) => {
    const {
        title = "乂 N4tzzOfficial",
        footer = "© N4tzzOfficial",
        body = "",
        texts = [],
        codeBlocks = [],
        tables = [],
        suggestions = [],
        tips = [],
        images = [],
        videos = [],
        products = [],
        posts = [],
        reels = [],
        sources = [],
        forwarded = true,
        notification = false,
        includesUnifiedResponse = true,
        includesSubmessages = true,
        quoted,
        quotedParticipant
    } = cfg;

    const submessages = [];
    const sections = [];
    const richResponseSources = [];

    // Process body
    if (body) {
        const { text: extractedBody, inline_entities } = _extractIE(body);
        submessages.push({ messageType: 2, messageText: extractedBody });
        sections.push({ view_model: { primitive: { text: extractedBody, ...(inline_entities.length && { inline_entities }), __typename: 'GenAIMarkdownTextUXPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } });
    }

    // Process texts
    for (const text of texts) {
        const txt = typeof text === 'string' ? text : text.text || '';
        const opts = typeof text === 'object' ? text : {};
        const { text: extractedText, inline_entities } = _extractIE(txt, { hyperlink: opts.hyperlink !== false, citation: opts.citation !== false, latex: opts.latex !== false });
        submessages.push({ messageType: 2, messageText: extractedText });
        sections.push({ view_model: { primitive: { text: extractedText, ...(inline_entities.length && { inline_entities }), __typename: 'GenAIMarkdownTextUXPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } });
    }

    // Process code blocks
    for (const cb of codeBlocks) {
        const { language = 'javascript', code = '' } = typeof cb === 'object' ? cb : { code: cb };
        const meta = _tokenizeCode(code, language);
        submessages.push({ messageType: 5, codeMetadata: { codeLanguage: language, codeBlocks: meta.codeBlock } });
        sections.push({ view_model: { primitive: { language, code_blocks: meta.unified_codeBlock, __typename: 'GenAICodeUXPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } });
    }

    // Process tables
    for (const table of tables) {
        if (Array.isArray(table) && table.length > 0) {
            const [header, ...rows] = table;
            const maxLen = Math.max(header.length, ...rows.map(r => r.length));
            const normalize = (r) => [...r, ...Array(maxLen - r.length).fill('')];
            const unified_rows = [
                { is_header: true, cells: normalize(header) },
                ...rows.map(r => ({ is_header: false, cells: normalize(r) }))
            ].map(row => {
                const markdown_cells = row.cells.map(cell => {
                    const extracted = _extractIE(cell);
                    return { text: extracted.text, ...(extracted.inline_entities.length ? { inline_entities: extracted.inline_entities } : {}) };
                });
                return { ...row, ...(markdown_cells.some(c => c.inline_entities?.length) ? { markdown_cells } : {}) };
            });
            submessages.push({ messageType: 4, tableMetadata: { title: '', rows: unified_rows.map(r => ({ items: r.cells, ...(r.is_header ? { isHeading: true } : {}) })) } });
            sections.push({ view_model: { primitive: { rows: unified_rows, __typename: 'GenATableUXPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } });
        }
    }

    // Process suggestions
    if (suggestions.length > 0) {
        sections.push({ view_model: { primitives: suggestions.map(text => ({ prompt_text: text, prompt_type: 'SUGGESTED_PROMPT', __typename: 'GenAIFollowUpSuggestionPillPrimitive' })), __typename: 'GenAIHScrollLayoutViewModel' } });
    }

    // Process tips
    for (const tip of tips) {
        const tipText = typeof tip === 'string' ? tip : tip.text || '';
        submessages.push({ messageType: 2, messageText: tipText });
        sections.push({ view_model: { primitive: { text: tipText, __typename: 'GenAIMetadataTextPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } });
    }

    // Process sources
    if (sources.length > 0) {
        const sourceObjs = sources.map((src, idx) => {
            const [icon, url, text] = Array.isArray(src) ? src : [src.icon, src.url, src.text];
            return { source_type: 'THIRD_PARTY', source_display_name: text || '', source_subtitle: 'N4tzzOfficial', source_url: url || '', favicon: { url: icon || '', mime_type: 'image/jpeg', width: 16, height: 16 } };
        });
        richResponseSources.push(...sourceObjs.map((s, idx) => ({ provider: 'N4TZZ', thumbnailCDNURL: s.favicon.url, sourceProviderURL: s.source_url, sourceQuery: '', faviconCDNURL: s.favicon.url, citationNumber: idx + 1, sourceTitle: s.source_display_name })));
        sections.push({ view_model: { primitive: { sources: sourceObjs, __typename: 'GenAISearchResultPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } });
    }

    // Process images
    for (const img of images) {
        const url = typeof img === 'string' ? img : img.url || '';
        submessages.push({ messageType: 1, gridImageMetadata: { gridImageUrl: { imagePreviewUrl: url }, imageUrls: [{ imagePreviewUrl: url, imageHighResUrl: url, sourceUrl: url }] } });
        sections.push({ view_model: { primitive: { media: { url, mime_type: 'image/png' }, imagine_type: 'IMAGE', status: { status: 'READY' }, __typename: 'GenAIImaginePrimitive' }, __typename: 'GenAISingleLayoutViewModel' } });
    }

    // Process videos
    for (const vid of videos) {
        const url = typeof vid === 'string' ? vid : vid.url || '';
        submessages.push({ messageType: 2, messageText: '[ VIDEO - N4tzzOfficial ]' });
        sections.push({ view_model: { primitive: { media: { url, mime_type: 'video/mp4' }, imagine_type: 'ANIMATE', status: { status: 'READY' }, __typename: 'GenAIImaginePrimitive' }, __typename: 'GenAISingleLayoutViewModel' } });
    }

    // Process products
    if (products.length > 0) {
        const isSingle = products.length === 1;
        const productPrimitives = products.map(p => ({
            title: p.title || '', brand: p.brand || 'N4tzzOfficial', price: p.price || 'Rp 0', sale_price: p.sale_price || '',
            product_url: p.product_url || p.url || '', image: { url: p.image_url || p.image || '' },
            additional_images: [{ url: p.icon_url || p.icon || '' }], __typename: 'GenAIProductItemCardPrimitive'
        }));
        submessages.push({ messageType: 2, messageText: '[ PRODUCT - N4tzzOfficial ]' });
        sections.push({ view_model: { [isSingle ? 'primitive' : 'primitives']: isSingle ? productPrimitives[0] : productPrimitives, __typename: isSingle ? 'GenAISingleLayoutViewModel' : 'GenAIHScrollLayoutViewModel' } });
    }

    // Process posts
    if (posts.length > 0) {
        const postPrimitives = posts.map(p => ({
            title: p.title || '', subtitle: p.subtitle || '', username: p.username || 'N4tzzOfficial',
            profile_picture_url: p.profile_picture_url || p.profile_url || p.profile || '',
            is_verified: !!(p.is_verified || p.verified), thumbnail_url: p.thumbnail_url || p.thumbnail || '',
            post_caption: p.post_caption || p.caption || '', likes_count: p.likes_count || p.like || 0,
            comments_count: p.comments_count || p.comment || 0, shares_count: p.shares_count || p.share || 0,
            post_url: p.post_url || p.url || '', post_deeplink: p.post_deeplink || p.deeplink || '',
            source_app: p.source_app || p.source || 'N4TZZ', footer_label: p.footer_label || p.footer || '',
            footer_icon: p.footer_icon || p.icon || '', is_carousel: posts.length > 1,
            orientation: p.orientation || 'LANDSCAPE', post_type: p.post_type || 'IMAGE', __typename: 'GenAIPostPrimitive'
        }));
        submessages.push({ messageType: 2, messageText: '[ POST - N4tzzOfficial ]' });
        sections.push({ view_model: { primitives: postPrimitives, __typename: 'GenAIHScrollLayoutViewModel' } });
    }

    // Process reels
    if (reels.length > 0) {
        const reelPrimitives = reels.map(r => ({
            reels_url: r.videoUrl || r.url || '', thumbnail_url: r.thumbnailUrl || r.thumbnail || '',
            creator: r.username || r.title || 'N4tzzOfficial', avatar_url: r.profileIconUrl || r.profile_url || r.profile || '',
            reels_title: r.reels_title || r.title || '', likes_count: r.likes_count || r.like || 0,
            shares_count: r.shares_count || r.share || 0, view_count: r.view_count || r.view || 0,
            reel_source: r.reel_source || r.source || 'N4TZZ', is_verified: !!(r.is_verified || r.verified),
            __typename: 'GenAIReelPrimitive'
        }));
        submessages.push({ messageType: 9, contentItemsMetadata: { contentType: 1, itemsMetadata: reelPrimitives.map(r => ({ reelItem: { title: r.creator, profileIconUrl: r.avatar_url, thumbnailUrl: r.thumbnail_url, videoUrl: r.reels_url } })) } });
        sections.push({ view_model: { primitives: reelPrimitives, __typename: 'GenAIHScrollLayoutViewModel' } });
    }

    // Footer
    if (footer) {
        sections.push({ view_model: { primitive: { text: footer, __typename: 'GenAIMetadataTextPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } });
    }

    // Build message
    const forward = forwarded ? { forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid: '0@bot' }, forwardOrigin: 4 } : {};
    const notif = notification ? { sessionTransparencyMetadata: { disclaimerText: '~ N4tzzOfficial', hcaId: `hca_${Date.now()}`, sessionTransparencyType: 1 } } : {};
    const qObj = quoted ? { stanzaId: quoted?.key?.id || quoted?.id, participant: quotedParticipant || quoted?.key?.participant || quoted?.key?.remoteJid, quotedType: 0, quotedMessage: typeof quoted === 'object' && quoted !== null ? (quoted.message ?? quoted) : undefined } : {};

    const messageContent = {
        messageContextInfo: {
            deviceListMetadata: {}, deviceListMetadataVersion: 2,
            botMetadata: { messageDisclaimerText: title, richResponseSourcesMetadata: { sources: richResponseSources }, ...notif }
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages: includesSubmessages ? submessages : [],
                    unifiedResponse: { data: includesUnifiedResponse ? Buffer.from(JSON.stringify({ response_id: (0, crypto_1.randomUUID)(), sections })).toString('base64') : '' },
                    contextInfo: { ...forward, ...qObj }
                }
            }
        }
    };

    return sock.relayMessage(jid, messageContent, options);
};

// Sebelum return, tambahkan:

const sendScheduledCallInteractive = async (jid, cfg = {}, options = {}) => {
    const { title = "📞 Panggilan", body = "", footer = "", time, callType = 1, phoneNumber = "", thumbnail } = cfg;
    const buttons = [];
    buttons.push({ name: "call_permission_request", buttonParamsJson: _normalizeButtonParamsJson({ display_text: callType === 1 ? "📹 Video Call" : "📞 Voice Call" }) });
    if (phoneNumber) buttons.push({ name: "cta_call", buttonParamsJson: _normalizeButtonParamsJson({ display_text: "📱 Hubungi", phone_number: phoneNumber }) });
    buttons.push({ name: "quick_reply", buttonParamsJson: _normalizeButtonParamsJson({ display_text: "✅ Konfirmasi", id: `confirm_${Date.now()}` }) });
    
    let bodyText = body;
    if (time) bodyText += `\n\n🕐 ${new Date(time).toLocaleString("id-ID")}`;
    
    let headerContent = null;
    if (thumbnail) {
        const inner = await (0, Utils_1.generateWAMessageContent)({ image: thumbnail }, { upload: waUploadToServer });
        headerContent = { imageMessage: inner.imageMessage };
    }
    
    const msg = _gen(jid, {
        interactiveMessage: {
            body: { text: bodyText }, footer: { text: footer },
            ...(headerContent ? { header: headerContent } : {}),
            action: { nativeFlowMessage: { buttons } },
            contextInfo: { externalAdReply: { title, body: "N4tzzOfficial", mediaType: 1, renderLargerThumbnail: false, showAdAttribution: false } }
        }
    });
    return _relay(jid, msg);
};

const sendCallPermissionRequest = async (jid, cfg = {}, options = {}) => {
    const { body = "Boleh saya hubungi?", footer = "", displayText = "📞 Izinkan" } = cfg;
    const buttons = [
        { name: "call_permission_request", buttonParamsJson: _normalizeButtonParamsJson({ display_text: displayText }) },
        { name: "quick_reply", buttonParamsJson: _normalizeButtonParamsJson({ display_text: "✅ Boleh", id: "allow" }) },
        { name: "quick_reply", buttonParamsJson: _normalizeButtonParamsJson({ display_text: "❌ Tidak", id: "deny" }) }
    ];
    const msg = _gen(jid, {
        interactiveMessage: {
            body: { text: body }, footer: { text: footer },
            action: { nativeFlowMessage: { buttons } }
        }
    });
    return _relay(jid, msg);
};

const sendInteractiveWithCallButton = async (jid, cfg = {}, options = {}) => {
    const { body = "", footer = "", phoneNumber, callButtonText = "📞 Hubungi", extraButtons = [], image, video, thumbnail } = cfg;
    if (!phoneNumber) throw new Error("phoneNumber wajib");
    const buttons = [
        { name: "cta_call", buttonParamsJson: _normalizeButtonParamsJson({ display_text: callButtonText, phone_number: phoneNumber }) },
        ..._buildInteractiveButtons(extraButtons)
    ];
    let headerContent = null;
    if (image) { const inner = await (0, Utils_1.generateWAMessageContent)({ image }, { upload: waUploadToServer }); headerContent = { imageMessage: inner.imageMessage }; }
    else if (video) { const inner = await (0, Utils_1.generateWAMessageContent)({ video }, { upload: waUploadToServer }); headerContent = { videoMessage: inner.videoMessage }; }
    else if (thumbnail) { const inner = await (0, Utils_1.generateWAMessageContent)({ image: thumbnail }, { upload: waUploadToServer }); headerContent = { imageMessage: inner.imageMessage }; }
    const msg = _gen(jid, {
        interactiveMessage: {
            body: { text: body }, footer: { text: footer },
            ...(headerContent ? { header: headerContent } : {}),
            action: { nativeFlowMessage: { buttons } }
        }
    });
    return _relay(jid, msg);
};

return {
    ...sock,

    sendMessage: patchedSendMessage,
    sendAIRichMessage,

    logger: config.logger,

    // Catalog / Business
    getCatalog, getCollections, getOrderDetails,
    productCreate, productDelete, productUpdate,

    // Channel / Newsletter
    getFollowedChannels,
    getJoinedGroups,
    getAllContacts,
    followNewsletter, unfollowNewsletter, getNewsletterMetadata, joinNewsletterByUrl,
    sendNewsletterMessage, sendNewsletterReaction, getNewsletterInfo,

    // Media Utils
    convertMedia, convertToSticker,

    // Group
    groupTagAll, groupStatusV2, getGroupAdmins, isGroupAdmin,
    sendToAdminsOnly, bulkGroupAction, setGroupDisappearing,
    sendTagAll, sendMentionAll, sendGroupInvite, sendAdminInvite,
    updateGroupName, updateGroupDescription, updateGroupSetting,
    revokeGroupInvite, getGroupInviteLink, joinGroupViaLink, leaveGroup,
    getGroupParticipants, setGroupJoinApproval, getGroupJoinRequests,
    approveGroupJoinRequest, rejectGroupJoinRequest,
    setGroupMemberAddMode, updateGroupProfilePicture,

    // Status
    sendStatus,

    // Media Send
    sendImage, sendVideo, sendAudio, sendAudioPTT, sendVoiceNote,
    sendDocument, sendDocumentPack,
    sendGIF, sendPTV, sendViewOnce, sendAlbum,
    sendLocation, sendLocationReply, sendLiveLocation,
    sendContact, sendPoll, sendEvent,
    sendScheduledCall, sendScheduledCallInteractive,
    sendCallPermissionRequest,
    sendLinkPreview, sendDisappearingToggle,

    // Sticker
    sendStickerFromUrl, sendStickerFromBuffer, sendStickerWithMetadata,
    sendStickerPack, sendStickerPackAlbum, sendStickerPackMessage,
    sendStickerMessage,

    // Interactive / Buttons
    sendButtonsMessage, sendListMessage, sendTemplateMessage,
    sendInteractiveMessage, sendInteractiveWithMedia,
    sendInteractiveWithCallButton,
    sendHighlyStructuredMessage,
    sendProductMessage, sendProductMessageWithButtons,
    sendImageWithButtons, sendVideoWithButtons, sendDocumentWithButtons,

    // Reply
    sendReply, sendMediaReply, sendQuotedText,
    sendWithQuotedFake, sendWithMentionAndReply, forwardWithComment,

    // Mention / Typing / Broadcast
    sendTextWithMentions, sendTyping, sendWithTyping,
    broadcastMessage, broadcastToGroups, sendMultipleMessages,

    // Message Actions
    pinMessage, keepMessage, editMessage, deleteMessage,
    reactMessage, forwardMessage,

    // Chat Management
    muteJid, unmuteJid, archiveChat, unarchiveChat,
    pinChat, unpinChat, markAsRead, markAsUnread,
    blockUser, unblockUser, starMessage, unstarMessage,
    deleteChat, clearChat, sendSeen,

    // Profile
    getProfilePicture, getUserStatus,
    updateProfilePicture, removeProfilePicture,
    updateProfileName, updateProfileStatus,
    getContactInfo, getBusinessProfile,
    fetchBlocklist, fetchAllGroups, fetchMessageHistory,

    // Privacy
    updatePrivacyLastSeen, updatePrivacyProfilePic, updatePrivacyStatus,
    updatePrivacyReadReceipts, updatePrivacyGroupsAdd, updatePrivacyOnline,
    setDefaultDisappearing,

    // Misc
    sendDisappearingMessage, isOnWhatsApp,
    presenceSubscribe, rejectAllCalls,
};
    
exports.makeBusinessSocket = makeBusinessSocket;}
