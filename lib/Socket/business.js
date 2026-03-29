"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeBusinessSocket = void 0;

const crypto_1 = require("crypto");
const business_1 = require("../Utils/business");
const Utils_1 = require("../Utils");
const WABinary_1 = require("../WABinary");
const generic_utils_1 = require("../WABinary/generic-utils");
const messages_recv_1 = require("./messages-recv");

const makeBusinessSocket = (config) => {
    const sock = (0, messages_recv_1.makeMessagesRecvSocket)(config);
    const { authState, query, waUploadToServer } = sock;

    const getCatalog = async ({ jid, limit, cursor }) => {
        var _a;
        jid = jid || ((_a = authState.creds.me) === null || _a === void 0 ? void 0 : _a.id);
        jid = (0, WABinary_1.jidNormalizedUser)(jid);
        const queryParamNodes = [
            { tag: 'limit', attrs: {}, content: Buffer.from((limit || 10).toString()) },
            { tag: 'width', attrs: {}, content: Buffer.from('100') },
            { tag: 'height', attrs: {}, content: Buffer.from('100') },
        ];
        if (cursor) queryParamNodes.push({ tag: 'after', attrs: {}, content: cursor });
        const result = await query({
            tag: 'iq',
            attrs: { to: WABinary_1.S_WHATSAPP_NET, type: 'get', xmlns: 'w:biz:catalog' },
            content: [{ tag: 'product_catalog', attrs: { jid, 'allow_shop_source': 'true' }, content: queryParamNodes }]
        });
        return (0, business_1.parseCatalogNode)(result);
    };

    const getCollections = async (jid, limit = 51) => {
        var _a;
        jid = jid || ((_a = authState.creds.me) === null || _a === void 0 ? void 0 : _a.id);
        jid = (0, WABinary_1.jidNormalizedUser)(jid);
        const result = await query({
            tag: 'iq',
            attrs: { to: WABinary_1.S_WHATSAPP_NET, type: 'get', xmlns: 'w:biz:catalog', 'smax_id': '35' },
            content: [{
                tag: 'collections',
                attrs: { 'biz_jid': jid },
                content: [
                    { tag: 'collection_limit', attrs: {}, content: Buffer.from(limit.toString()) },
                    { tag: 'item_limit', attrs: {}, content: Buffer.from(limit.toString()) },
                    { tag: 'width', attrs: {}, content: Buffer.from('100') },
                    { tag: 'height', attrs: {}, content: Buffer.from('100') }
                ]
            }]
        });
        return (0, business_1.parseCollectionsNode)(result);
    };

    const getOrderDetails = async (orderId, tokenBase64) => {
        const result = await query({
            tag: 'iq',
            attrs: { to: WABinary_1.S_WHATSAPP_NET, type: 'get', xmlns: 'fb:thrift_iq', 'smax_id': '5' },
            content: [{
                tag: 'order',
                attrs: { op: 'get', id: orderId },
                content: [
                    { tag: 'image_dimensions', attrs: {}, content: [
                        { tag: 'width', attrs: {}, content: Buffer.from('100') },
                        { tag: 'height', attrs: {}, content: Buffer.from('100') }
                    ]},
                    { tag: 'token', attrs: {}, content: Buffer.from(tokenBase64) }
                ]
            }]
        });
        return (0, business_1.parseOrderDetailsNode)(result);
    };

    const productUpdate = async (productId, update) => {
        update = await (0, business_1.uploadingNecessaryImagesOfProduct)(update, waUploadToServer);
        const editNode = (0, business_1.toProductNode)(productId, update);
        const result = await query({
            tag: 'iq',
            attrs: { to: WABinary_1.S_WHATSAPP_NET, type: 'set', xmlns: 'w:biz:catalog' },
            content: [{
                tag: 'product_catalog_edit',
                attrs: { v: '1' },
                content: [editNode, { tag: 'width', attrs: {}, content: '100' }, { tag: 'height', attrs: {}, content: '100' }]
            }]
        });
        const productCatalogEditNode = (0, generic_utils_1.getBinaryNodeChild)(result, 'product_catalog_edit');
        const productNode = (0, generic_utils_1.getBinaryNodeChild)(productCatalogEditNode, 'product');
        return (0, business_1.parseProductNode)(productNode);
    };

    const productCreate = async (create) => {
        create.isHidden = !!create.isHidden;
        create = await (0, business_1.uploadingNecessaryImagesOfProduct)(create, waUploadToServer);
        const createNode = (0, business_1.toProductNode)(undefined, create);
        const result = await query({
            tag: 'iq',
            attrs: { to: WABinary_1.S_WHATSAPP_NET, type: 'set', xmlns: 'w:biz:catalog' },
            content: [{
                tag: 'product_catalog_add',
                attrs: { v: '1' },
                content: [createNode, { tag: 'width', attrs: {}, content: '100' }, { tag: 'height', attrs: {}, content: '100' }]
            }]
        });
        const productCatalogAddNode = (0, generic_utils_1.getBinaryNodeChild)(result, 'product_catalog_add');
        const productNode = (0, generic_utils_1.getBinaryNodeChild)(productCatalogAddNode, 'product');
        return (0, business_1.parseProductNode)(productNode);
    };

    const productDelete = async (productIds) => {
        const result = await query({
            tag: 'iq',
            attrs: { to: WABinary_1.S_WHATSAPP_NET, type: 'set', xmlns: 'w:biz:catalog' },
            content: [{
                tag: 'product_catalog_delete',
                attrs: { v: '1' },
                content: productIds.map(id => ({
                    tag: 'product',
                    attrs: {},
                    content: [{ tag: 'id', attrs: {}, content: Buffer.from(id) }]
                }))
            }]
        });
        const productCatalogDelNode = (0, generic_utils_1.getBinaryNodeChild)(result, 'product_catalog_delete');
        return { deleted: +((productCatalogDelNode === null || productCatalogDelNode === void 0 ? void 0 : productCatalogDelNode.attrs.deleted_count) || 0) };
    };

    const groupTagAll = async (groupJid, scope = 'all') => {
        if (!(0, WABinary_1.isJidGroup)(groupJid)) throw new Error(`groupTagAll: harus group JID (@g.us), dapat: ${groupJid}`);
        const meta = await sock.groupMetadata(groupJid);
        const participants = meta.participants || [];
        let filtered;
        switch (scope) {
            case 'admins':     filtered = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin'); break;
            case 'non_admins': filtered = participants.filter(p => !p.admin); break;
            default:           filtered = participants;
        }
        return filtered.map(p => p.id || p.jid);
    };

    const groupStatusV2 = async (jid, content) => {
        if (!(0, WABinary_1.isJidGroup)(jid)) throw new Error(`groupStatusV2: jid harus group JID (@g.us), dapat: ${jid}`);
        const { backgroundColor, font, ...msgContent } = content;
        const inside = await (0, Utils_1.generateWAMessageContent)(msgContent, {
            upload: waUploadToServer,
            ...(backgroundColor ? { backgroundColor } : {}),
            ...(font !== undefined ? { font } : {})
        });
        const messageSecret = (0, crypto_1.randomBytes)(32);
        const m = (0, Utils_1.generateWAMessageFromContent)(jid, {
            messageContextInfo: { messageSecret },
            groupStatusMessageV2: { message: { ...inside, messageContextInfo: { messageSecret } } }
        }, {});
        await sock.relayMessage(jid, m.message, { messageId: m.key.id });
        return m;
    };

    const sendStatus = async (content, statusJidList) => {
        const STATUS_JID = 'status@broadcast';
        const { backgroundColor, font, ...msgContent } = content;
        const msg = await (0, Utils_1.generateWAMessage)(STATUS_JID, msgContent, {
            upload: waUploadToServer,
            userJid: authState.creds.me.id,
            ...(backgroundColor ? { backgroundColor } : {}),
            ...(font !== undefined ? { font } : {})
        });
        await sock.relayMessage(STATUS_JID, msg.message, {
            messageId: msg.key.id,
            ...(statusJidList ? { statusJidList } : {})
        });
        return msg;
    };

    const sendViewOnce = async (jid, content, options = {}) => {
        if (!content.image && !content.video && !content.audio) throw new Error('sendViewOnce: harus berisi image, video, atau audio');
        return sock.sendMessage(jid, { ...content, viewOnce: true }, options);
    };

    const sendPTV = async (jid, video, options = {}) => {
        if (!video) throw new Error('sendPTV: video buffer/url wajib diisi');
        return sock.sendMessage(jid, { video, ptv: true }, options);
    };

    const sendGIF = async (jid, video, caption, options = {}) => {
        if (!video) throw new Error('sendGIF: video buffer/url wajib diisi');
        return sock.sendMessage(jid, { video, gifPlayback: true, ...(caption ? { caption } : {}) }, options);
    };

    const sendAlbum = async (jid, items, options = {}) => {
        if (!Array.isArray(items) || items.length === 0) throw new Error('sendAlbum: items harus array yang tidak kosong');
        if (items.length > 10) throw new Error('sendAlbum: maksimal 10 item per album');
        for (const item of items) {
            if (!item.image && !item.video) throw new Error('sendAlbum: setiap item harus memiliki image atau video');
        }
        return sock.sendMessage(jid, { album: items }, options);
    };

    const sendPoll = async (jid, question, choices, cfg = {}) => {
        const { selectableCount = 0, toAnnouncementGroup = false, msgOptions = {} } = cfg;
        if (!question || typeof question !== 'string') throw new Error('sendPoll: question wajib berupa string');
        if (!Array.isArray(choices) || choices.length < 2) throw new Error('sendPoll: minimal 2 pilihan');
        if (choices.length > 12) throw new Error('sendPoll: maksimal 12 pilihan');
        return sock.sendMessage(jid, { poll: { name: question, values: choices, selectableCount, toAnnouncementGroup } }, msgOptions);
    };

    const sendEvent = async (jid, eventData, options = {}) => {
        const { name, description, startTime, endTime, location, joinLink } = eventData;
        if (!name || !startTime) throw new Error('sendEvent: name dan startTime wajib diisi');
        if (typeof startTime !== 'number') throw new Error('sendEvent: startTime harus berupa ms timestamp (number)');
        const messageSecret = (0, crypto_1.randomBytes)(32);
        return sock.sendMessage(jid, {
            event: {
                name,
                description: description || '',
                startTime: Math.floor(startTime / 1000),
                ...(endTime  ? { endTime: Math.floor(endTime / 1000) } : {}),
                ...(location ? { location: { name: location } }        : {}),
                ...(joinLink ? { joinLink }                             : {}),
                messageSecret
            }
        }, options);
    };

    const sendScheduledCall = async (jid, title, time, callType = 1, options = {}) => {
        if (!title) throw new Error('sendScheduledCall: title wajib diisi');
        if (!time || typeof time !== 'number') throw new Error('sendScheduledCall: time harus ms timestamp');
        if (![1, 2].includes(callType)) throw new Error('sendScheduledCall: callType harus 1 (video) atau 2 (voice)');
        return sock.sendMessage(jid, { call: { title, time: Math.floor(time / 1000), type: callType } }, options);
    };

    const pinMessage = async (jid, messageKey, duration = 86400) => {
        if (!messageKey) throw new Error('pinMessage: messageKey wajib diisi');
        const isUnpin = duration === 0;
        return sock.sendMessage(jid, { pin: messageKey, type: isUnpin ? 2 : 1, time: isUnpin ? 0 : duration });
    };

    const keepMessage = async (jid, messageKey, keep = true) => {
        if (!messageKey) throw new Error('keepMessage: messageKey wajib diisi');
        return sock.sendMessage(jid, { keep: messageKey, type: keep ? 1 : 2 });
    };

    const editMessage = async (jid, messageKey, newText) => {
        if (!messageKey) throw new Error('editMessage: messageKey wajib diisi');
        if (typeof newText !== 'string') throw new Error('editMessage: newText harus string');
        return sock.sendMessage(jid, { text: newText, edit: messageKey });
    };

    const deleteMessage = async (jid, messageKey) => {
        if (!messageKey) throw new Error('deleteMessage: messageKey wajib diisi');
        return sock.sendMessage(jid, { delete: messageKey });
    };

    const reactMessage = async (jid, messageKey, emoji) => {
        if (!messageKey) throw new Error('reactMessage: messageKey wajib diisi');
        if (typeof emoji !== 'string') throw new Error('reactMessage: emoji harus string (kosong untuk hapus)');
        return sock.sendMessage(jid, { react: { text: emoji, key: messageKey } });
    };

    const forwardMessage = async (jid, message, forceForward = false, options = {}) => {
        if (!message) throw new Error('forwardMessage: message wajib diisi');
        return sock.sendMessage(jid, { forward: message, force: forceForward }, options);
    };

    const sendLocation = async (jid, latitude, longitude, name, options = {}) => {
        if (typeof latitude !== 'number' || typeof longitude !== 'number') throw new Error('sendLocation: latitude dan longitude harus number');
        return sock.sendMessage(jid, {
            location: { degreesLatitude: latitude, degreesLongitude: longitude, ...(name ? { name } : {}) }
        }, options);
    };

    const sendContact = async (jid, contacts, options = {}) => {
        const list = Array.isArray(contacts) ? contacts : [contacts];
        if (list.length === 0) throw new Error('sendContact: minimal 1 kontak');
        const mapped = list.map((c, idx) => {
            if (!c.fullName) throw new Error(`sendContact: fullName wajib diisi (index ${idx})`);
            if (c.vcard) return { vcard: c.vcard, displayName: c.fullName };
            if (!c.phoneNumber) throw new Error(`sendContact: phoneNumber wajib diisi (index ${idx})`);
            const cleanPhone = c.phoneNumber.replace(/[^0-9]/g, '');
            const vcard = [
                'BEGIN:VCARD',
                'VERSION:3.0',
                `FN:${c.fullName}`,
                ...(c.org   ? [`ORG:${c.org}`]     : []),
                ...(c.email ? [`EMAIL:${c.email}`] : []),
                `TEL;type=CELL;type=VOICE;waid=${cleanPhone}:${c.phoneNumber}`,
                'END:VCARD'
            ].join('\n');
            return { vcard, displayName: c.fullName };
        });
        return sock.sendMessage(jid, { contacts: { contacts: mapped } }, options);
    };

    const sendTagAll = async (jid, text, scope = 'all', options = {}) => {
        if (!(0, WABinary_1.isJidGroup)(jid)) throw new Error('sendTagAll: hanya bisa digunakan di group');
        const jids = await groupTagAll(jid, scope);
        if (jids.length === 0) return null;
        return sock.sendMessage(jid, { text: text || '@everyone', mentions: jids }, options);
    };

    const sendTyping = async (jid, duration = 3000, type = 'composing') => {
        const validTypes = ['composing', 'recording', 'paused', 'available', 'unavailable'];
        if (!validTypes.includes(type)) throw new Error(`sendTyping: type tidak valid. Pilihan: ${validTypes.join(', ')}`);
        await sock.sendPresenceUpdate(type, jid);
        if (duration > 0) {
            await new Promise(resolve => setTimeout(resolve, duration));
            await sock.sendPresenceUpdate('paused', jid);
        }
    };

    const sendWithTyping = async (jid, content, options = {}, typingMs = 1500) => {
        await sock.sendPresenceUpdate('composing', jid);
        await new Promise(resolve => setTimeout(resolve, Math.min(typingMs, 5000)));
        await sock.sendPresenceUpdate('paused', jid);
        return sock.sendMessage(jid, content, options);
    };

    const sendTextWithMentions = async (jid, text, mentionJids, options = {}) => {
        if (!Array.isArray(mentionJids) || mentionJids.length === 0) throw new Error('sendTextWithMentions: mentionJids harus array yang tidak kosong');
        return sock.sendMessage(jid, { text, mentions: mentionJids }, options);
    };

    const broadcastMessage = async (jids, content, options = {}) => {
        if (!Array.isArray(jids) || jids.length === 0) throw new Error('broadcastMessage: jids harus array yang tidak kosong');
        const delayMs = options.delayMs || 500;
        const results = [];
        for (const jid of jids) {
            try {
                const msg = await sock.sendMessage(jid, content, options);
                results.push({ jid, success: true, msg });
            } catch (err) {
                results.push({ jid, success: false, error: err.message });
            }
            if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        return results;
    };

    const sendStickerFromUrl = async (jid, url, options = {}) => {
        if (!url) throw new Error('sendStickerFromUrl: url wajib diisi');
        return sock.sendMessage(jid, { sticker: { url } }, options);
    };

    const sendLiveLocation = async (jid, latitude, longitude, accuracyInMeters = 10, durationInSeconds = 300, options = {}) => {
        if (typeof latitude !== 'number' || typeof longitude !== 'number') throw new Error('sendLiveLocation: latitude dan longitude harus number');
        return sock.sendMessage(jid, {
            liveLocation: {
                degreesLatitude: latitude,
                degreesLongitude: longitude,
                accuracyInMeters,
                speedInMps: 0,
                degreesClockwiseFromMagneticNorth: 0,
                sequenceNumber: 1,
                timeOffset: 0
            },
            ...(options.caption    ? { caption: options.caption }       : {}),
            ...(options.thumbnail  ? { jpegThumbnail: options.thumbnail } : {})
        }, options);
    };

    const isOnWhatsApp = async (jidOrNumber) => {
        let jid = jidOrNumber;
        if (!jid.includes('@')) jid = jid.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        const [result] = await sock.onWhatsApp(jid);
        return result || { exists: false, jid };
    };

    const sendStickerWithMetadata = async (jid, sticker, metadata = {}, options = {}) => {
        if (!sticker) throw new Error('sendStickerWithMetadata: sticker buffer/url wajib diisi');
        const { packName, packPublisher, categories, isAvatar, isAiSticker } = metadata;
        return sock.sendMessage(jid, {
            sticker,
            ...(packName      ? { stickerPackName: packName }           : {}),
            ...(packPublisher ? { stickerPackPublisher: packPublisher } : {}),
            ...(categories    ? { categories }                          : {}),
            ...(isAvatar      ? { isAvatar: true }                      : {}),
            ...(isAiSticker   ? { isAiSticker: true }                   : {})
        }, options);
    };

    const sendStickerPack = async (jid, stickers, packName, packPublisher, options = {}) => {
        if (!Array.isArray(stickers) || stickers.length === 0) throw new Error('sendStickerPack: stickers harus array yang tidak kosong');
        if (stickers.length > 30) throw new Error('sendStickerPack: maksimal 30 sticker per pack');
        const delayMs = options.delayMs || 300;
        const results = [];
        for (const sticker of stickers) {
            try {
                const msg = await sendStickerWithMetadata(jid, sticker, { packName, packPublisher }, options);
                results.push({ success: true, msg });
            } catch (err) {
                results.push({ success: false, error: err.message });
            }
            if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        return results;
    };

    const sendDocument = async (jid, document, fileName, mimetype, caption, options = {}) => {
        if (!document) throw new Error('sendDocument: document buffer/url wajib diisi');
        if (!fileName) throw new Error('sendDocument: fileName wajib diisi');
        return sock.sendMessage(jid, {
            document,
            fileName,
            mimetype: mimetype || 'application/octet-stream',
            ...(caption ? { caption } : {})
        }, options);
    };

    const sendAudio = async (jid, audio, isPtt = false, options = {}) => {
        if (!audio) throw new Error('sendAudio: audio buffer/url wajib diisi');
        return sock.sendMessage(jid, {
            audio,
            mimetype: isPtt ? 'audio/ogg; codecs=opus' : 'audio/mp4',
            ptt: isPtt
        }, options);
    };

    const sendImage = async (jid, image, caption, options = {}) => {
        if (!image) throw new Error('sendImage: image buffer/url wajib diisi');
        return sock.sendMessage(jid, { image, ...(caption ? { caption } : {}) }, options);
    };

    const sendVideo = async (jid, video, caption, options = {}) => {
        if (!video) throw new Error('sendVideo: video buffer/url wajib diisi');
        return sock.sendMessage(jid, { video, ...(caption ? { caption } : {}) }, options);
    };

    const sendReply = async (jid, text, quotedMessage, options = {}) => {
        if (!quotedMessage) throw new Error('sendReply: quotedMessage wajib diisi');
        if (typeof text !== 'string') throw new Error('sendReply: text harus string');
        return sock.sendMessage(jid, { text }, { quoted: quotedMessage, ...options });
    };

    const sendMediaReply = async (jid, content, quotedMessage, options = {}) => {
        if (!quotedMessage) throw new Error('sendMediaReply: quotedMessage wajib diisi');
        return sock.sendMessage(jid, content, { quoted: quotedMessage, ...options });
    };

    const sendGroupInvite = async (jid, groupJid, options = {}) => {
        if (!(0, WABinary_1.isJidGroup)(groupJid)) throw new Error('sendGroupInvite: groupJid harus group JID (@g.us)');
        const code = await sock.groupInviteCode(groupJid);
        const meta = await sock.groupMetadata(groupJid);
        return sock.sendMessage(jid, {
            groupInviteMessage: {
                groupJid,
                inviteCode: code,
                inviteExpiration: Math.floor(Date.now() / 1000) + 259200,
                groupName: meta.subject,
                caption: options.caption || ''
            }
        }, options);
    };

    const muteJid = async (jid, durationMs = 8 * 60 * 60 * 1000) => {
        return sock.chatModify({ mute: durationMs }, jid);
    };

    const unmuteJid = async (jid) => {
        return sock.chatModify({ mute: null }, jid);
    };

    const archiveChat = async (jid, lastMessage) => {
        if (!lastMessage) throw new Error('archiveChat: lastMessage wajib diisi');
        return sock.chatModify({ archive: true, lastMessages: [lastMessage] }, jid);
    };

    const unarchiveChat = async (jid, lastMessage) => {
        if (!lastMessage) throw new Error('unarchiveChat: lastMessage wajib diisi');
        return sock.chatModify({ archive: false, lastMessages: [lastMessage] }, jid);
    };

    const pinChat = async (jid) => {
        return sock.chatModify({ pin: true }, jid);
    };

    const unpinChat = async (jid) => {
        return sock.chatModify({ pin: false }, jid);
    };

    const markAsRead = async (keys) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        return sock.readMessages(keyList);
    };

    const markAsUnread = async (jid, lastMessage) => {
        if (!lastMessage) throw new Error('markAsUnread: lastMessage wajib diisi');
        return sock.chatModify({ markRead: false, lastMessages: [lastMessage] }, jid);
    };

    const blockUser = async (jid) => {
        const normalized = (0, WABinary_1.jidNormalizedUser)(jid);
        return sock.updateBlockStatus(normalized, 'block');
    };

    const unblockUser = async (jid) => {
        const normalized = (0, WABinary_1.jidNormalizedUser)(jid);
        return sock.updateBlockStatus(normalized, 'unblock');
    };

    const getProfilePicture = async (jid, highRes = false) => {
        try {
            return await sock.profilePictureUrl(jid, highRes ? 'image' : 'preview');
        } catch {
            return null;
        }
    };

    const getUserStatus = async (jid) => {
        try {
            return await sock.fetchStatus(jid);
        } catch {
            return null;
        }
    };

    const sendDisappearingMessage = async (jid, content, expiration, options = {}) => {
        const validExpirations = [86400, 604800, 7776000];
        if (!validExpirations.includes(expiration)) throw new Error('sendDisappearingMessage: expiration harus 86400 (1h), 604800 (7d), atau 7776000 (90d)');
        return sock.sendMessage(jid, content, { ephemeralExpiration: expiration, ...options });
    };

    const setGroupDisappearing = async (jid, expiration) => {
        if (!(0, WABinary_1.isJidGroup)(jid)) throw new Error('setGroupDisappearing: harus group JID');
        return sock.groupToggleEphemeral(jid, expiration);
    };

    const getGroupAdmins = async (groupJid) => {
        if (!(0, WABinary_1.isJidGroup)(groupJid)) throw new Error('getGroupAdmins: harus group JID (@g.us)');
        const meta = await sock.groupMetadata(groupJid);
        return (meta.participants || []).filter(p => p.admin === 'admin' || p.admin === 'superadmin');
    };

    const isGroupAdmin = async (groupJid, userJid) => {
        const admins = await getGroupAdmins(groupJid);
        const normalized = (0, WABinary_1.jidNormalizedUser)(userJid);
        return admins.some(a => (0, WABinary_1.jidNormalizedUser)(a.id || a.jid) === normalized);
    };

    const sendToAdminsOnly = async (groupJid, content, options = {}) => {
        if (!(0, WABinary_1.isJidGroup)(groupJid)) throw new Error('sendToAdminsOnly: harus group JID');
        const adminJids = (await getGroupAdmins(groupJid)).map(a => a.id || a.jid);
        if (adminJids.length === 0) return null;
        return sock.sendMessage(groupJid, {
            ...(typeof content === 'string' ? { text: content } : content),
            mentions: adminJids
        }, options);
    };

    const bulkGroupAction = async (groupJid, participantJids, action) => {
        const validActions = ['add', 'remove', 'promote', 'demote'];
        if (!validActions.includes(action)) throw new Error(`bulkGroupAction: action tidak valid. Pilihan: ${validActions.join(', ')}`);
        if (!(0, WABinary_1.isJidGroup)(groupJid)) throw new Error('bulkGroupAction: harus group JID');
        if (!Array.isArray(participantJids) || participantJids.length === 0) throw new Error('bulkGroupAction: participantJids harus array yang tidak kosong');
        const chunkSize = 5;
        const results = [];
        for (let i = 0; i < participantJids.length; i += chunkSize) {
            const chunk = participantJids.slice(i, i + chunkSize);
            try {
                const res = await sock.groupParticipantsUpdate(groupJid, chunk, action);
                results.push(...res);
            } catch (err) {
                results.push(...chunk.map(jid => ({ jid, status: 'error', error: err.message })));
            }
            if (i + chunkSize < participantJids.length) await new Promise(resolve => setTimeout(resolve, 500));
        }
        return results;
    };

    const sendQuotedText = async (jid, text, quotedMessage, mentions, options = {}) => {
        if (!quotedMessage) throw new Error('sendQuotedText: quotedMessage wajib diisi');
        return sock.sendMessage(jid, {
            text,
            ...(mentions && mentions.length ? { mentions } : {})
        }, { quoted: quotedMessage, ...options });
    };

    const sendMultipleMessages = async (jid, contents, delayMs = 500) => {
        if (!Array.isArray(contents) || contents.length === 0) throw new Error('sendMultipleMessages: contents harus array yang tidak kosong');
        const results = [];
        for (const content of contents) {
            try {
                const msg = await sock.sendMessage(jid, content);
                results.push({ success: true, msg });
            } catch (err) {
                results.push({ success: false, error: err.message });
            }
            if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        return results;
    };

    const rejectAllCalls = () => {
        sock.ev.on('call', async ([call]) => {
            try {
                await sock.rejectCall(call.id, call.from);
            } catch {}
        });
    };

    return {
        ...sock,
        logger: config.logger,

        getOrderDetails,
        getCatalog,
        getCollections,
        productCreate,
        productDelete,
        productUpdate,

        groupTagAll,
        groupStatusV2,
        sendStatus,
        sendViewOnce,
        sendPTV,
        sendGIF,
        sendAlbum,
        sendPoll,
        sendEvent,
        sendScheduledCall,
        pinMessage,
        keepMessage,
        editMessage,
        deleteMessage,
        reactMessage,
        forwardMessage,
        sendLocation,
        sendContact,

        sendTagAll,
        sendTyping,
        sendWithTyping,
        sendTextWithMentions,
        broadcastMessage,
        sendStickerFromUrl,
        sendLiveLocation,
        isOnWhatsApp,

        sendStickerWithMetadata,
        sendStickerPack,
        sendDocument,
        sendAudio,
        sendImage,
        sendVideo,
        sendReply,
        sendMediaReply,
        sendGroupInvite,
        muteJid,
        unmuteJid,
        archiveChat,
        unarchiveChat,
        pinChat,
        unpinChat,
        markAsRead,
        markAsUnread,
        blockUser,
        unblockUser,
        getProfilePicture,
        getUserStatus,
        sendDisappearingMessage,
        setGroupDisappearing,
        getGroupAdmins,
        isGroupAdmin,
        sendToAdminsOnly,
        bulkGroupAction,
        sendQuotedText,
        sendMultipleMessages,
        rejectAllCalls,
    };
};
exports.makeBusinessSocket = makeBusinessSocket;