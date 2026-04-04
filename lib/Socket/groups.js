"use strict";
// ─────────────────────────────────────────────────────────────────────────────
//  Socket/groups.js  —  N4TZZ Fixed + Extended Edition
//  NEW: getJoinedGroups, getFollowedChannels, getAllContacts
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractGroupMetadata = exports.makeGroupsSocket = void 0;

const WAProto_1  = require("../../WAProto");
const Types_1    = require("../Types");
const Utils_1    = require("../Utils");
const WABinary_1 = require("../WABinary");
const chats_1    = require("./chats");

const makeGroupsSocket = (config) => {
    const sock = (0, chats_1.makeChatsSocket)(config);
    const { authState, ev, query, upsertMessage } = sock;

    const groupQuery = async (jid, type, content) => query({
        tag: "iq", attrs: { type, xmlns: "w:g2", to: jid }, content,
    });

    const groupMetadata = async (jid) => {
        const result = await groupQuery(jid, "get", [{ tag: "query", attrs: { request: "interactive" } }]);
        return (0, exports.extractGroupMetadata)(result);
    };

    const groupFetchAllParticipating = async () => {
        const result = await query({
            tag: "iq", attrs: { to: "@g.us", xmlns: "w:g2", type: "get" },
            content: [{ tag: "participating", attrs: {}, content: [{ tag: "participants", attrs: {} }, { tag: "description", attrs: {} }] }],
        });
        const data = {};
        const groupsChild = (0, WABinary_1.getBinaryNodeChild)(result, "groups");
        if (groupsChild) {
            for (const groupNode of (0, WABinary_1.getBinaryNodeChildren)(groupsChild, "group")) {
                const meta = (0, exports.extractGroupMetadata)({ tag: "result", attrs: {}, content: [groupNode] });
                if (meta?.id) data[meta.id] = meta;
            }
        }
        sock.ev.emit("groups.update", Object.values(data));
        return data;
    };

    // ─── NEW: Get all joined groups as clean array ────────────────────────────
    const getJoinedGroups = async () => {
        const all = await groupFetchAllParticipating();
        return Object.values(all).map(g => ({
            id:                g.id,
            name:              g.subject             || "Unnamed Group",
            description:       g.desc                || "",
            owner:             g.owner               || null,
            memberCount:       g.size                || (g.participants?.length ?? 0),
            participants:      g.participants         || [],
            creation:          g.creation            || null,
            announce:          g.announce            || false,
            restrict:          g.restrict            || false,
            isCommunity:       g.isCommunity          || false,
            joinApprovalMode:  g.joinApprovalMode     || false,
            ephemeralDuration: g.ephemeralDuration    || null,
            inviteCode:        null, // fetch separately if needed
        }));
    };

    // ─── NEW: Get all followed newsletter channels ────────────────────────────
    const getFollowedChannels = async () => {
        try {
            const encoder = new TextEncoder();
            const result = await query({
                tag: "iq",
                attrs: { id: sock.generateMessageTag?.() || Math.random().toString(36).slice(2), type: "get", xmlns: "w:mex", to: WABinary_1.S_WHATSAPP_NET },
                content: [{
                    tag: "query",
                    attrs: { query_id: "9010885495661893" },
                    content: encoder.encode(JSON.stringify({ variables: { fetch_viewer_metadata: true, fetch_full_image: true } })),
                }],
            }).catch(() => null);
            if (!result) return [];
            const resultNode = (0, WABinary_1.getBinaryNodeChild)(result, "result");
            const buff = resultNode?.content?.toString();
            if (!buff) return [];
            let parsed;
            try { parsed = JSON.parse(buff); } catch { return []; }
            const edges = parsed?.data?.xwa2_newsletter_subscriptions?.edges
                       || parsed?.data?.newsletter_subscriptions?.edges
                       || [];
            return edges.map(edge => {
                const node = edge?.node || edge;
                const tm   = node?.thread_metadata || {};
                return {
                    id:           node?.id                        || null,
                    name:         tm?.name?.text                  || "Unknown Channel",
                    description:  tm?.description?.text           || "",
                    handle:       tm?.handle                      || null,
                    subscribers:  +(tm?.subscribers_count)        || 0,
                    picture:      tm?.picture?.direct_path        || null,
                    preview:      tm?.preview?.direct_path        || null,
                    verification: tm?.verification                || null,
                    invite:       tm?.invite                      || null,
                    role:         node?.viewer_metadata?.role     || "SUBSCRIBER",
                    isMuted:      (node?.viewer_metadata?.mute_expire_time || 0) > 0,
                    url:          tm?.invite ? `https://whatsapp.com/channel/${tm.invite}` : null,
                };
            }).filter(c => c.id);
        } catch (e) {
            sock.logger?.warn?.("[getFollowedChannels]", e?.message);
            return [];
        }
    };

    // ─── NEW: Get all contacts from internal store ────────────────────────────
    const getAllContacts = async () => {
        try {
            const raw     = sock.store?.contacts || {};
            const entries = Object.entries(raw);
            if (!entries.length) return [];
            return entries
                .filter(([jid]) => jid.endsWith("@s.whatsapp.net"))
                .map(([jid, c]) => ({
                    jid,
                    name:         c.name         || c.notify || null,
                    notify:       c.notify        || null,
                    verifiedName: c.verifiedName  || null,
                    imgUrl:       c.imgUrl        || null,
                    status:       c.status        || null,
                }));
        } catch (e) {
            sock.logger?.warn?.("[getAllContacts]", e?.message);
            return [];
        }
    };

    sock.ws.on("CB:ib,,dirty", async (node) => {
        const { attrs } = (0, WABinary_1.getBinaryNodeChild)(node, "dirty");
        if (attrs.type !== "groups") return;
        await groupFetchAllParticipating();
        await sock.cleanDirtyBits("groups");
    });

    return {
        ...sock,
        groupQuery, groupMetadata,
        getJoinedGroups, getFollowedChannels, getAllContacts,

        groupCreate: async (subject, participants) => {
            const result = await groupQuery("@g.us", "set", [{ tag: "create", attrs: { subject, key: (0, Utils_1.generateMessageIDV2)() }, content: participants.map(jid => ({ tag: "participant", attrs: { jid } })) }]);
            return (0, exports.extractGroupMetadata)(result);
        },
        groupLeave: async (id) => { await groupQuery("@g.us", "set", [{ tag: "leave", attrs: {}, content: [{ tag: "group", attrs: { id } }] }]); },
        groupUpdateSubject: async (jid, subject) => { await groupQuery(jid, "set", [{ tag: "subject", attrs: {}, content: Buffer.from(subject, "utf-8") }]); },
        groupRequestParticipantsList: async (jid) => {
            const result = await groupQuery(jid, "get", [{ tag: "membership_approval_requests", attrs: {} }]);
            return (0, WABinary_1.getBinaryNodeChildren)((0, WABinary_1.getBinaryNodeChild)(result, "membership_approval_requests"), "membership_approval_request").map(v => v.attrs);
        },
        groupRequestParticipantsUpdate: async (jid, participants, action) => {
            const result = await groupQuery(jid, "set", [{ tag: "membership_requests_action", attrs: {}, content: [{ tag: action, attrs: {}, content: participants.map(jid => ({ tag: "participant", attrs: { jid } })) }] }]);
            return (0, WABinary_1.getBinaryNodeChildren)((0, WABinary_1.getBinaryNodeChild)((0, WABinary_1.getBinaryNodeChild)(result, "membership_requests_action"), action), "participant").map(p => ({ status: p.attrs.error || "200", jid: p.attrs.jid }));
        },
        groupParticipantsUpdate: async (jid, participants, action) => {
            const result = await groupQuery(jid, "set", [{ tag: action, attrs: {}, content: participants.map(jid => ({ tag: "participant", attrs: { jid } })) }]);
            return (0, WABinary_1.getBinaryNodeChildren)((0, WABinary_1.getBinaryNodeChild)(result, action), "participant").map(p => ({ status: p.attrs.error || "200", jid: p.attrs.jid, content: p }));
        },
        groupUpdateDescription: async (jid, description) => {
            const metadata = await groupMetadata(jid);
            await groupQuery(jid, "set", [{ tag: "description", attrs: { ...(description ? { id: (0, Utils_1.generateMessageIDV2)() } : { delete: "true" }), ...(metadata.descId ? { prev: metadata.descId } : {}) }, content: description ? [{ tag: "body", attrs: {}, content: Buffer.from(description, "utf-8") }] : undefined }]);
        },
        groupInviteCode:    async (jid)  => (0, WABinary_1.getBinaryNodeChild)(await groupQuery(jid, "get", [{ tag: "invite", attrs: {} }]), "invite")?.attrs?.code,
        groupRevokeInvite:  async (jid)  => (0, WABinary_1.getBinaryNodeChild)(await groupQuery(jid, "set", [{ tag: "invite", attrs: {} }]), "invite")?.attrs?.code,
        groupAcceptInvite:  async (code) => (0, WABinary_1.getBinaryNodeChild)(await groupQuery("@g.us", "set", [{ tag: "invite", attrs: { code } }]), "group")?.attrs?.jid,
        groupRevokeInviteV4: async (groupJid, invitedJid) => !!(await groupQuery(groupJid, "set", [{ tag: "revoke", attrs: {}, content: [{ tag: "participant", attrs: { jid: invitedJid } }] }])),
        groupAcceptInviteV4: ev.createBufferedFunction(async (key, inviteMessage) => {
            key = typeof key === "string" ? { remoteJid: key } : key;
            const results = await groupQuery(inviteMessage.groupJid, "set", [{ tag: "accept", attrs: { code: inviteMessage.inviteCode, expiration: inviteMessage.inviteExpiration.toString(), admin: key.remoteJid } }]);
            if (key.id) { inviteMessage = WAProto_1.proto.Message.GroupInviteMessage.fromObject(inviteMessage); inviteMessage.inviteExpiration = 0; inviteMessage.inviteCode = ""; ev.emit("messages.update", [{ key, update: { message: { groupInviteMessage: inviteMessage } } }]); }
            await upsertMessage({ key: { remoteJid: inviteMessage.groupJid, id: (0, Utils_1.generateMessageIDV2)(sock.user?.id), fromMe: false, participant: key.remoteJid }, messageStubType: Types_1.WAMessageStubType.GROUP_PARTICIPANT_ADD, messageStubParameters: [authState.creds.me.id], participant: key.remoteJid, messageTimestamp: (0, Utils_1.unixTimestampSeconds)() }, "notify");
            return results.attrs.from;
        }),
        groupGetInviteInfo:    async (code) => (0, exports.extractGroupMetadata)(await groupQuery("@g.us", "get", [{ tag: "invite", attrs: { code } }])),
        groupToggleEphemeral:  async (jid, exp) => { await groupQuery(jid, "set", [exp ? { tag: "ephemeral", attrs: { expiration: exp.toString() } } : { tag: "not_ephemeral", attrs: {} }]); },
        groupSettingUpdate:    async (jid, setting) => { await groupQuery(jid, "set", [{ tag: setting, attrs: {} }]); },
        groupMemberAddMode:    async (jid, mode) => { await groupQuery(jid, "set", [{ tag: "member_add_mode", attrs: {}, content: mode }]); },
        groupJoinApprovalMode: async (jid, mode) => { await groupQuery(jid, "set", [{ tag: "membership_approval_mode", attrs: {}, content: [{ tag: "group_join", attrs: { state: mode } }] }]); },
        groupFetchAllParticipating,
    };
};
exports.makeGroupsSocket = makeGroupsSocket;

const extractGroupMetadata = (result) => {
    const group = (0, WABinary_1.getBinaryNodeChild)(result, "group");
    if (!group) return {};
    const descChild = (0, WABinary_1.getBinaryNodeChild)(group, "description");
    let desc, descId, descOwner, descOwnerLid, descTime;
    if (descChild) {
        desc = (0, WABinary_1.getBinaryNodeChildString)(descChild, "body");
        descOwner = (0, WABinary_1.jidNormalizedUser)(descChild.attrs.participant_pn || descChild.attrs.participant);
        if (group.attrs.addressing_mode === "lid") descOwnerLid = (0, WABinary_1.jidNormalizedUser)(descChild.attrs.participant);
        descId = descChild.attrs.id;
        descTime = descChild.attrs.t ? +descChild.attrs.t : undefined;
    }
    const groupId = group.attrs.id?.includes("@") ? group.attrs.id : (0, WABinary_1.jidEncode)(group.attrs.id, "g.us");
    const eph = (0, WABinary_1.getBinaryNodeChild)(group, "ephemeral")?.attrs?.expiration;
    return {
        id: groupId, addressingMode: group.attrs.addressing_mode,
        subject: group.attrs.subject,
        subjectOwner: (0, WABinary_1.jidNormalizedUser)(group.attrs.s_o_pn || group.attrs.s_o),
        ...(group.attrs.addressing_mode === "lid" ? { subjectOwnerLid: (0, WABinary_1.jidNormalizedUser)(group.attrs.s_o) } : {}),
        subjectTime: group.attrs.s_t ? +group.attrs.s_t : undefined,
        size: group.attrs.size ? Number(group.attrs.size) : (0, WABinary_1.getBinaryNodeChildren)(group, "participant").length,
        creation: group.attrs.creation ? +group.attrs.creation : undefined,
        owner: (0, WABinary_1.jidNormalizedUser)(group.attrs.creator_pn || group.attrs.creator),
        ...(group.attrs.addressing_mode === "lid" ? { ownerLid: (0, WABinary_1.jidNormalizedUser)(group.attrs.creator) } : {}),
        desc, descId, descOwner, descOwnerLid, descTime,
        linkedParent: (0, WABinary_1.getBinaryNodeChild)(group, "linked_parent")?.attrs?.jid || undefined,
        restrict: !!(0, WABinary_1.getBinaryNodeChild)(group, "locked"),
        announce: !!(0, WABinary_1.getBinaryNodeChild)(group, "announcement"),
        isCommunity: !!(0, WABinary_1.getBinaryNodeChild)(group, "parent"),
        isCommunityAnnounce: !!(0, WABinary_1.getBinaryNodeChild)(group, "default_sub_group"),
        joinApprovalMode: !!(0, WABinary_1.getBinaryNodeChild)(group, "membership_approval_mode"),
        memberAddMode: (0, WABinary_1.getBinaryNodeChildString)(group, "member_add_mode") === "all_member_add",
        participants: (0, WABinary_1.getBinaryNodeChildren)(group, "participant").map(({ attrs }) => ({ id: attrs.jid, jid: attrs.phone_number || attrs.jid, lid: attrs.lid || attrs.jid, admin: attrs.type || null })),
        ephemeralDuration: eph ? +eph : undefined,
    };
};
exports.extractGroupMetadata = extractGroupMetadata;