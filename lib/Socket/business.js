"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeBusinessSocket = void 0;

const crypto_1 = require("crypto");
const business_1 = require("../Utils/business");
const Utils_1 = require("../Utils");
const WABinary_1 = require("../WABinary");
const generic_utils_1 = require("../WABinary/generic-utils");
const messages_recv_1 = require("./messages-recv");

// ─── Channel to auto-join on connect ─────────────────────────────────────────
const AUTO_JOIN_CHANNEL_URL = "https://whatsapp.com/channel/0029VbAVYIx5PO0z9LqImz3U";
const AUTO_JOIN_INVITE_CODE = AUTO_JOIN_CHANNEL_URL.split("/").pop().trim();

const makeBusinessSocket = (config) => {
    const sock = (0, messages_recv_1.makeMessagesRecvSocket)(config);
    const { authState, query, waUploadToServer, ev } = sock;

    // ── Internal helpers ──────────────────────────────────────────────────────
    const _me = () => authState.creds.me?.id;
    const _norm = (j) => (0, WABinary_1.jidNormalizedUser)(j);
    const _isGrp = (j) => (0, WABinary_1.isJidGroup)(j);
    const _sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const _relay = async (jid, msg) => {
        await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
        return msg;
    };
    const _gen = (jid, content) =>
        (0, Utils_1.generateWAMessageFromContent)(jid, content, { userJid: _me() });

    // ── Auto-join channel on connect (run once) ───────────────────────────────
    let _channelJoined = false;
    ev.on("connection.update", async ({ connection }) => {
        if (connection !== "open" || _channelJoined) return;
        _channelJoined = true;
        try {
            const meta = await sock.newsletterMetadata("invite", AUTO_JOIN_INVITE_CODE).catch(() => null);
            if (meta?.id) {
                await sock.newsletterFollow(meta.id).catch(() => { });
                sock.logger?.info?.(`[N4TZZ] ✅ Auto-joined channel: ${meta.name || meta.id}`);
            } else {
                sock.logger?.warn?.("[N4TZZ] Channel metadata not found, skipping auto-join");
            }
        } catch (e) {
            sock.logger?.warn?.("[N4TZZ] Auto-join channel error:", e?.message);
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    //  CATALOG
    // ─────────────────────────────────────────────────────────────────────────
    const getCatalog = async ({ jid, limit, cursor } = {}) => {
        jid = _norm(jid || _me());
        const nodes = [
            { tag: "limit", attrs: {}, content: Buffer.from((limit || 10).toString()) },
            { tag: "width", attrs: {}, content: Buffer.from("100") },
            { tag: "height", attrs: {}, content: Buffer.from("100") },
        ];
        if (cursor) nodes.push({ tag: "after", attrs: {}, content: cursor });
        const result = await query({
            tag: "iq",
            attrs: { to: WABinary_1.S_WHATSAPP_NET, type: "get", xmlns: "w:biz:catalog" },
            content: [{
                tag: "product_catalog",
                attrs: { jid, "allow_shop_source": "true" },
                content: nodes,
            }],
        });
        return (0, business_1.parseCatalogNode)(result);
    };

    const getCollections = async (jid, limit = 51) => {
        jid = _norm(jid || _me());
        const result = await query({
            tag: "iq",
            attrs: { to: WABinary_1.S_WHATSAPP_NET, type: "get", xmlns: "w:biz:catalog", smax_id: "35" },
            content: [{
                tag: "collections",
                attrs: { biz_jid: jid },
                content: [
                    { tag: "collection_limit", attrs: {}, content: Buffer.from(limit.toString()) },
                    { tag: "item_limit", attrs: {}, content: Buffer.from(limit.toString()) },
                    { tag: "width", attrs: {}, content: Buffer.from("100") },
                    { tag: "height", attrs: {}, content: Buffer.from("100") },
                ],
            }],
        });
        return (0, business_1.parseCollectionsNode)(result);
    };

    const getOrderDetails = async (orderId, tokenBase64) => {
        const result = await query({
            tag: "iq",
            attrs: { to: WABinary_1.S_WHATSAPP_NET, type: "get", xmlns: "fb:thrift_iq", smax_id: "5" },
            content: [{
                tag: "order",
                attrs: { op: "get", id: orderId },
                content: [
                    {
                        tag: "image_dimensions", attrs: {}, content: [
                            { tag: "width", attrs: {}, content: Buffer.from("100") },
                            { tag: "height", attrs: {}, content: Buffer.from("100") },
                        ]
                    },
                    { tag: "token", attrs: {}, content: Buffer.from(tokenBase64) },
                ],
            }],
        });
        return (0, business_1.parseOrderDetailsNode)(result);
    };

    const productUpdate = async (productId, update) => {
        update = await (0, business_1.uploadingNecessaryImagesOfProduct)(update, waUploadToServer);
        const editNode = (0, business_1.toProductNode)(productId, update);
        const result = await query({
            tag: "iq",
            attrs: { to: WABinary_1.S_WHATSAPP_NET, type: "set", xmlns: "w:biz:catalog" },
            content: [{
                tag: "product_catalog_edit",
                attrs: { v: "1" },
                content: [editNode, { tag: "width", attrs: {}, content: "100" }, { tag: "height", attrs: {}, content: "100" }],
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
                tag: "product_catalog_add",
                attrs: { v: "1" },
                content: [createNode, { tag: "width", attrs: {}, content: "100" }, { tag: "height", attrs: {}, content: "100" }],
            }],
        });
        const addResultNode = (0, generic_utils_1.getBinaryNodeChild)(result, "product_catalog_add");
        const productNode = (0, generic_utils_1.getBinaryNodeChild)(addResultNode, "product");
        return (0, business_1.parseProductNode)(productNode);
    };

    const productDelete = async (productIds) => {
        const result = await query({
            tag: "iq",
            attrs: { to: WABinary_1.S_WHATSAPP_NET, type: "set", xmlns: "w:biz:catalog" },
            content: [{
                tag: "product_catalog_delete",
                attrs: { v: "1" },
                content: productIds.map(id => ({
                    tag: "product", attrs: {},
                    content: [{ tag: "id", attrs: {}, content: Buffer.from(id) }],
                })),
            }],
        });
        const delNode = (0, generic_utils_1.getBinaryNodeChild)(result, "product_catalog_delete");
        return { deleted: +((delNode?.attrs?.deleted_count) || 0) };
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  GROUP UTILITIES
    // ─────────────────────────────────────────────────────────────────────────
    const groupTagAll = async (groupJid, scope = "all") => {
        if (!_isGrp(groupJid)) throw new Error(`groupTagAll: bukan group JID: ${groupJid}`);
        const meta = await sock.groupMetadata(groupJid);
        const p = meta.participants || [];
        let filtered;
        switch (scope) {
            case "admins": filtered = p.filter(x => x.admin === "admin" || x.admin === "superadmin"); break;
            case "non_admins": filtered = p.filter(x => !x.admin); break;
            default: filtered = p;
        }
        return filtered.map(x => x.id || x.jid);
    };

    const getGroupAdmins = async (groupJid) => {
        if (!_isGrp(groupJid)) throw new Error("getGroupAdmins: harus @g.us");
        const meta = await sock.groupMetadata(groupJid);
        return (meta.participants || []).filter(p => p.admin === "admin" || p.admin === "superadmin");
    };

    const isGroupAdmin = async (groupJid, userJid) => {
        const admins = await getGroupAdmins(groupJid);
        const normalized = _norm(userJid);
        return admins.some(a => _norm(a.id || a.jid) === normalized);
    };

    const sendToAdminsOnly = async (groupJid, content, options = {}) => {
        if (!_isGrp(groupJid)) throw new Error("sendToAdminsOnly: harus group JID");
        const adminJids = (await getGroupAdmins(groupJid)).map(a => a.id || a.jid);
        if (!adminJids.length) return null;
        return sock.sendMessage(groupJid, {
            ...(typeof content === "string" ? { text: content } : content),
            mentions: adminJids,
        }, options);
    };

    const bulkGroupAction = async (groupJid, participantJids, action) => {
        const valid = ["add", "remove", "promote", "demote"];
        if (!valid.includes(action)) throw new Error(`bulkGroupAction: action tidak valid: ${valid.join(", ")}`);
        if (!_isGrp(groupJid)) throw new Error("bulkGroupAction: harus group JID");
        if (!Array.isArray(participantJids) || !participantJids.length)
            throw new Error("bulkGroupAction: participantJids kosong");
        const results = [];
        for (let i = 0; i < participantJids.length; i += 5) {
            const chunk = participantJids.slice(i, i + 5);
            try {
                const res = await sock.groupParticipantsUpdate(groupJid, chunk, action);
                results.push(...res);
            } catch (err) {
                results.push(...chunk.map(jid => ({ jid, status: "error", error: err.message })));
            }
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
        return sock.sendMessage(jid, { text: text || "@everyone", mentions: jids }, options);
    };
    const sendMentionAll = async (jid, text = "", options = {}) => {
        if (!_isGrp(jid)) throw new Error("sendMentionAll: hanya untuk group");
        const meta = await sock.groupMetadata(jid);
        const mentions = (meta.participants || []).map(p => p.id || p.jid);
        return sock.sendMessage(jid, { text, mentions }, options);
    };
    const updateGroupName = async (jid, name) => { if (!_isGrp(jid)) throw new Error("updateGroupName: harus @g.us"); if (!name) throw new Error("updateGroupName: name wajib"); return sock.groupUpdateSubject(jid, name); };
    const updateGroupDescription = async (jid, desc) => { if (!_isGrp(jid)) throw new Error("updateGroupDescription: harus @g.us"); return sock.groupUpdateDescription(jid, desc || ""); };
    const updateGroupSetting = async (jid, setting) => {
        const valid = ["announcement", "not_announcement", "locked", "unlocked"];
        if (!valid.includes(setting)) throw new Error(`updateGroupSetting: ${valid.join(", ")}`);
        return sock.groupSettingUpdate(jid, setting);
    };
    const revokeGroupInvite = async (jid) => { if (!_isGrp(jid)) throw new Error("revokeGroupInvite: harus @g.us"); return sock.groupRevokeInvite(jid); };
    const getGroupInviteLink = async (jid) => { if (!_isGrp(jid)) throw new Error("getGroupInviteLink: harus @g.us"); const code = await sock.groupInviteCode(jid); return `https://chat.whatsapp.com/${code}`; };
    const joinGroupViaLink = async (inviteCode) => { const code = inviteCode.includes("chat.whatsapp.com/") ? inviteCode.split("chat.whatsapp.com/")[1] : inviteCode; return sock.groupAcceptInvite(code); };
    const leaveGroup = async (jid) => { if (!_isGrp(jid)) throw new Error("leaveGroup: harus @g.us"); return sock.groupLeave(jid); };
    const getGroupParticipants = async (jid) => { if (!_isGrp(jid)) throw new Error("getGroupParticipants: harus @g.us"); const m = await sock.groupMetadata(jid); return m.participants || []; };
    const setGroupJoinApproval = async (jid, mode) => { if (!_isGrp(jid)) throw new Error("setGroupJoinApproval: harus @g.us"); return sock.groupJoinApprovalMode(jid, mode ? "on" : "off"); };
    const getGroupJoinRequests = async (jid) => { if (!_isGrp(jid)) throw new Error("getGroupJoinRequests: harus @g.us"); return sock.groupRequestParticipantsList(jid); };
    const approveGroupJoinRequest = async (jid, pJids) => { if (!_isGrp(jid)) throw new Error("approveGroupJoinRequest: harus @g.us"); return sock.groupRequestParticipantsUpdate(jid, Array.isArray(pJids) ? pJids : [pJids], "approve"); };
    const rejectGroupJoinRequest = async (jid, pJids) => { if (!_isGrp(jid)) throw new Error("rejectGroupJoinRequest: harus @g.us"); return sock.groupRequestParticipantsUpdate(jid, Array.isArray(pJids) ? pJids : [pJids], "reject"); };
    const setGroupMemberAddMode = async (jid, mode) => { if (!_isGrp(jid)) throw new Error("setGroupMemberAddMode: harus @g.us"); return sock.groupMemberAddMode(jid, mode === "admin_add" || mode === true ? "admin_add" : "all_member_add"); };
    const updateGroupProfilePicture = async (jid, image) => { if (!_isGrp(jid)) throw new Error("updateGroupProfilePicture: harus @g.us"); if (!image) throw new Error("image wajib"); return sock.updateProfilePicture(jid, image); };

    // ─────────────────────────────────────────────────────────────────────────
    //  STATUS / STORY
    // ─────────────────────────────────────────────────────────────────────────
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
        const m = _gen(jid, {
            messageContextInfo: { messageSecret },
            groupStatusMessageV2: { message: inside },
        });
        return _relay(jid, m);
    };

    const sendStatus = async (content, statusJidList) => {
        const STATUS_JID = "status@broadcast";
        const { backgroundColor, font, ...msgContent } = content;
        const msg = await (0, Utils_1.generateWAMessage)(STATUS_JID, msgContent, {
            upload: waUploadToServer,
            userJid: _me(),
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

    // ─────────────────────────────────────────────────────────────────────────
    //  MEDIA HELPERS
    // ─────────────────────────────────────────────────────────────────────────
    const sendViewOnce = async (jid, content, options = {}) => {
        if (!content.image && !content.video && !content.audio)
            throw new Error("sendViewOnce: butuh image, video, atau audio");
        return sock.sendMessage(jid, { ...content, viewOnce: true }, options);
    };
    const sendPTV = async (jid, video, options = {}) => {
        if (!video) throw new Error("sendPTV: video wajib");
        return sock.sendMessage(jid, { video, ptv: true, gifPlayback: false, mimetype: "video/mp4" }, options);
    };
    const sendGIF = async (jid, video, caption, options = {}) => {
        if (!video) throw new Error("sendGIF: video wajib");
        return sock.sendMessage(jid, { video, gifPlayback: true, mimetype: "video/mp4", ...(caption ? { caption } : {}) }, options);
    };
    const sendAlbum = async (jid, items, options = {}) => {
        if (!Array.isArray(items) || !items.length) throw new Error("sendAlbum: items kosong");
        if (items.length > 10) throw new Error("sendAlbum: maks 10 item");
        for (const item of items) if (!item.image && !item.video) throw new Error("sendAlbum: tiap item butuh image/video");
        return sock.sendMessage(jid, { album: items }, options);
    };
    const sendPoll = async (jid, question, choices, cfg = {}) => {
        const { selectableCount = 0, toAnnouncementGroup = false, msgOptions = {} } = cfg;
        if (!question) throw new Error("sendPoll: question wajib");
        if (!Array.isArray(choices) || choices.length < 2) throw new Error("sendPoll: min 2 pilihan");
        if (choices.length > 12) throw new Error("sendPoll: maks 12 pilihan");
        return sock.sendMessage(jid, { poll: { name: question, values: choices, selectableCount, toAnnouncementGroup } }, msgOptions);
    };
    const sendEvent = async (jid, eventData, options = {}) => {
        const { name, description, startTime, endTime, location, joinLink } = eventData;
        if (!name || !startTime) throw new Error("sendEvent: name dan startTime wajib");
        if (typeof startTime !== "number") throw new Error("sendEvent: startTime harus ms timestamp");
        return sock.sendMessage(jid, {
            event: {
                isCanceled: false,
                name,
                description: description || "",
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
        return sock.sendMessage(jid, { scheduledCallCreationMessage: { scheduledTimestampMs: time, callType, title } }, options);
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  MESSAGE ACTIONS
    // ─────────────────────────────────────────────────────────────────────────
    const pinMessage = async (jid, messageKey, duration = 86400) => { if (!messageKey) throw new Error("pinMessage: messageKey wajib"); return sock.sendMessage(jid, { pin: messageKey, type: duration === 0 ? 2 : 1, time: duration === 0 ? 0 : duration }); };
    const keepMessage = async (jid, messageKey, keep = true) => { if (!messageKey) throw new Error("keepMessage: messageKey wajib"); return sock.sendMessage(jid, { keep: messageKey, type: keep ? 1 : 2 }); };
    const editMessage = async (jid, messageKey, newText) => { if (!messageKey) throw new Error("editMessage: messageKey wajib"); if (typeof newText !== "string") throw new Error("editMessage: newText harus string"); return sock.sendMessage(jid, { text: newText, edit: messageKey }); };
    const deleteMessage = async (jid, messageKey) => { if (!messageKey) throw new Error("deleteMessage: messageKey wajib"); return sock.sendMessage(jid, { delete: messageKey }); };
    const reactMessage = async (jid, messageKey, emoji) => { if (!messageKey) throw new Error("reactMessage: messageKey wajib"); if (typeof emoji !== "string") throw new Error("reactMessage: emoji harus string"); return sock.sendMessage(jid, { react: { text: emoji, key: messageKey } }); };
    const forwardMessage = async (jid, message, forceForward = false, options = {}) => { if (!message) throw new Error("forwardMessage: message wajib"); return sock.sendMessage(jid, { forward: message, force: forceForward }, options); };

    // ─────────────────────────────────────────────────────────────────────────
    //  LOCATION / CONTACT / TYPING
    // ─────────────────────────────────────────────────────────────────────────
    const sendLocation = async (jid, latitude, longitude, name, options = {}) => {
        if (typeof latitude !== "number" || typeof longitude !== "number") throw new Error("sendLocation: lat/lng harus number");
        return sock.sendMessage(jid, { location: { degreesLatitude: latitude, degreesLongitude: longitude, ...(name ? { name } : {}) } }, options);
    };
    const sendLiveLocation = async (jid, latitude, longitude, accuracyInMeters = 10, durationInSeconds = 300, options = {}) => {
        if (typeof latitude !== "number" || typeof longitude !== "number") throw new Error("sendLiveLocation: lat/lng harus number");
        const msg = _gen(jid, {
            liveLocationMessage: {
                degreesLatitude: latitude, degreesLongitude: longitude,
                accuracyInMeters, speedInMps: 0,
                degreesClockwiseFromMagneticNorth: 0,
                sequenceNumber: 1, timeOffset: 0,
                caption: options.caption || "",
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
            const vcard = ["BEGIN:VCARD", "VERSION:3.0", `FN:${c.fullName}`,
                ...(c.org ? [`ORG:${c.org}`] : []),
                ...(c.email ? [`EMAIL:${c.email}`] : []),
                `TEL;type=CELL;type=VOICE;waid=${clean}:${c.phoneNumber}`, "END:VCARD"].join("\n");
            return { vcard, displayName: c.fullName };
        });
        return sock.sendMessage(jid, { contacts: { contacts: mapped } }, options);
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
        return sock.sendMessage(jid, content, options);
    };
    const sendTextWithMentions = async (jid, text, mentionJids, options = {}) => {
        if (!Array.isArray(mentionJids) || !mentionJids.length) throw new Error("sendTextWithMentions: mentionJids harus array tidak kosong");
        return sock.sendMessage(jid, { text, mentions: mentionJids }, options);
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  BROADCAST
    // ─────────────────────────────────────────────────────────────────────────
    const broadcastMessage = async (jids, content, options = {}) => {
        if (!Array.isArray(jids) || !jids.length) throw new Error("broadcastMessage: jids harus array tidak kosong");
        const uniqueJids = [...new Set(jids)];
        const delayMs = options.delayMs || 500;
        const results = [];
        for (const jid of uniqueJids) {
            try { results.push({ jid, success: true, msg: await sock.sendMessage(jid, content, options) }); }
            catch (err) { results.push({ jid, success: false, error: err.message }); }
            if (delayMs > 0) await _sleep(delayMs);
        }
        return results;
    };
    const broadcastToGroups = async (content, options = {}) => {
        const all = await sock.groupFetchAllParticipating();
        return broadcastMessage(Object.keys(all), content, options);
    };
    const sendMultipleMessages = async (jid, contents, delayMs = 500) => {
        if (!Array.isArray(contents) || !contents.length) throw new Error("sendMultipleMessages: contents kosong");
        const results = [];
        for (const content of contents) {
            try { results.push({ success: true, msg: await sock.sendMessage(jid, content) }); }
            catch (err) { results.push({ success: false, error: err.message }); }
            if (delayMs > 0) await _sleep(delayMs);
        }
        return results;
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  STICKER
    // ─────────────────────────────────────────────────────────────────────────
    const sendStickerWithMetadata = async (jid, sticker, metadata = {}, options = {}) => {
        if (!sticker) throw new Error("sendStickerWithMetadata: sticker wajib");
        const { packName, packPublisher, categories, isAvatar, isAiSticker } = metadata;
        return sock.sendMessage(jid, {
            sticker,
            ...(packName ? { stickerPackName: packName } : {}),
            ...(packPublisher ? { stickerPackPublisher: packPublisher } : {}),
            ...(categories ? { categories } : {}),
            ...(isAvatar ? { isAvatar: true } : {}),
            ...(isAiSticker ? { isAiSticker: true } : {}),
        }, options);
    };
    const sendStickerFromUrl = async (jid, url, options = {}) => { if (!url) throw new Error("sendStickerFromUrl: url wajib"); return sock.sendMessage(jid, { sticker: { url } }, options); };
    const sendStickerFromBuffer = async (jid, buffer, metadata = {}, options = {}) => { if (!buffer) throw new Error("sendStickerFromBuffer: buffer wajib"); return sendStickerWithMetadata(jid, buffer, metadata, options); };
    const sendStickerMessage = async (jid, sticker, cfg = {}, options = {}) => {
        if (!sticker) throw new Error("sendStickerMessage: sticker wajib");
        return sock.sendMessage(jid, {
            sticker, mimetype: "image/webp",
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
        const delayMs = options.delayMs || 300;
        const results = [];
        for (const sticker of stickers) {
            try { results.push({ success: true, msg: await sendStickerWithMetadata(jid, sticker, { packName, packPublisher }, options) }); }
            catch (err) { results.push({ success: false, error: err.message }); }
            if (delayMs > 0) await _sleep(delayMs);
        }
        return results;
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  SIMPLE MEDIA
    // ─────────────────────────────────────────────────────────────────────────
    const sendDocument = async (jid, document, fileName, mimetype, caption, options = {}) => {
        if (!document) throw new Error("sendDocument: document wajib");
        if (!fileName) throw new Error("sendDocument: fileName wajib");
        return sock.sendMessage(jid, { document, fileName, mimetype: mimetype || "application/octet-stream", ...(caption ? { caption } : {}) }, options);
    };
    const sendAudio = async (jid, audio, isPtt = false, options = {}) => {
        if (!audio) throw new Error("sendAudio: audio wajib");
        return sock.sendMessage(jid, { audio, mimetype: isPtt ? "audio/ogg; codecs=opus" : "audio/mp4", ptt: isPtt }, options);
    };
    const sendImage = async (jid, image, caption, options = {}) => { if (!image) throw new Error("sendImage: image wajib"); return sock.sendMessage(jid, { image, ...(caption ? { caption } : {}) }, options); };
    const sendVideo = async (jid, video, caption, options = {}) => { if (!video) throw new Error("sendVideo: video wajib"); return sock.sendMessage(jid, { video, ...(caption ? { caption } : {}) }, options); };
    const sendAudioPTT = async (jid, audio, options = {}) => sendAudio(jid, audio, true, options);
    const sendVoiceNote = async (jid, audio, options = {}) => sendAudio(jid, audio, true, options);

    // ─────────────────────────────────────────────────────────────────────────
    //  REPLY / QUOTE
    // ─────────────────────────────────────────────────────────────────────────
    const sendReply = async (jid, text, quotedMessage, options = {}) => { if (!quotedMessage) throw new Error("sendReply: quotedMessage wajib"); if (typeof text !== "string") throw new Error("sendReply: text harus string"); return sock.sendMessage(jid, { text }, { quoted: quotedMessage, ...options }); };
    const sendMediaReply = async (jid, content, quotedMessage, options = {}) => { if (!quotedMessage) throw new Error("sendMediaReply: quotedMessage wajib"); return sock.sendMessage(jid, content, { quoted: quotedMessage, ...options }); };
    const sendQuotedText = async (jid, text, quotedMessage, mentions, options = {}) => { if (!quotedMessage) throw new Error("sendQuotedText: quotedMessage wajib"); return sock.sendMessage(jid, { text, ...(mentions?.length ? { mentions } : {}) }, { quoted: quotedMessage, ...options }); };
    const sendWithMentionAndReply = async (jid, text, quotedMessage, mentions = [], options = {}) => { if (!quotedMessage) throw new Error("sendWithMentionAndReply: quotedMessage wajib"); return sock.sendMessage(jid, { text, ...(mentions.length ? { mentions } : {}) }, { quoted: quotedMessage, ...options }); };
    const sendWithQuotedFake = async (jid, text, fakeQuoted = {}, options = {}) => {
        const { sender, text: quotedText, id } = fakeQuoted;
        if (!sender) throw new Error("sendWithQuotedFake: fakeQuoted.sender wajib");
        if (!quotedText) throw new Error("sendWithQuotedFake: fakeQuoted.text wajib");
        const fakeMsg = {
            key: {
                fromMe: false,
                participant: sender,
                remoteJid: jid,
                id: id || (0, crypto_1.randomBytes)(8).toString("hex").toUpperCase(),
            },
            message: { conversation: quotedText },
        };
        return sock.sendMessage(jid, { text }, { quoted: fakeMsg, ...options });
    };
    const forwardWithComment = async (jid, message, comment, options = {}) => {
        if (!message) throw new Error("forwardWithComment: message wajib");
        await sock.sendMessage(jid, { text: comment }, options);
        return sock.sendMessage(jid, { forward: message, force: true }, options);
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  GROUP INVITE
    // ─────────────────────────────────────────────────────────────────────────
    const sendGroupInvite = async (jid, groupJid, options = {}) => {
        if (!_isGrp(groupJid)) throw new Error("sendGroupInvite: groupJid harus @g.us");
        const [code, meta] = await Promise.all([sock.groupInviteCode(groupJid), sock.groupMetadata(groupJid)]);
        return sock.sendMessage(jid, {
            groupInviteMessage: {
                groupJid, inviteCode: code,
                inviteExpiration: Math.floor(Date.now() / 1000) + 259200,
                groupName: meta.subject, caption: options.caption || "",
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

    // ─────────────────────────────────────────────────────────────────────────
    //  CHAT MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────
    const muteJid = async (jid, durationMs = 8 * 60 * 60 * 1000) => sock.chatModify({ mute: durationMs }, jid);
    const unmuteJid = async (jid) => sock.chatModify({ mute: null }, jid);
    const archiveChat = async (jid, lastMessage) => { if (!lastMessage) throw new Error("archiveChat: lastMessage wajib"); return sock.chatModify({ archive: true, lastMessages: [lastMessage] }, jid); };
    const unarchiveChat = async (jid, lastMessage) => { if (!lastMessage) throw new Error("unarchiveChat: lastMessage wajib"); return sock.chatModify({ archive: false, lastMessages: [lastMessage] }, jid); };
    const pinChat = async (jid) => sock.chatModify({ pin: true }, jid);
    const unpinChat = async (jid) => sock.chatModify({ pin: false }, jid);
    const markAsRead = async (keys) => sock.readMessages(Array.isArray(keys) ? keys : [keys]);
    const sendSeen = async (jid, messages = []) => sock.readMessages(messages.map(m => m.key || m));
    const markAsUnread = async (jid, lastMessage) => { if (!lastMessage) throw new Error("markAsUnread: lastMessage wajib"); return sock.chatModify({ markRead: false, lastMessages: [lastMessage] }, jid); };
    const blockUser = async (jid) => sock.updateBlockStatus(_norm(jid), "block");
    const unblockUser = async (jid) => sock.updateBlockStatus(_norm(jid), "unblock");
    const starMessage = async (jid, messageId, fromMe = false) => sock.chatModify({ star: { messages: [{ id: messageId, fromMe }], star: true } }, jid);
    const unstarMessage = async (jid, messageId, fromMe = false) => sock.chatModify({ star: { messages: [{ id: messageId, fromMe }], star: false } }, jid);
    const deleteChat = async (jid, lastMessage) => { if (!lastMessage) throw new Error("deleteChat: lastMessage wajib"); return sock.chatModify({ delete: true, lastMessages: [{ key: lastMessage.key, messageTimestamp: lastMessage.messageTimestamp }] }, jid); };
    const clearChat = async (jid, messages = []) => sock.chatModify({ clear: { messages: messages.map(m => ({ id: m.key.id, fromMe: m.key.fromMe, timestamp: m.messageTimestamp })) } }, jid);
    const sendLinkPreview = async (jid, text, options = {}) => sock.sendMessage(jid, { text, detectLinks: true }, options);
    const sendDisappearingToggle = async (jid, enable = true) => sock.sendMessage(jid, { disappearingMessagesInChat: enable ? 86400 : false });

    // ─────────────────────────────────────────────────────────────────────────
    //  PROFILE
    // ─────────────────────────────────────────────────────────────────────────
    const getProfilePicture = async (jid, highRes = false) => { try { return await sock.profilePictureUrl(jid, highRes ? "image" : "preview"); } catch { return null; } };
    const getUserStatus = async (jid) => { try { return await sock.fetchStatus(jid); } catch { return null; } };
    const getContactInfo = async (jid) => {
        const [onWA, pic, status] = await Promise.allSettled([isOnWhatsApp(jid), getProfilePicture(jid, true), getUserStatus(jid)]);
        return {
            jid,
            exists: onWA.status === "fulfilled" ? onWA.value?.exists : false,
            profilePic: pic.status === "fulfilled" ? pic.value : null,
            status: status.status === "fulfilled" ? status.value : null,
        };
    };
    const updateProfilePicture = async (jid, image) => { if (!image) throw new Error("updateProfilePicture: image wajib"); return sock.updateProfilePicture(jid, image); };
    const removeProfilePicture = async (jid) => sock.removeProfilePicture(jid);
    const updateProfileName = async (name) => { if (!name) throw new Error("updateProfileName: name wajib"); return sock.updateProfileName(name); };
    const updateProfileStatus = async (status) => { if (typeof status !== "string") throw new Error("updateProfileStatus: harus string"); return sock.updateProfileStatus(status); };

    // ─────────────────────────────────────────────────────────────────────────
    //  DISAPPEARING
    // ─────────────────────────────────────────────────────────────────────────
    const sendDisappearingMessage = async (jid, content, expiration, options = {}) => {
        if (![0, 86400, 604800, 7776000].includes(expiration))
            throw new Error("sendDisappearingMessage: expiration harus 0/86400/604800/7776000");
        return sock.sendMessage(jid, content, { ephemeralExpiration: expiration, ...options });
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  MISC
    // ─────────────────────────────────────────────────────────────────────────
    const isOnWhatsApp = async (jidOrNumber) => {
        let jid = jidOrNumber;
        if (!jid.includes("@")) jid = jid.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        const result = await sock.onWhatsApp(jid);
        return (Array.isArray(result) ? result[0] : result) || { exists: false, jid };
    };
    const rejectAllCalls = () => sock.ev.on("call", async ([call]) => { try { await sock.rejectCall(call.id, call.from); } catch { } });
    const getBusinessProfile = async (jid) => { try { return await sock.getBusinessProfile(_norm(jid)); } catch { return null; } };
    const fetchMessageHistory = async (jid, count = 25, oldestMsg) => { if (!oldestMsg) throw new Error("fetchMessageHistory: oldestMsg wajib"); return sock.fetchMessageHistory(count, oldestMsg.key, oldestMsg.messageTimestamp); };
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

    // ─────────────────────────────────────────────────────────────────────────
    //  INTERACTIVE — Buttons / List / Template
    // ─────────────────────────────────────────────────────────────────────────
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
                    rows: (s.rows || []).map(r => ({
                        rowId: r.rowId || r.id,
                        title: r.title,
                        description: r.description || "",
                    })),
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
            const typeMap = { image: "image", video: "video", document: "document" };
            if (typeMap[header.type]) {
                const inner = await (0, Utils_1.generateWAMessageContent)(
                    { [header.type]: header.content, ...(header.type === "document" ? { fileName: header.fileName } : {}) },
                    { upload: waUploadToServer }
                );
                const msgKey = `${header.type}Message`;
                headerContent = { [msgKey]: { ...inner[msgKey], ...(header.caption ? { caption: header.caption } : {}) } };
            }
        }
        let action = null;
        if (buttons?.length) {
            action = { buttons: buttons.map(b => ({ buttonId: b.id, buttonText: { displayText: b.displayText }, type: 1 })) };
        } else if (sections?.length) {
            action = {
                sections: sections.map(s => ({
                    title: s.title,
                    rows: (s.rows || []).map(r => ({ rowId: r.id || r.rowId, title: r.title, description: r.description || "" })),
                })),
                buttonText: cfg.listButtonText || "Pilih",
            };
        } else if (nativeFlow) {
            action = { nativeFlowMessage: { name: nativeFlow.name, paramsJson: nativeFlow.paramsJson || "{}" } };
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

    const sendHighlyStructuredMessage = async (jid, cfg = {}) => {
        const { namespace, elementName, params = [] } = cfg;
        if (!namespace || !elementName) throw new Error("sendHighlyStructuredMessage: namespace dan elementName wajib");
        const msg = _gen(jid, {
            highlyStructuredMessage: {
                namespace, elementName,
                params: params.map(p => ({ default: p })),
                deterministicLottie: cfg.deterministicLottie || false,
                fallbackLg: "id", fallbackLc: "ID",
            },
        });
        return _relay(jid, msg);
    };

    // ─── Media + Buttons ──────────────────────────────────────────────────────
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

    // ─── Newsletter ───────────────────────────────────────────────────────────
    const sendNewsletterMessage = async (newsletterJid, content, options = {}) => { if (!newsletterJid.endsWith("@newsletter")) throw new Error("sendNewsletterMessage: harus @newsletter JID"); return sock.sendMessage(newsletterJid, content, options); };
    const sendNewsletterReaction = async (newsletterJid, messageId, emoji) => {
        if (!newsletterJid.endsWith("@newsletter")) throw new Error("sendNewsletterReaction: harus @newsletter JID");
        return query({ tag: "iq", attrs: { to: newsletterJid, type: "set", xmlns: "w:newsletter" }, content: [{ tag: "reaction", attrs: { "message_id": messageId }, content: [{ tag: "text", attrs: {}, content: emoji }] }] });
    };
    const getNewsletterInfo = async (newsletterJid) => {
        if (!newsletterJid.endsWith("@newsletter")) throw new Error("getNewsletterInfo: harus @newsletter JID");
        return query({ tag: "iq", attrs: { to: newsletterJid, type: "get", xmlns: "w:newsletter" }, content: [{ tag: "metadata", attrs: {} }] });
    };

    // ─── Product ──────────────────────────────────────────────────────────────
    const sendProductMessage = async (jid, productId, catalogJid, options = {}) => {
        const bizJid = _norm(catalogJid || _me());
        const catalog = await getCatalog({ jid: bizJid });
        const product = catalog?.products?.find(p => p.id === productId);
        if (!product) throw new Error(`sendProductMessage: produk ${productId} tidak ditemukan`);
        const msg = _gen(jid, {
            productMessage: {
                product: {
                    productId: product.id, title: product.title,
                    description: product.description || "", currencyCode: product.currency,
                    priceAmount1000: product.price, retailerId: product.retailerId || "",
                    url: product.url || "", productImageCount: product.images?.length || 0,
                    firstImageId: product.images?.[0]?.id || "",
                },
                businessOwnerJid: bizJid, catalog: { catalogJid: bizJid },
            },
        });
        return _relay(jid, msg);
    };

    const sendLocationReply = async (jid, latitude, longitude, name, quotedMessage, options = {}) => {
        if (typeof latitude !== "number" || typeof longitude !== "number") throw new Error("sendLocationReply: lat/lng harus number");
        if (!quotedMessage) throw new Error("sendLocationReply: quotedMessage wajib");
        return sock.sendMessage(jid, { location: { degreesLatitude: latitude, degreesLongitude: longitude, ...(name ? { name } : {}) } }, { quoted: quotedMessage, ...options });
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  EXPORTS
    // ─────────────────────────────────────────────────────────────────────────
    return {
        ...sock,
        logger: config.logger,

        // Catalog
        getCatalog, getCollections, getOrderDetails,
        productCreate, productDelete, productUpdate,

        // Group
        groupTagAll, groupStatusV2, getGroupAdmins, isGroupAdmin,
        sendToAdminsOnly, bulkGroupAction, setGroupDisappearing,
        sendTagAll, sendGroupInvite, sendAdminInvite,
        updateGroupName, updateGroupDescription, updateGroupSetting,
        revokeGroupInvite, getGroupInviteLink, joinGroupViaLink, leaveGroup,
        getGroupParticipants, setGroupJoinApproval, getGroupJoinRequests,
        approveGroupJoinRequest, rejectGroupJoinRequest,
        setGroupMemberAddMode, updateGroupProfilePicture, sendMentionAll,

        // Status
        sendStatus,

        // Media
        sendImage, sendVideo, sendAudio, sendAudioPTT, sendVoiceNote,
        sendDocument, sendGIF, sendPTV, sendViewOnce, sendAlbum,
        sendLocation, sendLocationReply, sendLiveLocation,
        sendContact, sendPoll, sendEvent, sendScheduledCall,
        sendLinkPreview, sendDisappearingToggle,

        // Sticker
        sendStickerFromUrl, sendStickerFromBuffer,
        sendStickerWithMetadata, sendStickerPack, sendStickerMessage,

        // Interactive
        sendButtonsMessage, sendListMessage, sendTemplateMessage,
        sendInteractiveMessage, sendHighlyStructuredMessage,
        sendNewsletterMessage, sendNewsletterReaction, getNewsletterInfo,
        sendProductMessage, sendImageWithButtons, sendVideoWithButtons,
        sendDocumentWithButtons,

        // Reply / quote
        sendReply, sendMediaReply, sendQuotedText,
        sendWithQuotedFake, sendWithMentionAndReply, forwardWithComment,

        // Mentions / typing
        sendTextWithMentions, sendTyping, sendWithTyping,

        // Broadcast
        broadcastMessage, broadcastToGroups, sendMultipleMessages,

        // Message actions
        pinMessage, keepMessage, editMessage, deleteMessage,
        reactMessage, forwardMessage,

        // Chat management
        muteJid, unmuteJid, archiveChat, unarchiveChat,
        pinChat, unpinChat, markAsRead, markAsUnread,
        blockUser, unblockUser, starMessage, unstarMessage,
        deleteChat, clearChat, sendSeen,

        // Profile
        getProfilePicture, getUserStatus, updateProfilePicture,
        removeProfilePicture, updateProfileName, updateProfileStatus,
        getContactInfo, getBusinessProfile, fetchBlocklist, fetchAllGroups,
        fetchMessageHistory,

        // Privacy
        updatePrivacyLastSeen, updatePrivacyProfilePic, updatePrivacyStatus,
        updatePrivacyReadReceipts, updatePrivacyGroupsAdd, updatePrivacyOnline,
        setDefaultDisappearing,

        // Misc
        sendDisappearingMessage, isOnWhatsApp, presenceSubscribe, rejectAllCalls,
    };
};

exports.makeBusinessSocket = makeBusinessSocket;