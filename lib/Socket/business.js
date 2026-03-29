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
        if (cursor) {
            queryParamNodes.push({ tag: 'after', attrs: {}, content: cursor });
        }
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

    const groupStatusV2 = async (jid, content) => {
        if (!(0, WABinary_1.isJidGroup)(jid)) {
            throw new Error(`groupStatusV2: jid harus group JID (@g.us), dapat: ${jid}`);
        }
        const { backgroundColor, font, ...msgContent } = content;
        const inside = await (0, Utils_1.generateWAMessageContent)(msgContent, {
            upload: waUploadToServer,
            ...(backgroundColor ? { backgroundColor } : {}),
            ...(font !== undefined ? { font } : {})
        });
        const messageSecret = (0, crypto_1.randomBytes)(32);
        const m = (0, Utils_1.generateWAMessageFromContent)(
            jid,
            {
                messageContextInfo: { messageSecret },
                groupStatusMessageV2: {
                    message: {
                        ...inside,
                        messageContextInfo: { messageSecret }
                    }
                }
            },
            {}
        );
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
        return sock.sendMessage(jid, { ...content, viewOnce: true }, options);
    };

    const sendPTV = async (jid, video, options = {}) => {
        return sock.sendMessage(jid, { video, ptv: true }, options);
    };

    const sendGIF = async (jid, video, caption, options = {}) => {
        return sock.sendMessage(jid, {
            video,
            gifPlayback: true,
            ...(caption ? { caption } : {})
        }, options);
    };

    const sendAlbum = async (jid, items, options = {}) => {
        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('sendAlbum: items harus array yang tidak kosong');
        }
        if (items.length > 10) {
            throw new Error('sendAlbum: maksimal 10 item per album');
        }
        return sock.sendMessage(jid, { album: items }, options);
    };

    const sendPoll = async (jid, question, choices, cfg = {}) => {
        const { selectableCount = 0, toAnnouncementGroup = false, msgOptions = {} } = cfg;
        if (!Array.isArray(choices) || choices.length < 2) {
            throw new Error('sendPoll: minimal 2 pilihan');
        }
        return sock.sendMessage(jid, {
            poll: { name: question, values: choices, selectableCount, toAnnouncementGroup }
        }, msgOptions);
    };

    const sendEvent = async (jid, eventData, options = {}) => {
        const { name, description, startTime, endTime, location, joinLink } = eventData;
        if (!name || !startTime) {
            throw new Error('sendEvent: name dan startTime wajib diisi');
        }
        return sock.sendMessage(jid, {
            event: {
                name,
                description: description || '',
                startTime: Math.floor(startTime / 1000),
                ...(endTime  ? { endTime: Math.floor(endTime / 1000) } : {}),
                ...(location ? { location: { name: location } }        : {}),
                ...(joinLink ? { joinLink }                             : {})
            }
        }, options);
    };

    const sendScheduledCall = async (jid, title, time, callType = 1, options = {}) => {
        return sock.sendMessage(jid, {
            call: { title, time: Math.floor(time / 1000), type: callType }
        }, options);
    };

    const pinMessage = async (jid, messageKey, duration = 86400) => {
        return sock.sendMessage(jid, {
            pin: messageKey,
            type: duration > 0 ? 1 : 2,
            time: duration
        });
    };

    const keepMessage = async (jid, messageKey, keep = true) => {
        return sock.sendMessage(jid, {
            keep: messageKey,
            type: keep ? 1 : 2
        });
    };

    const editMessage = async (jid, messageKey, newText) => {
        return sock.sendMessage(jid, { text: newText, edit: messageKey });
    };

    const deleteMessage = async (jid, messageKey) => {
        return sock.sendMessage(jid, { delete: messageKey });
    };

    const reactMessage = async (jid, messageKey, emoji) => {
        return sock.sendMessage(jid, { react: { text: emoji, key: messageKey } });
    };

    const forwardMessage = async (jid, message, forceForward = false, options = {}) => {
        return sock.sendMessage(jid, { forward: message, force: forceForward }, options);
    };

    const sendLocation = async (jid, latitude, longitude, name, options = {}) => {
        return sock.sendMessage(jid, {
            location: {
                degreesLatitude: latitude,
                degreesLongitude: longitude,
                ...(name ? { name } : {})
            }
        }, options);
    };

    const sendContact = async (jid, contacts, options = {}) => {
        const list = Array.isArray(contacts) ? contacts : [contacts];
        const mapped = list.map(c => {
            if (c.vcard) return { vcard: c.vcard, displayName: c.fullName };
            const vcard = [
                'BEGIN:VCARD',
                'VERSION:3.0',
                `FN:${c.fullName}`,
                ...(c.org ? [`ORG:${c.org}`] : []),
                `TEL;type=CELL;type=VOICE;waid=${c.phoneNumber.replace(/[^0-9]/g, '')}:${c.phoneNumber}`,
                'END:VCARD'
            ].join('\n');
            return { vcard, displayName: c.fullName };
        });
        return sock.sendMessage(jid, { contacts: { contacts: mapped } }, options);
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
        sendContact
    };
};
exports.makeBusinessSocket = makeBusinessSocket;