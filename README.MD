███╗   ██╗ ██╗  ██╗ ██╗      ██╗   ██╗ ██╗  ██╗
████╗  ██║ ██║  ██║ ██║      ╚██╗ ██╔╝ ╚██╗██╔╝
██╔██╗ ██║ ███████║ ██║       ╚████╔╝   ╚███╔╝
██║╚██╗██║ ╚════██║ ██║        ╚██╔╝    ██╔██╗
██║ ╚████║      ██║ ███████╗    ██║    ██╔╝ ██╗
╚═╝  ╚═══╝      ╚═╝ ╚══════╝    ╚═╝    ╚═╝  ╚═╝

WhatsApp Web API · Multi-device · Production-Ready

npm: https://npmjs.com/package/n4lyx
License: MIT
Node: >=20

---

KENAPA N4LYX?

n4lyx adalah WhatsApp Web API library untuk Node.js yang fokus pada stabilitas, performa, dan kemudahan penggunaan. Dirancang untuk production dengan fitur lengkap tanpa bergantung pada library bloated.

Highlight: Tag All System · Group Status V2 · AIRichMessage · Convert Media · Sticker Pack Batch · Channel Tracker · Auto Join Channel

---

FITUR UNGGULAN

- AIRichMessage: Pesan AI-rich dengan markdown, code blocks, tables, products, reels, posts
- Tag All System: Mention semua/admin/non-admin member otomatis
- Group Status V2: Kirim story langsung ke group chat
- Media Converter: Resize, compress, convert sticker auto-detect format
- Batch Sender: Sticker pack, document pack, album — kirim paralel
- Channel Tracker: Cek semua channel & group yang diikuti
- Auto-Safe: Null-safe, anti crash, retry & sync stabil
- Shorthand: Method siap pakai tanpa ribet object manual

---

INSTALL

npm i n4lyx

Optional:
npm i sharp qrcode-terminal

---

QUICK START

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

---

LOGIN METHODS

QR Code (Terminal):
const sock = makeWASocket({ printQRInTerminal: true })

Pairing Code (Nomor HP):
const sock = makeWASocket({ printQRInTerminal: false })
if (!sock.authState.creds.registered) {
  const code = await sock.requestPairingCode("628XXXXXXXXX")
  console.log("Kode pairing:", code)
}

Simpan Session (Auth State):
const { state, saveCreds } = await useMultiFileAuthState("auth")
const sock = makeWASocket({ auth: state })
sock.ev.on("creds.update", saveCreds)

Background Mode (No Online):
const sock = makeWASocket({ markOnlineOnConnect: false })

Cache Group Metadata:
const NodeCache = require("node-cache")
const groupCache = new NodeCache({ stdTTL: 300, useClones: false })
const sock = makeWASocket({ cachedGroupMetadata: async (jid) => groupCache.get(jid) })
sock.ev.on("groups.update", async ([e]) => { groupCache.set(e.id, await sock.groupMetadata(e.id)) })
sock.ev.on("group-participants.update", async (e) => { groupCache.set(e.id, await sock.groupMetadata(e.id)) })

---

AIRICHMESSAGE - PESAN AI INTERAKTIF

Kirim pesan interaktif ala Meta AI dengan dukungan markdown, syntax highlighting, table, carousel product/post/reel.

Basic Usage:
await conn.sendAIRichMessage(m.chat, {
  body: "# Halo dari N4tzzOfficial!\nSelamat datang di bot kami.",
  suggestions: ["Menu", "Owner", "Donasi"],
  footer: "© N4tzzOfficial"
})

Full Featured:
await conn.sendAIRichMessage(m.chat, {
  title: "乂 N4tzzOfficial",
  body: "## Fitur Lengkap\nKami support banyak format teks!",
  texts: [
    "Teks biasa dengan **bold** dan *italic*",
    "[N4tzzOfficial](https://github.com/N4tzz) — hyperlink",
    "[](https://openai.com) — auto citation",
    { text: "Custom options", hyperlink: false }
  ],
  codeBlocks: [
    { language: "javascript", code: 'console.log("Hello N4tzz!")' },
    { language: "python", code: 'print("Hello World")' }
  ],
  tables: [
    ["Fitur", "Status", "Versi"],
    ["AIRich", "✅ Aktif", "v1.0"],
    ["Downloader", "✅ Aktif", "v2.1"]
  ],
  suggestions: ["Menu", "Owner", "Donasi", "Sewa Bot", "Premium"],
  tips: ["Gunakan bot dengan bijak ✓", "Jangan spam!"],
  images: ["https://example.com/foto.jpg"],
  videos: ["https://example.com/video.mp4"],
  products: [{
    title: "Bot Premium", brand: "N4tzzOfficial",
    price: "Rp 50.000", sale_price: "Rp 35.000",
    image: "https://example.com/product.jpg",
    url: "https://wa.me/628xxx"
  }],
  posts: Array(3).fill({
    username: "n4tzz.official",
    profile: "https://example.com/avatar.jpg",
    thumbnail: "https://example.com/post.jpg",
    caption: "Post keren dari N4tzzOfficial! 🔥",
    verified: true, likes_count: 1234,
    comments_count: 56, shares_count: 78,
    source: "INSTAGRAM",
    footer: "N4tzzOfficial",
    icon: "https://example.com/icon.jpg",
    deeplink: "https://instagram.com/p/xxx"
  }),
  reels: Array(5).fill({
    username: "n4tzz.official",
    profile: "https://example.com/avatar.jpg",
    thumbnail: "https://example.com/cover.jpg",
    url: "https://example.com/reel.mp4",
    title: "Reels Keren dari N4tzz",
    source: "IG", verified: true,
    likes_count: 5000, view_count: 100000
  }),
  sources: [
    ["https://example.com/icon-github.jpg", "https://github.com/N4tzz", "GitHub"],
    ["https://example.com/icon-web.jpg", "https://n4tzz.my.id", "Website"]
  ],
  footer: "© N4tzzOfficial Bot"
}, { quoted: m })

Via sendMessage Patch (Shortcut):
await conn.sendMessage(m.chat, {
  airich: {
    body: "Pesan AIRich cepat!",
    suggestions: ["OK", "Cancel"]
  }
})

Markdown yang Didukung AIRichMessage:
# Heading 1
## Heading 2
### Heading 3
**bold** *italic*
=={Highlighted Text}==
[Hyperlink Text](https://url.com)
[Trusted Link](https://url.com)
[Untrusted Link](!https://url.com)
[](https://url.com) — Auto Citation
[LaTeX Identifier|width|height]<url_gambar>

Parameter AIRichMessage:
title: String (default "乂 N4tzzOfficial") - Judul/disclaimer header
body: String (default "") - Body text utama (markdown)
texts: Array (default []) - Array teks tambahan (string atau {text, hyperlink?, citation?, latex?})
codeBlocks: Array (default []) - Array {language, code}
tables: Array (default []) - Array 2D [[header], [row1], ...]
suggestions: Array (default []) - Array string saran (scroll horizontal)
tips: Array (default []) - Array string tips (metadata text)
images: Array (default []) - Array URL gambar
videos: Array (default []) - Array URL video
products: Array (default []) - Array object produk {title, brand, price, sale_price, image, url, icon}
posts: Array (default []) - Array object post {username, profile, thumbnail, caption, verified, likes_count, source, ...}
reels: Array (default []) - Array object reel {username, profile, thumbnail, url, title, source, verified, ...}
sources: Array (default []) - Array [icon_url, source_url, text]
footer: String (default "© N4tzzOfficial") - Footer text
forwarded: Boolean (default true) - Tampilkan sebagai forwarded
notification: Boolean (default false) - Tampilkan notifikasi transparansi
includesUnifiedResponse: Boolean (default true) - Include unified response data
includesSubmessages: Boolean (default true) - Include submessages
quoted: Object (default undefined) - Pesan yang di-quote
quotedParticipant: String (default undefined) - Participant quoted (untuk group)

---

CHANNEL, GROUP & CONTACT TRACKER

Semua channel yang diikuti:
const channels = await conn.getFollowedChannels()
// [{ jid, name, description, subscribers, role, state, invite }, ...]

Semua group yang diikuti:
const groups = await conn.getJoinedGroups()        // cepat, tanpa foto
const groupsFull = await conn.getJoinedGroups(true) // lengkap dengan foto profil

Semua kontak tersimpan:
const contacts = await conn.getAllContacts()
// [{ jid, lid, exists, name }, ...]

---

MEDIA CONVERTER (CONVERT, RESIZE, COMPRESS)

Butuh sharp (recommended) atau jimp: npm i sharp

Image ke Sticker WebP:
const { buffer, metadata } = await conn.convertToSticker(imageBuffer, {
  packName: "Pack Gue", packPublisher: "N4tzz",
  quality: 80, maxSize: 512
})
await conn.sendMessage(jid, { sticker: buffer, ...metadata })

Resize & Compress Image:
const compressed = await conn.convertMedia(imageBuffer, {
  maxSize: 800, format: "jpeg", quality: 75
})
await conn.sendImage(jid, compressed, "Foto sudah dikompres")

const resized = await conn.convertMedia(imageBuffer, {
  width: 1280, height: 720, format: "webp", quality: 85
})

const png = await conn.convertMedia(imageBuffer, { format: "png", quality: 90 })

---

KIRIM PESAN (SHORTHAND METHODS)

Teks & Reply:
await conn.sendMessage(jid, { text: "Halo!" })
await conn.sendReply(jid, "Oke siap!", m)
await conn.sendMessage(jid, { text: "Oke" }, { quoted: m })

Mention user:
await conn.sendMessage(jid, { text: "Hei @628XXXXXXXXX cek ini", mentions: ["628XXXXXXXXX@s.whatsapp.net"] })
await conn.sendTextWithMentions(jid, "Halo @A dan @B", [jidA, jidB])

Fake Quote:
await conn.sendWithQuotedFake(jid, "Ini balasan", {
  sender: "628xxx@s.whatsapp.net", text: "Pesan asli", id: "FAKE123"
})

Tag All System:
await conn.sendMessage(jid, { text: "📢 Pengumuman penting!", tagAll: true })
await conn.sendMessage(jid, { text: "🔔 Info admin", tagAll: true, tagAllScope: "admins" })
await conn.sendMessage(jid, { text: "👋 Hei member!", tagAll: true, tagAllScope: "non_admins" })
await conn.sendTagAll(jid, "📢 Pengumuman untuk semua")
await conn.sendTagAll(jid, "🔔 Khusus admin", "admins")
await conn.sendMentionAll(jid, "Hei semua!")
const jids = await conn.groupTagAll(groupJid, "all")

Gambar & Video:
await conn.sendImage(jid, buffer, "Caption opsional")
await conn.sendImage(jid, { url: "./foto.jpg" })
await conn.sendVideo(jid, buffer, "Caption opsional")

Audio:
await conn.sendAudio(jid, buffer)
await conn.sendAudio(jid, buffer, true)     // voice note / PTT
await conn.sendAudioPTT(jid, buffer)
await conn.sendVoiceNote(jid, buffer)

Dokumen (Auto Mime Detection):
await conn.sendDocument(jid, buffer, "laporan.pdf", null, "Ini file-nya")
await conn.sendDocument(jid, buffer, "data.xlsx")
await conn.sendDocument(jid, buffer, "app.apk", null, "Update terbaru")
await conn.sendDocument(jid, buffer, "file.bin", "application/octet-stream")

GIF & Video Note:
await conn.sendGIF(jid, gifBuffer, "wkwk")
await conn.sendPTV(jid, videoBuffer)

View Once:
await conn.sendViewOnce(jid, { image: buffer })
await conn.sendViewOnce(jid, { video: buffer }, { quoted: m })
await conn.sendViewOnce(jid, { audio: buffer, mimetype: "audio/mp4" })

Sticker:
await conn.sendStickerFromBuffer(jid, buffer)
await conn.sendStickerFromUrl(jid, "https://example.com/sticker.webp")
await conn.sendStickerWithMetadata(jid, buffer, { packName: "Pack Gue", packPublisher: "N4tzz", categories: ["😂"] })
await conn.sendStickerPack(jid, [buf1, buf2, buf3, buf4, buf5], "Pack Gue", "N4tzz", { batchSize: 5, delayBatch: 500 })
await conn.sendStickerPackAlbum(jid, [buf1, buf2, buf3], "Pack Gue", "N4tzz", { batchSize: 10, delayBatch: 800 })

Album (Swipeable):
await conn.sendAlbum(jid, [
  { image: buf1, caption: "Foto 1" },
  { image: buf2, caption: "Foto 2" },
  { video: buf3, caption: "Video" }
])

Document Pack (Batch):
await conn.sendDocumentPack(jid, [
  { buffer: pdfBuffer, fileName: "laporan.pdf", caption: "Ini laporannya" },
  { buffer: excelBuf, fileName: "data.xlsx", caption: "Data excel" },
  { url: "https://...", fileName: "manual.pdf" }
], { delayMs: 600 })
await conn.sendDocumentPack(jid, documents, { parallel: true })

Poll:
await conn.sendPoll(jid, "Bahasa favorit?", ["JavaScript", "Python", "Go"])
await conn.sendPoll(jid, "Setuju?", ["Ya", "Tidak"], { selectableCount: 1 })

Lokasi:
await conn.sendLocation(jid, -7.797068, 110.370529, "Yogyakarta")
await conn.sendLiveLocation(jid, -7.79, 110.37, 10, 300)
await conn.sendLocationReply(jid, -7.79, 110.37, "Jogja", m)

Kontak:
await conn.sendContact(jid, { fullName: "Budi Santoso", phoneNumber: "+62812xxxxxxx", org: "Acme Inc" })
await conn.sendContact(jid, [
  { fullName: "Budi", phoneNumber: "+62812xxxxxxx" },
  { fullName: "Sari", phoneNumber: "+62813xxxxxxx" }
])

Event & Jadwal Call:
await conn.sendEvent(jid, {
  name: "Rapat Mingguan", description: "Sync progress tim",
  startTime: Date.now() + 3600000, endTime: Date.now() + 7200000,
  location: "Google Meet", joinLink: "https://meet.google.com/xxx"
})
await conn.sendScheduledCall(jid, "Catch-up call", Date.now() + 86400000)
await conn.sendScheduledCall(jid, "Voice call", Date.now() + 3600000, 2)

Group Invite:
await conn.sendGroupInvite(jid, "120363xxx@g.us")
await conn.sendAdminInvite(jid, "120363xxx@g.us")

---

INTERAKTIF & BUTTONS

Buttons Message:
await conn.sendButtonsMessage(jid, "Pilih salah satu:", [
  { buttonId: "id1", buttonText: { displayText: "Opsi A" }, type: 1 },
  { buttonId: "id2", buttonText: { displayText: "Opsi B" }, type: 1 }
], "Footer opsional")

Buttons dengan Media:
await conn.sendImageWithButtons(jid, imageBuffer, "Caption", [
  { buttonId: "confirm", buttonText: { displayText: "✅ Konfirmasi" }, type: 1 },
  { buttonId: "cancel", buttonText: { displayText: "❌ Batal" }, type: 1 }
])
await conn.sendVideoWithButtons(jid, videoBuffer, "Tonton dulu", [
  { buttonId: "share", buttonText: { displayText: "📤 Share" }, type: 1 }
])
await conn.sendDocumentWithButtons(jid, pdfBuffer, "laporan.pdf", "Laporan ini", [
  { buttonId: "download", buttonText: { displayText: "⬇️ Download" }, type: 1 }
])

List Message:
await conn.sendListMessage(jid, {
  title: "Main Menu", text: "Pilih menu yang tersedia:",
  footer: "n4lyx bot", buttonText: "Buka Menu",
  sections: [{
    title: "Kategori 1",
    rows: [
      { title: "Info Bot", rowId: "info", description: "Lihat informasi bot" },
      { title: "Help", rowId: "help", description: "Bantuan penggunaan" }
    ]
  }, {
    title: "Kategori 2",
    rows: [
      { title: "Owner", rowId: "owner" },
      { title: "Donasi", rowId: "donasi" }
    ]
  }]
})

Template Message:
await conn.sendTemplateMessage(jid, {
  text: "Hai! Ada yang bisa dibantu?", footer: "n4lyx Official",
  templateButtons: [
    { index: 1, urlButton: { displayText: "🌐 Website", url: "https://example.com" } },
    { index: 2, callButton: { displayText: "📞 Telepon", phoneNumber: "+62812xxxxxxx" } },
    { index: 3, quickReplyButton: { displayText: "💬 Chat", id: "chat" } }
  ]
})

Interactive Message (Native Flow):
await conn.sendInteractiveMessage(jid, {
  body: "Pilih aksi:", footer: "N4tzzOfficial Bot",
  buttons: [
    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "OK", id: "ok" }) },
    { name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: "Website", url: "https://n4tzz.my.id" }) },
    { name: "cta_copy", buttonParamsJson: JSON.stringify({ display_text: "Copy", copy_code: "N4TZZ2024" }) },
    { name: "cta_call", buttonParamsJson: JSON.stringify({ display_text: "Call", phone_number: "628xxx" }) }
  ]
})

Single Select:
await conn.sendInteractiveMessage(jid, {
  body: "Pilih kategori:",
  buttons: [{
    name: "single_select",
    buttonParamsJson: JSON.stringify({
      title: "Kategori",
      sections: [{
        title: "Menu Utama",
        rows: [
          { header: "", title: "Downloader", description: "Download sosmed", id: "dl" },
          { header: "", title: "AI Chat", description: "Chat dengan AI", id: "ai" }
        ]
      }]
    })
  }]
})

Interactive dengan Media:
await conn.sendInteractiveWithMedia(jid, {
  body: "Pilih menu:", footer: "Bot",
  image: imageBuffer,
  buttons: [
    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Menu 1", id: "m1" }) }
  ]
})

Highly Structured Message:
await conn.sendHighlyStructuredMessage(jid, {
  namespace: "example_ns", elementName: "greeting",
  params: ["Halo", "Dunia"],
  deterministicLottie: false, fallbackLg: "id", fallbackLc: "ID"
})

---

EDIT, DELETE, REACT & AKSI PESAN

const sent = await conn.sendMessage(jid, { text: "Ada typo nih" })
await conn.editMessage(jid, sent.key, "Sudah diperbaiki typo-nya")
await conn.deleteMessage(jid, sent.key)
await conn.pinMessage(jid, m.key)
await conn.pinMessage(jid, m.key, 604800)
await conn.pinMessage(jid, m.key, 0)
await conn.keepMessage(jid, m.key)
await conn.keepMessage(jid, m.key, false)
await conn.starMessage(jid, m.key.id)
await conn.unstarMessage(jid, m.key.id)
await conn.reactMessage(jid, m.key, "❤️")
await conn.reactMessage(jid, m.key, "")
await conn.forwardMessage(jid, m)
await conn.forwardWithComment(jid, m, "Check ini!")

---

CHAT MANAGEMENT

await conn.archiveChat(jid, lastMsg)
await conn.unarchiveChat(jid, lastMsg)
await conn.pinChat(jid)
await conn.unpinChat(jid)
await conn.muteJid(jid)
await conn.muteJid(jid, 24 * 60 * 60 * 1000)
await conn.unmuteJid(jid)
await conn.markAsRead([m.key])
await conn.sendSeen(jid)
await conn.markAsUnread(jid, lastMsg)
await conn.blockUser(jid)
await conn.unblockUser(jid)
await conn.fetchBlocklist()
await conn.deleteChat(jid, lastMsg)
await conn.clearChat(jid, messages)
await conn.sendLinkPreview(jid, "Cek https://github.com/N4tzz")

---

DISAPPEARING MESSAGES

await conn.sendDisappearingMessage(jid, { text: "Pesan rahasia" }, 86400)
await conn.sendDisappearingMessage(jid, { image: buf }, 604800)
await conn.sendDisappearingMessage(jid, { text: "Expire" }, 7776000)
await conn.sendDisappearingToggle(jid, true)
await conn.sendDisappearingToggle(jid, false)
await conn.setGroupDisappearing(jid, 604800)
await conn.setGroupDisappearing(jid, 0)
await conn.setDefaultDisappearing(86400)

---

GROUP MANAGEMENT

const group = await conn.groupCreate("Nama Group", ["628xxx@s.whatsapp.net"])
await conn.groupParticipantsUpdate(jid, ["628xxx@s.whatsapp.net"], "add")
await conn.groupParticipantsUpdate(jid, ["628xxx@s.whatsapp.net"], "remove")
await conn.groupParticipantsUpdate(jid, ["628xxx@s.whatsapp.net"], "promote")
await conn.groupParticipantsUpdate(jid, ["628xxx@s.whatsapp.net"], "demote")
await conn.bulkGroupAction(jid, [jid1, jid2, jid3, jid4, jid5], "remove")
await conn.updateGroupName(jid, "Nama Baru")
await conn.updateGroupDescription(jid, "Deskripsi baru")
await conn.updateGroupProfilePicture(jid, buffer)
await conn.updateGroupSetting(jid, "announcement")
await conn.updateGroupSetting(jid, "not_announcement")
await conn.updateGroupSetting(jid, "locked")
await conn.updateGroupSetting(jid, "unlocked")
const code = await sock.groupInviteCode(jid)
const link = await conn.getGroupInviteLink(jid)
await conn.groupRevokeInvite(jid)
await conn.joinGroupViaLink("https://chat.whatsapp.com/...")
const meta = await conn.groupMetadata(jid)
const all = await conn.fetchAllGroups()
const admins = await conn.getGroupAdmins(jid)
const isAdmin = await conn.isGroupAdmin(jid, "628xxx@s.whatsapp.net")
const members = await conn.getGroupParticipants(jid)
await conn.setGroupJoinApproval(jid, true)
const requests = await conn.getGroupJoinRequests(jid)
await conn.approveGroupJoinRequest(jid, ["628xxx@s.whatsapp.net"])
await conn.rejectGroupJoinRequest(jid, ["628xxx@s.whatsapp.net"])
await conn.setGroupMemberAddMode(jid, "all_member_add")
await conn.setGroupMemberAddMode(jid, "admin_add")
await conn.sendToAdminsOnly(jid, "Pesan khusus admin")
await conn.leaveGroup(jid)

---

STATUS / STORY

await conn.sendStatus({ text: "Pagi semua! ☀️", backgroundColor: "#128C7E" })
await conn.sendStatus({ image: buffer, caption: "Foto hari ini" })
await conn.sendStatus({ video: buffer, caption: "Video keren" })
await conn.sendStatus({ text: "Khusus kamu" }, ["628xxx@s.whatsapp.net"])
await conn.groupStatusV2("120363xxx@g.us", { text: "GM semua! 🌅", backgroundColor: "#25D366" })
await conn.groupStatusV2("120363xxx@g.us", { text: "HBD! 🎉", backgroundColor: "#FF6B6B", font: 1 })
await conn.groupStatusV2("120363xxx@g.us", { image: buffer, caption: "Foto kegiatan" })
await conn.groupStatusV2("120363xxx@g.us", { video: buffer, caption: "Tonton!" })
await conn.groupStatusV2("120363xxx@g.us", { sticker: buffer })

---

NEWSLETTER / CHANNEL

const info = await conn.getNewsletterInfo(newsletterJid)
await conn.sendNewsletterMessage(newsletterJid, { text: "Update terbaru!" })
await conn.sendNewsletterMessage(newsletterJid, { image: buffer, caption: "Foto" })
await conn.sendNewsletterReaction(newsletterJid, messageId, "🔥")
await conn.followNewsletter(newsletterJid)
await conn.unfollowNewsletter(newsletterJid)
await conn.joinNewsletterByUrl("https://whatsapp.com/channel/...")
await conn.getNewsletterMetadata("invite", "inviteCode")

---

QUERY & INFO

const info = await conn.isOnWhatsApp("628xxxxxxxxx")
const contact = await conn.getContactInfo(jid)
const status = await conn.getUserStatus(jid)
const pic = await conn.getProfilePicture(jid)
const picHD = await conn.getProfilePicture(jid, true)
const biz = await conn.getBusinessProfile(jid)
await conn.fetchMessageHistory(50, oldestMsg.key, oldestMsg.messageTimestamp)

---

PRIVACY SETTINGS

await conn.updateLastSeenPrivacy("contacts")
await conn.updateProfilePicturePrivacy("contacts")
await conn.updateStatusPrivacy("contacts")
await conn.updateReadReceiptsPrivacy("all")
await conn.updateGroupsAddPrivacy("contacts")
await conn.updateOnlinePrivacy("all")
await conn.updateDefaultDisappearingMode(86400)

---

PROFILE MANAGEMENT

await conn.updateProfileStatus("Sedang coding...")
await conn.updateProfileName("Nama Baru")
await conn.updateProfilePicture(jid, { url: "./foto.jpg" })
await conn.updateProfilePicture(jid, imageBuffer)
await conn.removeProfilePicture(jid)

---

CALLS

sock.ev.on("call", async ([call]) => { await sock.rejectCall(call.id, call.from) })
sock.rejectAllCalls()

---

TYPING & PRESENCE

await conn.sendTyping(jid)
await conn.sendTyping(jid, 2000, "recording")
await conn.sendWithTyping(jid, { text: "Halo!" })
await conn.sendWithTyping(jid, { text: "Halo!" }, {}, 2000)
await conn.sendPresenceUpdate("composing", jid)
await conn.sendPresenceUpdate("recording", jid)
await conn.sendPresenceUpdate("paused", jid)
await conn.sendPresenceUpdate("available", jid)
await conn.sendPresenceUpdate("unavailable", jid)
await conn.presenceSubscribe(jid)

---

BROADCAST & MULTI-MESSAGE

const results = await conn.broadcastMessage(
  ["628xxx@s.whatsapp.net", "628yyy@s.whatsapp.net"],
  { text: "Pengumuman penting!" }, { delayMs: 1000 }
)
await conn.broadcastToGroups({ text: "Halo semua group!" })
await conn.sendMultipleMessages(jid, [
  { text: "Pesan 1" }, { text: "Pesan 2" }, { image: buffer, caption: "Foto" }
], 800)

---

DOWNLOAD MEDIA

const { downloadMediaMessage, getContentType } = require("n4lyx")
const { createWriteStream } = require("fs")

sock.ev.on("messages.upsert", async ({ messages: [m] }) => {
  if (!m.message) return
  const type = getContentType(m)
  if (type === "imageMessage") {
    const stream = await downloadMediaMessage(m, "stream", {}, {
      logger, reuploadRequest: sock.updateMediaMessage
    })
    stream.pipe(createWriteStream("./download.jpg"))
  }
})

---

POLL - DEKRIPSI VOTE

const { getAggregateVotesInPollMessage } = require("n4lyx")

sock.ev.on("messages.update", async (events) => {
  for (const { key, update } of events) {
    if (!update.pollUpdates) continue
    const creation = await getMessage(key)
    if (!creation) continue
    const result = getAggregateVotesInPollMessage({
      message: creation, pollUpdates: update.pollUpdates
    })
    console.log("Hasil vote:", result)
  }
})

---

IN-MEMORY STORE

const { makeInMemoryStore } = require("n4lyx")
const store = makeInMemoryStore({})
store.readFromFile("./store.json")
setInterval(() => store.writeToFile("./store.json"), 10_000)
store.bind(sock.ev)

---

PRODUCT / CATALOG (BUSINESS)

const catalog = await conn.getCatalog({ jid: "628xxx@s.whatsapp.net", limit: 20 })
const collections = await conn.getCollections("628xxx@s.whatsapp.net")
const product = await conn.productCreate({
  name: "Bot Premium", description: "WhatsApp Bot keren",
  price: 50000, currency: "IDR",
  images: [imageBuffer]
})
await conn.productUpdate(product.id, { name: "Bot Premium Updated" })
await conn.productDelete([productId1, productId2])
await conn.sendProductMessage(jid, productId)
await conn.sendProductMessageWithButtons(jid, {
  title: "Bot Premium", body: "Deskripsi produk",
  footer: "Harga: Rp 50.000",
  thumbnail: imageBuffer,
  buttons: [
    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🛒 Beli", id: "buy" }) },
    { name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: "🌐 Detail", url: "https://..." }) }
  ]
})
const orderDetails = await conn.getOrderDetails(orderId, tokenBase64)

---

JID FORMAT

User: 628XXXXXXXXX@s.whatsapp.net
Group: 123456789-123456@g.us
Newsletter/Channel: xxxxxxxxxx@newsletter
Broadcast list: [timestamp]@broadcast
Story/Status: status@broadcast

---

ALL METHODS LIST

Pesan:
sendImage, sendVideo, sendAudio, sendAudioPTT, sendVoiceNote, sendDocument, sendGIF, sendPTV, sendViewOnce, sendAlbum, sendPoll, sendEvent, sendScheduledCall, sendLocation, sendLiveLocation, sendContact, sendGroupInvite, sendLinkPreview, sendDisappearingToggle

Reply & Mention:
sendReply, sendMediaReply, sendQuotedText, sendTextWithMentions, sendTagAll, sendMentionAll, sendWithQuotedFake, forwardWithComment, sendWithMentionAndReply, groupTagAll

Interaktif:
sendButtonsMessage, sendListMessage, sendTemplateMessage, sendInteractiveMessage, sendInteractiveWithMedia, sendHighlyStructuredMessage, sendImageWithButtons, sendVideoWithButtons, sendDocumentWithButtons

Sticker & Document Pack:
sendStickerFromBuffer, sendStickerFromUrl, sendStickerWithMetadata, sendStickerPack, sendStickerPackAlbum, sendStickerPackMessage, sendStickerMessage, sendDocumentPack

Media Convert:
convertToSticker, convertMedia

Edit & Aksi:
editMessage, deleteMessage, pinMessage, keepMessage, starMessage, unstarMessage, reactMessage, forwardMessage

Chat:
archiveChat, unarchiveChat, pinChat, unpinChat, muteJid, unmuteJid, markAsRead, markAsUnread, deleteChat, clearChat, blockUser, unblockUser, fetchBlocklist, sendSeen

Disappearing:
sendDisappearingMessage, sendDisappearingToggle, setDefaultDisappearing, setGroupDisappearing

Group:
getJoinedGroups, groupCreate, groupParticipantsUpdate, bulkGroupAction, updateGroupName, updateGroupDescription, updateGroupProfilePicture, updateGroupSetting, getGroupInviteLink, revokeGroupInvite, joinGroupViaLink, groupMetadata, fetchAllGroups, getGroupAdmins, isGroupAdmin, getGroupParticipants, sendToAdminsOnly, sendAdminInvite, setGroupJoinApproval, getGroupJoinRequests, approveGroupJoinRequest, rejectGroupJoinRequest, setGroupMemberAddMode, leaveGroup

Status:
sendStatus, groupStatusV2

Channel/Newsletter:
getFollowedChannels, sendNewsletterMessage, sendNewsletterReaction, getNewsletterInfo, followNewsletter, unfollowNewsletter, getNewsletterMetadata, joinNewsletterByUrl

Query & Info:
getAllContacts, isOnWhatsApp, getContactInfo, getUserStatus, getProfilePicture, getBusinessProfile, fetchMessageHistory

Privacy:
updateLastSeenPrivacy, updateProfilePicturePrivacy, updateStatusPrivacy, updateReadReceiptsPrivacy, updateGroupsAddPrivacy, updateOnlinePrivacy, updateDefaultDisappearingMode

Broadcast:
broadcastMessage, broadcastToGroups, sendMultipleMessages

Typing:
sendTyping, sendWithTyping, sendPresenceUpdate, presenceSubscribe

Profile:
updateProfilePicture, removeProfilePicture, updateProfileName, updateProfileStatus

Business:
getCatalog, getCollections, getOrderDetails, productCreate, productDelete, productUpdate, sendProductMessage, sendProductMessageWithButtons

Calls:
rejectAllCalls

---

DISCLAIMER

Bukan afiliasi WhatsApp Inc. Jangan spam atau abuse. Gunakan dengan bijak.

---

Built with stability in mind · N4tzzOfficial
