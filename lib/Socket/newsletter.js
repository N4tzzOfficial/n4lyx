"use strict";
// ─────────────────────────────────────────────────────────────────────────────
//  Socket/newsletter.js  —  N4TZZ Fixed Edition
//  Fixes: parseFetchedUpdates robust, all newsletter methods stable
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractNewsletterMetadata = exports.makeNewsletterSocket = void 0;

const Types_1    = require("../Types");
const Utils_1    = require("../Utils");
const WABinary_1 = require("../WABinary");
const groups_1   = require("./groups");

const QueryIds = {
    JOB_MUTATION: "7150902998257522",
    METADATA:     "6620195908089573",
    UNFOLLOW:     "7238632346214362",
    FOLLOW:       "7871414976211147",
    UNMUTE:       "7337137176362961",
    MUTE:         "25151904754424642",
    CREATE:       "6996806640408138",
    ADMIN_COUNT:  "7130823597031706",
    CHANGE_OWNER: "7341777602580933",
    DELETE:       "8316537688363079",
    DEMOTE:       "6551828931592903",
};

const makeNewsletterSocket = (config) => {
    const sock = (0, groups_1.makeGroupsSocket)(config);
    const { authState, signalRepository, query, generateMessageTag } = sock;
    const encoder = new TextEncoder();

    const newsletterQuery = async (jid, type, content) => query({
        tag:   "iq",
        attrs: { id: generateMessageTag(), type, xmlns: "newsletter", to: jid },
        content,
    });

    const newsletterWMexQuery = async (jid, query_id, content = {}) => query({
        tag:   "iq",
        attrs: {
            id:     generateMessageTag(),
            type:   "get",
            xmlns:  "w:mex",
            to:     WABinary_1.S_WHATSAPP_NET,
        },
        content: [{
            tag:   "query",
            attrs: { query_id },
            content: encoder.encode(JSON.stringify({
                variables: {
                    ...(jid ? { newsletter_id: jid } : {}),
                    ...content,
                },
            })),
        }],
    });

    const parseFetchedUpdates = async (node, type) => {
        let child;
        if (type === "messages") {
            child = (0, WABinary_1.getBinaryNodeChild)(node, "messages");
        } else {
            const parent = (0, WABinary_1.getBinaryNodeChild)(node, "message_updates");
            child        = (0, WABinary_1.getBinaryNodeChild)(parent, "messages");
        }
        if (!child) return [];

        return await Promise.all(
            (0, WABinary_1.getAllBinaryNodeChildren)(child).map(async (messageNode) => {
                messageNode.attrs.from = child?.attrs?.jid;
                const viewsNode = (0, WABinary_1.getBinaryNodeChild)(messageNode, "views_count");
                const views     = parseInt(viewsNode?.attrs?.count || "0");
                const reactionNode = (0, WABinary_1.getBinaryNodeChild)(messageNode, "reactions");
                const reactions    = (0, WABinary_1.getBinaryNodeChildren)(reactionNode, "reaction")
                    .map(({ attrs }) => ({ count: +attrs.count, code: attrs.code }));

                const data = { server_id: messageNode.attrs.server_id, views, reactions };

                if (type === "messages") {
                    const { fullMessage: message, decrypt } = await (0, Utils_1.decryptMessageNode)(
                        messageNode,
                        authState.creds.me.id,
                        authState.creds.me.lid || "",
                        signalRepository,
                        config.logger,
                    );
                    await decrypt();
                    data.message = message;
                }
                return data;
            })
        );
    };

    return {
        ...sock,

        subscribeNewsletterUpdates: async (jid) => {
            const result = await newsletterQuery(jid, "set", [
                { tag: "live_updates", attrs: {}, content: [] },
            ]);
            return (0, WABinary_1.getBinaryNodeChild)(result, "live_updates")?.attrs;
        },

        newsletterReactionMode: async (jid, mode) => {
            await newsletterWMexQuery(jid, QueryIds.JOB_MUTATION, {
                updates: { settings: { reaction_codes: { value: mode } } },
            });
        },

        newsletterUpdateDescription: async (jid, description) => {
            await newsletterWMexQuery(jid, QueryIds.JOB_MUTATION, {
                updates: { description: description || "", settings: null },
            });
        },

        newsletterUpdateName: async (jid, name) => {
            await newsletterWMexQuery(jid, QueryIds.JOB_MUTATION, {
                updates: { name, settings: null },
            });
        },

        newsletterUpdatePicture: async (jid, content) => {
            const { img } = await (0, Utils_1.generateProfilePicture)(content);
            await newsletterWMexQuery(jid, QueryIds.JOB_MUTATION, {
                updates: { picture: img.toString("base64"), settings: null },
            });
        },

        newsletterRemovePicture: async (jid) => {
            await newsletterWMexQuery(jid, QueryIds.JOB_MUTATION, {
                updates: { picture: "", settings: null },
            });
        },

        newsletterUnfollow: async (jid) => {
            await newsletterWMexQuery(jid, QueryIds.UNFOLLOW);
        },

        newsletterFollow: async (jid) => {
            await newsletterWMexQuery(jid, QueryIds.FOLLOW);
        },

        newsletterUnmute: async (jid) => {
            await newsletterWMexQuery(jid, QueryIds.UNMUTE);
        },

        newsletterMute: async (jid) => {
            await newsletterWMexQuery(jid, QueryIds.MUTE);
        },

        newsletterCreate: async (name, description, picture) => {
            // Accept TOS first
            await query({
                tag:   "iq",
                attrs: {
                    to:    WABinary_1.S_WHATSAPP_NET,
                    xmlns: "tos",
                    id:    generateMessageTag(),
                    type:  "set",
                },
                content: [{ tag: "notice", attrs: { id: "20601218", stage: "5" }, content: [] }],
            }).catch(() => {});  // non-fatal if already accepted

            const result = await newsletterWMexQuery(undefined, QueryIds.CREATE, {
                input: {
                    name,
                    description: description ?? null,
                    picture: picture
                        ? (await (0, Utils_1.generateProfilePicture)(picture)).img.toString("base64")
                        : null,
                    settings: null,
                },
            });
            return (0, exports.extractNewsletterMetadata)(result, true);
        },

        newsletterMetadata: async (type, key, role) => {
            const result = await newsletterWMexQuery(undefined, QueryIds.METADATA, {
                input: {
                    key,
                    type:      type.toUpperCase(),
                    view_role: role || "GUEST",
                },
                fetch_viewer_metadata: true,
                fetch_full_image:      true,
                fetch_creation_time:   true,
            });
            return (0, exports.extractNewsletterMetadata)(result);
        },

        newsletterAdminCount: async (jid) => {
            const result = await newsletterWMexQuery(jid, QueryIds.ADMIN_COUNT);
            const buff   = (0, WABinary_1.getBinaryNodeChild)(result, "result")?.content?.toString();
            if (!buff) return 0;
            return JSON.parse(buff).data[Types_1.XWAPaths.ADMIN_COUNT].admin_count;
        },

        newsletterChangeOwner: async (jid, user) => {
            await newsletterWMexQuery(jid, QueryIds.CHANGE_OWNER, { user_id: user });
        },

        newsletterDemote: async (jid, user) => {
            await newsletterWMexQuery(jid, QueryIds.DEMOTE, { user_id: user });
        },

        newsletterDelete: async (jid) => {
            await newsletterWMexQuery(jid, QueryIds.DELETE);
        },

        newsletterReactMessage: async (jid, server_id, code) => {
            await query({
                tag:   "message",
                attrs: {
                    to:        jid,
                    ...(!code ? { edit: "7" } : {}),
                    type:      "reaction",
                    server_id,
                    id:        (0, Utils_1.generateMessageID)(),
                },
                content: [{ tag: "reaction", attrs: code ? { code } : {} }],
            });
        },

        newsletterFetchMessages: async (type, key, count, after) => {
            const afterStr = after?.toString();
            const result   = await newsletterQuery(WABinary_1.S_WHATSAPP_NET, "get", [{
                tag:   "messages",
                attrs: {
                    type,
                    ...(type === "invite" ? { key } : { jid: key }),
                    count: count.toString(),
                    after: afterStr || "100",
                },
            }]);
            return parseFetchedUpdates(result, "messages");
        },

        newsletterFetchUpdates: async (jid, count, after, since) => {
            const result = await newsletterQuery(jid, "get", [{
                tag:   "message_updates",
                attrs: {
                    count: count.toString(),
                    after: after?.toString() || "100",
                    since: since?.toString() || "0",
                },
            }]);
            return parseFetchedUpdates(result, "updates");
        },
    };
};

exports.makeNewsletterSocket = makeNewsletterSocket;

// ─── extractNewsletterMetadata ────────────────────────────────────────────────
const extractNewsletterMetadata = (node, isCreate = false) => {
    try {
        const resultNode = (0, WABinary_1.getBinaryNodeChild)(node, "result");
        const buff       = resultNode?.content?.toString();
        if (!buff) return null;
        const parsed        = JSON.parse(buff);
        const metadataPath  = parsed.data[isCreate ? Types_1.XWAPaths.CREATE : Types_1.XWAPaths.NEWSLETTER];
        if (!metadataPath)  return null;
        const tm = metadataPath.thread_metadata;
        return {
            id:              metadataPath.id,
            state:           metadataPath.state?.type,
            creation_time:   +tm.creation_time,
            name:            tm.name?.text,
            nameTime:        +tm.name?.update_time,
            description:     tm.description?.text,
            descriptionTime: +tm.description?.update_time,
            invite:          tm.invite,
            handle:          tm.handle,
            picture:         tm.picture?.direct_path  || null,
            preview:         tm.preview?.direct_path  || null,
            reaction_codes:  tm.settings?.reaction_codes?.value,
            subscribers:     +tm.subscribers_count,
            verification:    tm.verification,
            viewer_metadata: metadataPath.viewer_metadata,
        };
    } catch (e) {
        return null;
    }
};

exports.extractNewsletterMetadata = extractNewsletterMetadata;