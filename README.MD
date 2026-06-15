<div align="center">
███╗   ██╗ ██╗  ██╗ ██╗      ██╗   ██╗ ██╗  ██╗
████╗  ██║ ██║  ██║ ██║      ╚██╗ ██╔╝ ╚██╗██╔╝
██╔██╗ ██║ ███████║ ██║       ╚████╔╝   ╚███╔╝
██║╚██╗██║ ╚════██║ ██║        ╚██╔╝    ██╔██╗
██║ ╚████║      ██║ ███████╗    ██║    ██╔╝ ██╗
╚═╝  ╚═══╝      ╚═╝ ╚══════╝    ╚═╝    ╚═╝  ╚═╝
WhatsApp Web API · Multi-device · Production-Ready

https://img.shields.io/npm/v/n4lyx?style=flat-square&color=25D366&labelColor=111&label=npm
https://img.shields.io/npm/dm/n4lyx?style=flat-square&color=25D366&labelColor=111
https://img.shields.io/badge/license-MIT-25D366?style=flat-square&labelColor=111
https://img.shields.io/badge/node-%253E%253D20-25D366?style=flat-square&labelColor=111

</div>
🚀 Kenapa n4lyx?
n4lyx adalah WhatsApp Web API library yang fokus pada stabilitas, performa, dan kemudahan. Dirancang untuk production dengan fitur lengkap tanpa bergantung pada library bloated.

⚡ Highlight: Tag All System · Group Status V2 · AIRichMessage · Convert Media · Sticker Pack Batch · Channel Tracker · Auto Join Channel

✨ Fitur Unggulan
Fitur	Deskripsi
🤖 AIRichMessage	Pesan AI-rich dengan markdown, code blocks, tables, products, reels, posts
📢 Tag All System	Mention semua/admin/non-admin member otomatis
📸 Group Status V2	Kirim story langsung ke group chat
🖼️ Media Converter	Resize, compress, convert sticker auto-detect format
📦 Batch Sender	Sticker pack, document pack, album — kirim paralel
📡 Channel Tracker	Cek semua channel & group yang diikuti
🔄 Auto-Safe	Null-safe, anti crash, retry & sync stabil
🎯 Shorthand	Method siap pakai tanpa ribet object manual
📦 Install
bash
npm i n4lyx
bash
# Optional — direkomendasikan
npm i sharp qrcode-terminal
js
const { default: makeWASocket } = require("n4lyx")
⚡ Quick Start
js
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require("n4lyx")
const { Boom } = require("@hapi/boom")

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("auth")
  const sock = makeWASocket({ auth: state, printQRInTerminal: true })

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      const shouldReconnect = new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) start()
    }
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message) return
    await sock.sendMessage(msg.key.remoteJid, { text: "pong" })
  })
}

start()
🤖 AIRichMessage — Fitur AI Terbaru
Kirim pesan interaktif ala Meta AI dengan markdown, syntax highlighting, table, carousel, dan banyak lagi.

Cara Pakai
js
// Basic
await conn.sendAIRichMessage(m.chat, {
  body: "# Halo dari N4tzzOfficial!\nSelamat datang di bot kami.",
  suggestions: ["Menu", "Owner", "Donasi"],
  footer: "© N4tzzOfficial"
})

// Full Featured
await conn.sendAIRichMessage(m.chat, {
  title: "乂 N4tzzOfficial",
  body: "## Fitur Lengkap\nKami support banyak format!",
  
  // Markdown + Hyperlink + Citation
  texts: [
    "Teks biasa dengan **bold** dan *italic*",
    "[N4tzzOfficial](https://github.com/N4tzz) — hyperlink",
    "[](https://openai.com) — auto citation",
    { text: "Custom options", hyperlink: false } // disable hyperlink
  ],
  
  // Code dengan syntax highlighting
  codeBlocks: [
    { language: "javascript", code: 'console.log("Hello N4tzz!")' },
    { language: "python", code: 'print("Hello World")' }
  ],
  
  // Table
  tables: [
    ["Fitur", "Status", "Versi"],
    ["AIRich", "✅ Aktif", "v1.0"],
    ["Downloader", "✅ Aktif", "v2.1"]
  ],
  
  // Suggestions (scroll horizontal)
  suggestions: ["Menu", "Owner", "Donasi", "Sewa Bot", "Premium"],
  
  // Tips (metadata text)
  tips: ["Gunakan bot dengan bijak ✓", "Jangan spam!"],
  
  // Images
  images: ["https://example.com/foto.jpg"],
  
  // Videos
  videos: ["https://example.com/video.mp4"],
  
  // Products (single = card, array = carousel)
  products: [
    { title: "Bot Premium", brand: "N4tzz", price: "Rp 50K", sale_price: "Rp 35K", image: "url" }
  ],
  
  // Posts (Instagram-style carousel)
  posts: Array(3).fill({
    username: "n4tzz.official",
    profile: "url_foto_profil",
    thumbnail: "url_thumbnail",
    caption: "Post keren! 🔥",
    verified: true,
    likes_count: 1234,
    source: "INSTAGRAM" // INSTAGRAM | FACEBOOK | THREADS
  }),
  
  // Reels (TikTok-style carousel)
  reels: Array(5).fill({
    username: "n4tzz.official",
    profile: "url_avatar",
    thumbnail: "url_cover",
    url: "url_video_reels",
    title: "Reels Keren",
    source: "IG", // IG | TIKTOK
    verified: true
  }),
  
  // Source citations
  sources: [
    ["icon_github.jpg", "https://github.com/N4tzz", "GitHub"],
    ["icon_web.jpg", "https://n4tzz.my.id", "Website"]
  ],
  
  footer: "© N4tzzOfficial Bot"
}, { quoted: m })

// Via sendMessage patch (shortcut)
await conn.sendMessage(m.chat, { airich: { body: "Cepat!", suggestions: ["OK"] } })
Fitur AIRichMessage
Fitur	Input	Output
body	String markdown	Rich text
texts	String/Object array	Markdown + entity
codeBlocks	{language, code}	Syntax highlighted
tables	[[header], [row1]]	Table UX
suggestions	String array	HScroll pills
tips	String array	Metadata text
images	URL array	Imagine primitives
videos	URL array	Animate primitives
products	Object array	Product cards
posts	Object array	Post carousel
reels	Object array	Reel carousel
sources	[[icon, url, text]]	Search results
footer	String	Footer branding
title	String	Disclaimer header
🎨 Markdown yang Didukung
text
# Heading 1
## Heading 2
### Heading 3
**bold** *italic*
=={Highlighted Text}==
[Hyperlink Text](https://url.com)
[Trusted](https://url.com)
[Untrusted](!https://url.com)
[](https://url.com) — Auto Citation
[LaTeX|width|height]<url_gambar>
📡 Channel, Group & Contact Tracker
js
// Semua channel diikuti
const channels = await conn.getFollowedChannels()
// → [{ jid, name, description, subscribers, role, state, invite }]

// Semua group (optional + foto profil)
const groups = await conn.getJoinedGroups(true)

// Semua kontak tersimpan
const contacts = await conn.getAllContacts()
🖼️ Media Converter
js
// Image → Sticker
const { buffer, metadata } = await conn.convertToSticker(imgBuf, {
  packName: "Pack Gue", packPublisher: "N4tzz"
})
await conn.sendMessage(jid, { sticker: buffer, ...metadata })

// Resize & Compress
await conn.convertMedia(buf, { maxSize: 800, format: "jpeg", quality: 75 })
await conn.convertMedia(buf, { width: 1280, height: 720 })
💬 Pesan Cepat (Shorthand)
js
// Text & Reply
await conn.sendMessage(jid, { text: "Halo!" })
await conn.sendReply(jid, "Oke!", m)

// Tag All
await conn.sendMessage(jid, { text: "📢 Info", tagAll: true })
await conn.sendMessage(jid, { text: "🔔 Admin", tagAll: true, tagAllScope: "admins" })

// Media
await conn.sendImage(jid, buffer, "Caption")
await conn.sendVideo(jid, buffer, "Caption")
await conn.sendAudio(jid, buffer, true) // PTT
await conn.sendDocument(jid, buffer, "file.pdf") // auto mime
await conn.sendGIF(jid, gifBuf, "wkwk")
await conn.sendPTV(jid, videoBuf)
await conn.sendViewOnce(jid, { image: buf })
await conn.sendAlbum(jid, [{ image: buf1 }, { video: buf2 }])

// Sticker
await conn.sendStickerFromUrl(jid, "https://...")
await conn.sendStickerPack(jid, [b1, b2, b3], "Pack", "N4tzz")
await conn.sendDocumentPack(jid, [
  { buffer: pdfBuf, fileName: "doc.pdf" }
])

// Poll & Location
await conn.sendPoll(jid, "Pilih?", ["A", "B"])
await conn.sendLocation(jid, -7.79, 110.37, "Jogja")
await conn.sendContact(jid, { fullName: "Budi", phoneNumber: "62812xxx" })
await conn.sendEvent(jid, { name: "Meeting", startTime: Date.now() + 3600000 })
🎯 Interaktif & Buttons
js
// Buttons
await conn.sendButtonsMessage(jid, "Pilih:", [
  { buttonId: "a", buttonText: { displayText: "A" }, type: 1 }
])

// List
await conn.sendListMessage(jid, {
  title: "Menu", text: "Pilih:", buttonText: "Buka",
  sections: [{ title: "Kategori", rows: [{ title: "Item", rowId: "id" }] }]
})

// Interactive dengan media
await conn.sendInteractiveMessage(jid, {
  body: "Pilih", footer: "Bot",
  buttons: [
    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "OK", id: "ok" }) },
    { name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: "Web", url: "https://..." }) }
  ]
})
👥 Group Management
js
await conn.updateGroupName(jid, "Nama Baru")
await conn.updateGroupDescription(jid, "Deskripsi")
await conn.updateGroupProfilePicture(jid, buffer)
await conn.updateGroupSetting(jid, "announcement")
await conn.groupParticipantsUpdate(jid, [jid1, jid2], "add")
await conn.bulkGroupAction(jid, members, "remove")
await conn.getGroupAdmins(jid)
await conn.isGroupAdmin(jid, userJid)
await conn.sendToAdminsOnly(jid, "Khusus admin")
await conn.setGroupJoinApproval(jid, true)
await conn.getGroupJoinRequests(jid)
await conn.approveGroupJoinRequest(jid, [userJid])
📝 Edit, Delete, React
js
await conn.editMessage(jid, sent.key, "Revisi")
await conn.deleteMessage(jid, sent.key)
await conn.reactMessage(jid, m.key, "❤️")
await conn.pinMessage(jid, m.key)
await conn.starMessage(jid, m.key.id)
await conn.forwardMessage(jid, m)
⚙️ Chat Management
js
await conn.archiveChat(jid, lastMsg)
await conn.pinChat(jid)
await conn.muteJid(jid, 86400000)
await conn.markAsRead([m.key])
await conn.blockUser(jid)
await conn.clearChat(jid, messages)
await conn.sendDisappearingMessage(jid, { text: "Rahasia" }, 86400)
📱 Status & Story
js
await conn.sendStatus({ text: "Pagi!", backgroundColor: "#128C7E" })
await conn.sendStatus({ image: buf, caption: "Foto" }, ["628xxx@s.whatsapp.net"])
await conn.groupStatusV2(jid, { text: "GM!", backgroundColor: "#25D366", font: 1 })
📡 Newsletter
js
await conn.getNewsletterInfo(jid)
await conn.sendNewsletterMessage(jid, { text: "Update!" })
await conn.sendNewsletterReaction(jid, msgId, "🔥")
await conn.followNewsletter(jid)
await conn.joinNewsletterByUrl("https://whatsapp.com/channel/...")
📊 Query & Info
js
await conn.isOnWhatsApp("628xxx")
await conn.getProfilePicture(jid, true) // HD
await conn.getUserStatus(jid)
await conn.getContactInfo(jid)
await conn.getBusinessProfile(jid)
await conn.fetchMessageHistory(50, oldestMsg.key, oldestMsg.messageTimestamp)
🔒 Privacy Settings
js
await conn.updateLastSeenPrivacy("contacts")
await conn.updateProfilePicturePrivacy("contacts")
await conn.updateStatusPrivacy("contacts")
await conn.updateReadReceiptsPrivacy("all")
await conn.updateGroupsAddPrivacy("contacts")
await conn.updateOnlinePrivacy("all")
🎨 Custom Config
js
// Cache group metadata
const NodeCache = require("node-cache")
const gc = new NodeCache({ stdTTL: 300 })
const sock = makeWASocket({
  cachedGroupMetadata: async (jid) => gc.get(jid)
})

// Background mode
makeWASocket({ markOnlineOnConnect: false })

// Pairing code
const code = await sock.requestPairingCode("628XXXXXXXXX")

// In-Memory Store
const { makeInMemoryStore } = require("n4lyx")
const store = makeInMemoryStore({})
store.bind(sock.ev)
📋 JID Format
Tipe	Format
User	628XXXXXXXXX@s.whatsapp.net
Group	123456789-123456@g.us
Newsletter	xxxxxxxxxx@newsletter
Broadcast	[timestamp]@broadcast
Status	status@broadcast
📚 API Reference Lengkap
<details> <summary><strong>Klik untuk melihat semua method</strong></summary>
🤖 AIRichMessage
sendAIRichMessage(jid, cfg, opts)

📨 Pesan
sendImage · sendVideo · sendAudio · sendAudioPTT · sendVoiceNote · sendDocument · sendGIF · sendPTV · sendViewOnce · sendAlbum · sendPoll · sendEvent · sendScheduledCall · sendLocation · sendLiveLocation · sendContact · sendGroupInvite · sendLinkPreview · sendDisappearingToggle

🎯 Reply & Mention
sendReply · sendMediaReply · sendQuotedText · sendTextWithMentions · sendTagAll · sendMentionAll · sendWithQuotedFake · forwardWithComment · sendWithMentionAndReply · groupTagAll

🎨 Interaktif
sendButtonsMessage · sendListMessage · sendTemplateMessage · sendInteractiveMessage · sendInteractiveWithMedia · sendHighlyStructuredMessage · sendImageWithButtons · sendVideoWithButtons · sendDocumentWithButtons

📦 Sticker & Document Pack
sendStickerFromBuffer · sendStickerFromUrl · sendStickerWithMetadata · sendStickerPack · sendStickerPackAlbum · sendStickerPackMessage · sendStickerMessage · sendDocumentPack

🖼️ Media Convert
convertToSticker · convertMedia

📝 Edit & Aksi
editMessage · deleteMessage · pinMessage · keepMessage · starMessage · unstarMessage · reactMessage · forwardMessage

💬 Chat
archiveChat · unarchiveChat · pinChat · unpinChat · muteJid · unmuteJid · markAsRead · markAsUnread · deleteChat · clearChat · blockUser · unblockUser · fetchBlocklist · sendSeen

⏳ Disappearing
sendDisappearingMessage · sendDisappearingToggle · setDefaultDisappearing · setGroupDisappearing

👥 Group
getJoinedGroups · groupCreate · groupParticipantsUpdate · bulkGroupAction · updateGroupName · updateGroupDescription · updateGroupProfilePicture · updateGroupSetting · getGroupInviteLink · revokeGroupInvite · joinGroupViaLink · groupMetadata · fetchAllGroups · getGroupAdmins · isGroupAdmin · getGroupParticipants · sendToAdminsOnly · sendAdminInvite · setGroupJoinApproval · getGroupJoinRequests · approveGroupJoinRequest · rejectGroupJoinRequest · setGroupMemberAddMode · leaveGroup

📱 Status
sendStatus · groupStatusV2

📡 Channel/Newsletter
getFollowedChannels · sendNewsletterMessage · sendNewsletterReaction · getNewsletterInfo · followNewsletter · unfollowNewsletter · getNewsletterMetadata · joinNewsletterByUrl

🔍 Query & Info
getAllContacts · isOnWhatsApp · getContactInfo · getUserStatus · getProfilePicture · getBusinessProfile · fetchMessageHistory

🔒 Privacy
updateLastSeenPrivacy · updateProfilePicturePrivacy · updateStatusPrivacy · updateReadReceiptsPrivacy · updateGroupsAddPrivacy · updateOnlinePrivacy · updateDefaultDisappearingMode

📢 Broadcast
broadcastMessage · broadcastToGroups · sendMultipleMessages

⌨️ Typing
sendTyping · sendWithTyping · sendPresenceUpdate · presenceSubscribe

👤 Profile
updateProfilePicture · removeProfilePicture · updateProfileName · updateProfileStatus

🛒 Business
getCatalog · getCollections · getOrderDetails · productCreate · productDelete · productUpdate · sendProductMessage · sendProductMessageWithButtons

📞 Calls
rejectAllCalls

</details>
🔧 Optional Dependencies
bash
npm i sharp              # Media converter (recommended)
npm i jimp               # Fallback converter
npm i qrcode-terminal    # QR di terminal
⚠️ Disclaimer
Bukan afiliasi WhatsApp Inc. Jangan spam atau abuse. Gunakan dengan bijak.

<div align="center"> <sub>Built with ❤️ by N4tzzOfficial — Stability First</sub> </div> ```
