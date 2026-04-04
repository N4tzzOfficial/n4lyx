<div align="center">

```
███╗   ██╗ ██╗  ██╗ ██╗      ██╗   ██╗ ██╗  ██╗
████╗  ██║ ██║  ██║ ██║      ╚██╗ ██╔╝ ╚██╗██╔╝
██╔██╗ ██║ ███████║ ██║       ╚████╔╝   ╚███╔╝
██║╚██╗██║ ╚════██║ ██║        ╚██╔╝    ██╔██╗
██║ ╚████║      ██║ ███████╗    ██║    ██╔╝ ██╗
╚═╝  ╚═══╝      ╚═╝ ╚══════╝    ╚═╝    ╚═╝  ╚═╝
```

**WhatsApp Web API · Multi-device · No bloat.**

[![npm](https://img.shields.io/npm/v/n4lyx?style=flat-square&color=25D366&labelColor=111&label=npm)](https://npmjs.com/package/n4lyx)
[![downloads](https://img.shields.io/npm/dm/n4lyx?style=flat-square&color=25D366&labelColor=111)](https://npmjs.com/package/n4lyx)
[![license](https://img.shields.io/badge/license-MIT-25D366?style=flat-square&labelColor=111)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-25D366?style=flat-square&labelColor=111)](package.json)

</div>

---

## Apa ini?

**n4lyx** adalah WhatsApp Web API library untuk Node.js yang fokus pada **stabilitas, efisiensi, dan kemudahan penggunaan**.

Dirancang untuk **production-ready**: minim crash, tahan edge-case, dan tetap ringan tanpa bloat.

---

## ✨ Fitur Utama

- ⚡ **Tag All System** — mention semua / admin / non-admin otomatis
- 📸 **Group Status V2** — kirim story langsung ke group
- 🎯 **Shorthand Methods** — kirim pesan tanpa ribet object manual
- 🔄 **Auto-safe Handling** — banyak method sudah null-safe & anti crash
- 🧠 **Smart Internal Handling** — cache, retry, dan sync lebih stabil
- 📡 **Channel Tracker** — cek semua channel & group yang diikuti
- 👥 **Contact Fetcher** — ambil semua kontak tersimpan
- 🖼️ **Media Converter** — resize, compress, dan convert ke sticker otomatis
- 📦 **Sticker Pack Batch** — kirim sticker pack sekaligus (bukan 1-by-1)
- 📄 **Document Pack** — kirim banyak dokumen sekaligus dengan delay & parallel mode

---

## ⚠️ Stability & Fixes (Latest)

- ✅ **Profile Picture Safe Fetch** — tidak crash jika 404 / not-authorized, return `null`
- ✅ **Message Handling Stabil** — dedup cache dibungkus try/catch
- ✅ **Sync State Robust** — transisi state lebih aman, timeout tetap berjalan
- ✅ **Group Metadata Safe Guard** — tidak error jika data kosong
- ✅ **Newsletter Parsing Aman** — selalu dilindungi, tidak crash
- ✅ **Interactive & Button Normalization** — support berbagai format tombol
- ✅ **isOnWhatsApp Konsisten** — selalu return object (tidak undefined)
- ✅ **chalk Optional** — fallback otomatis jika tidak terinstall
- ✅ **Broadcast & Group Fix** — method internal lebih akurat
- ✅ **sendDocument Auto Mime** — deteksi mimetype otomatis dari extension
- ✅ **sendStickerPack Batch** — kirim paralel per batch, bukan 1-by-1
- ✅ **Auto Join Channel** — client otomatis join channel saat connect

---

> **Disclaimer:** Bukan afiliasi dengan WhatsApp Inc. Jangan spam. Jangan abuse. Konsekuensi akun banned adalah tanggung jawab kamu sendiri.

---

## Install

```bash
npm i n4lyx
```

```bash
# Optional tapi direkomendasikan untuk fitur convert/sticker
npm i sharp        # lebih cepat (recommended)
npm i jimp         # fallback jika sharp tidak bisa
npm i link-preview-js
npm i qrcode-terminal
```

```js
const { default: makeWASocket } = require("n4lyx")
```

---

## Quick Start

```js
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
```

---

## Login

### QR Code
```js
const sock = makeWASocket({ printQRInTerminal: true })
```

### Pairing Code
```js
const sock = makeWASocket({ printQRInTerminal: false })
if (!sock.authState.creds.registered) {
  const code = await sock.requestPairingCode("628XXXXXXXXX")
  console.log("Kode pairing:", code)
}
```

### Simpan Session
```js
const { state, saveCreds } = await useMultiFileAuthState("auth")
const sock = makeWASocket({ auth: state })
sock.ev.on("creds.update", saveCreds)
```

---

## Config Penting

### Cache Group Metadata
```js
const NodeCache = require("node-cache")
const groupCache = new NodeCache({ stdTTL: 300, useClones: false })

const sock = makeWASocket({
  cachedGroupMetadata: async (jid) => groupCache.get(jid)
})

sock.ev.on("groups.update", async ([e]) => { groupCache.set(e.id, await sock.groupMetadata(e.id)) })
sock.ev.on("group-participants.update", async (e) => { groupCache.set(e.id, await sock.groupMetadata(e.id)) })
```

### Background Mode
```js
const sock = makeWASocket({ markOnlineOnConnect: false })
```

---

## NEW: Channel, Group & Contact Tracker ⚡

### Cek Semua Channel yang Diikuti
```js
const channels = await sock.getFollowedChannels()
// → [{ jid, name, description, subscribers, role, state, invite }, ...]

for (const ch of channels) {
  console.log(`📡 ${ch.name} — ${ch.subscribers} subscribers`)
}
```

### Cek Semua Group yang Diikuti
```js
// Cepat (tanpa profile pic)
const groups = await sock.getJoinedGroups()
// → [{ id, subject, participants, ... }, ...]

// Lengkap dengan foto profil
const groupsFull = await sock.getJoinedGroups(true)
// → [{ id, subject, participants, profilePic, ... }, ...]

for (const g of groups) {
  console.log(`👥 ${g.subject} — ${g.participants?.length} member`)
}
```

### Cek Semua Kontak
```js
const contacts = await sock.getAllContacts()
// → [{ jid, lid, exists, name }, ...]

const saved = contacts.filter(c => c.exists)
console.log(`📒 Total kontak tersimpan: ${saved.length}`)
```

---

## NEW: Convert, Resize & Compress ⚡

### Convert Image → Sticker WebP
```js
// Dari buffer gambar biasa
const { buffer, metadata } = await sock.convertToSticker(imageBuffer, {
  packName:      "Pack Gue",
  packPublisher: "N4tzz",
  quality:       80,    // 1-100
  maxSize:       512,   // max px (default 512)
})
await sock.sendMessage(jid, { sticker: buffer, ...metadata })

// Atau langsung kirim setelah convert
const result = await sock.convertToSticker(imageBuffer, { packName: "Sticker", packPublisher: "Bot" })
await sock.sendStickerWithMetadata(jid, result.buffer, result.metadata)
```

### Resize & Compress Image
```js
// Resize ke max 800px, format JPEG, quality 75%
const compressed = await sock.convertMedia(imageBuffer, {
  maxSize: 800,
  format:  "jpeg",
  quality: 75,
})
await sock.sendImage(jid, compressed, "Foto sudah dikompress")

// Resize ke dimensi spesifik
const resized = await sock.convertMedia(imageBuffer, {
  width:   1280,
  height:  720,
  format:  "webp",
  quality: 85,
})

// Convert ke PNG
const png = await sock.convertMedia(imageBuffer, { format: "png", quality: 90 })
```

> **Catatan:** Butuh `sharp` (recommended) atau `jimp` terinstall.
> ```bash
> npm i sharp   # atau: npm i jimp
> ```

---

## NEW: Sticker Pack Batch ⚡

### Kirim Sticker Pack Sekaligus (Batch Parallel)
```js
// sendStickerPack — sekarang batch paralel per 5, bukan 1-by-1
await sock.sendStickerPack(jid, [buf1, buf2, buf3, buf4, buf5], "Pack Gue", "N4tzz", {
  batchSize:  5,    // kirim 5 sekaligus per batch
  delayBatch: 500,  // delay 500ms antar batch
})

// sendStickerPackAlbum — batch lebih besar (max 10 per batch)
const results = await sock.sendStickerPackAlbum(jid, [buf1, buf2, buf3], "Pack Gue", "N4tzz", {
  batchSize:  10,
  delayBatch: 800,
})
console.log(results) // [{ success, msg? }, ...]
```

---

## NEW: Document Pack ⚡

### Kirim Banyak Dokumen Sekaligus
```js
// Sequential dengan delay (default)
const results = await sock.sendDocumentPack(jid, [
  { buffer: pdfBuffer,  fileName: "laporan.pdf",   caption: "Ini laporannya" },
  { buffer: excelBuf,   fileName: "data.xlsx",      caption: "Data excel" },
  { url: "https://...", fileName: "manual.pdf" },
], {
  delayMs: 600,  // delay 600ms antar dokumen
})

// Kirim semua sekaligus (paralel)
const results = await sock.sendDocumentPack(jid, documents, { parallel: true })

console.log(results) // [{ success, msg? }, ...]
```

> **Auto Mime Detection** — tidak perlu set `mimetype` manual. Deteksi otomatis dari extension:
> `.pdf` → `application/pdf`, `.xlsx` → spreadsheet, `.apk` → android package, dll.

---

## Kirim Pesan

### Teks biasa
```js
await sock.sendMessage(jid, { text: "Halo!" })
```

### Reply / Quote
```js
await sock.sendMessage(jid, { text: "Oke siap" }, { quoted: message })
```

### Mention user
```js
await sock.sendMessage(jid, {
  text: "Hei @628XXXXXXXXX, cek ini",
  mentions: ["628XXXXXXXXX@s.whatsapp.net"]
})
```

### Tag All ⚡
```js
// Tag semua member
await sock.sendMessage(jid, { text: "📢 Pengumuman!", tagAll: true })
// Tag admin saja
await sock.sendMessage(jid, { text: "🔔 Info admin", tagAll: true, tagAllScope: "admins" })
// Tag non-admin saja
await sock.sendMessage(jid, { text: "👋 Hei member!", tagAll: true, tagAllScope: "non_admins" })

// Ambil list JID manual
const jids = await sock.groupTagAll(groupJid, "all")
```

---

## Shorthand Methods ⚡

### Gambar & Video
```js
await sock.sendImage(jid, buffer, "Caption opsional")
await sock.sendImage(jid, { url: "./foto.jpg" })
await sock.sendVideo(jid, buffer, "Caption opsional")
```

### Audio
```js
await sock.sendAudio(jid, buffer)           // audio biasa
await sock.sendAudio(jid, buffer, true)     // voice note / PTT
await sock.sendAudioPTT(jid, buffer)        // alias PTT
await sock.sendVoiceNote(jid, buffer)       // alias voice note
```

### Dokumen (Auto Mime Detection)
```js
// Mimetype auto-detect dari extension — tidak perlu set manual
await sock.sendDocument(jid, buffer, "laporan.pdf", null, "Ini file-nya")
await sock.sendDocument(jid, buffer, "data.xlsx")
await sock.sendDocument(jid, buffer, "app.apk", null, "Update terbaru")

// Atau set manual jika perlu
await sock.sendDocument(jid, buffer, "file.bin", "application/octet-stream")
```

### GIF & Video Note
```js
await sock.sendGIF(jid, gifBuffer, "wkwk")
await sock.sendPTV(jid, videoBuffer)
await sock.sendPTV(jid, videoBuffer, { quoted: m })
```

### View Once
```js
await sock.sendViewOnce(jid, { image: buffer })
await sock.sendViewOnce(jid, { video: buffer }, { quoted: m })
await sock.sendViewOnce(jid, { audio: buffer, mimetype: "audio/mp4" })
```

### Sticker
```js
await sock.sendStickerFromBuffer(jid, buffer)
await sock.sendStickerFromUrl(jid, "https://example.com/sticker.webp")
await sock.sendStickerWithMetadata(jid, buffer, {
  packName: "Pack Gue", packPublisher: "N4tzz", categories: ["😂"]
})
// Kirim banyak sticker (batch paralel, bukan 1-by-1)
await sock.sendStickerPack(jid, [buf1, buf2, buf3], "Pack Gue", "N4tzz")
```

### Album
```js
await sock.sendAlbum(jid, [
  { image: buf1, caption: "Foto 1" },
  { image: buf2, caption: "Foto 2" },
  { video: buf3, caption: "Video" }
])
```

### Poll
```js
await sock.sendPoll(jid, "Bahasa favorit?", ["JavaScript", "Python", "Go"])
await sock.sendPoll(jid, "Setuju?", ["Ya", "Tidak"], { selectableCount: 1 })
```

### Lokasi
```js
await sock.sendLocation(jid, -7.797068, 110.370529, "Yogyakarta")
await sock.sendLiveLocation(jid, -7.79, 110.37, 10, 300)
```

### Kontak
```js
await sock.sendContact(jid, { fullName: "Budi Santoso", phoneNumber: "+62812xxxxxxx", org: "Acme" })
await sock.sendContact(jid, [
  { fullName: "Budi", phoneNumber: "+62812xxxxxxx" },
  { fullName: "Sari", phoneNumber: "+62813xxxxxxx" }
])
```

### Event & Jadwal Call
```js
await sock.sendEvent(jid, {
  name: "Rapat Mingguan", description: "Sync tim",
  startTime: Date.now() + 3_600_000, endTime: Date.now() + 7_200_000,
  location: "Google Meet", joinLink: "https://meet.google.com/xxx"
})
await sock.sendScheduledCall(jid, "Catch-up", Date.now() + 86_400_000)       // video
await sock.sendScheduledCall(jid, "Voice call", Date.now() + 3_600_000, 2)   // voice
```

### Reply & Mention
```js
await sock.sendReply(jid, "Oke siap!", m)
await sock.sendMediaReply(jid, { image: buffer, caption: "ini" }, m)
await sock.sendQuotedText(jid, "Hayo @kamu", m, ["628xxx@s.whatsapp.net"])
await sock.sendTextWithMentions(jid, "Halo @A dan @B", [jidA, jidB])
await sock.sendTagAll(jid, "📢 Pengumuman untuk semua")
await sock.sendTagAll(jid, "🔔 Khusus admin", "admins")
await sock.sendMentionAll(jid, "Hei semua!")
```

### Invite Group
```js
await sock.sendGroupInvite(jid, "120363xxx@g.us")
```

### Typing Indicator
```js
await sock.sendTyping(jid)                                   // typing 3 detik
await sock.sendTyping(jid, 2000, "recording")               // recording 2 detik
await sock.sendWithTyping(jid, { text: "Halo!" })
await sock.sendWithTyping(jid, { text: "Halo!" }, {}, 2000)
```

### Broadcast & Multi-Message
```js
const results = await sock.broadcastMessage(
  ["628xxx@s.whatsapp.net", "628yyy@s.whatsapp.net"],
  { text: "Pengumuman penting!" }, { delayMs: 1000 }
)
await sock.broadcastToGroups({ text: "Halo semua group!" })
await sock.sendMultipleMessages(jid, [
  { text: "Pesan 1" }, { text: "Pesan 2" }, { image: buffer, caption: "Foto" }
], 800)
```

### Status / Story
```js
await sock.sendStatus({ text: "Pagi semua! ☀️", backgroundColor: "#128C7E" })
await sock.sendStatus({ image: buffer, caption: "Foto hari ini" })
await sock.sendStatus({ text: "Khusus kamu" }, ["628xxx@s.whatsapp.net"])
```

### Group Status V2 ⚡
```js
await sock.groupStatusV2("120363xxx@g.us", { text: "GM semua! 🌅", backgroundColor: "#25D366" })
await sock.groupStatusV2("120363xxx@g.us", { text: "HBD! 🎉", backgroundColor: "#FF6B6B", font: 1 })
await sock.groupStatusV2("120363xxx@g.us", { image: buffer, caption: "Foto kegiatan" })
await sock.groupStatusV2("120363xxx@g.us", { video: buffer, caption: "Tonton!" })
await sock.groupStatusV2("120363xxx@g.us", { sticker: buffer })
```

---

## Edit, Delete, React

```js
const sent = await sock.sendMessage(jid, { text: "Ada typo" })
await sock.editMessage(jid, sent.key, "Sudah diperbaiki")
await sock.deleteMessage(jid, sent.key)
await sock.pinMessage(jid, m.key)              // 24 jam
await sock.pinMessage(jid, m.key, 604800)      // 7 hari
await sock.pinMessage(jid, m.key, 0)           // unpin
await sock.keepMessage(jid, m.key)
await sock.keepMessage(jid, m.key, false)
await sock.starMessage(jid, m.key, true)
await sock.unstarMessage(jid, m.key)
await sock.reactMessage(jid, m.key, "❤️")
await sock.reactMessage(jid, m.key, "")        // hapus reaksi
await sock.forwardMessage(jid, m)
await sock.forwardWithComment(jid, m, "Check ini!")
```

---

## Chat Management

```js
await sock.archiveChat(jid, lastMsg)
await sock.unarchiveChat(jid, lastMsg)
await sock.pinChat(jid)
await sock.unpinChat(jid)
await sock.muteJid(jid)
await sock.muteJid(jid, 24 * 60 * 60 * 1000)
await sock.unmuteJid(jid)
await sock.markAsRead([m.key])
await sock.sendSeen(jid)
await sock.markAsUnread(jid, lastMsg)
await sock.deleteChat(jid)
await sock.clearChat(jid)
await sock.blockUser(jid)
await sock.unblockUser(jid)
await sock.fetchBlocklist()
```

---

## Disappearing Messages

```js
await sock.sendDisappearingToggle(jid, 86400)
await sock.setGroupDisappearing(jid, 604800)
await sock.setGroupDisappearing(jid, 0)
await sock.sendDisappearingMessage(jid, { text: "Pesan ini akan hilang" }, 86400)
await sock.setDefaultDisappearing(86400)
```

---

## Groups

```js
const group = await sock.groupCreate("Nama Group", ["628xxx@s.whatsapp.net"])
await sock.groupParticipantsUpdate(jid, ["628xxx@s.whatsapp.net"], "add")
await sock.groupParticipantsUpdate(jid, ["628xxx@s.whatsapp.net"], "remove")
await sock.groupParticipantsUpdate(jid, ["628xxx@s.whatsapp.net"], "promote")
await sock.groupParticipantsUpdate(jid, ["628xxx@s.whatsapp.net"], "demote")
await sock.bulkGroupAction(jid, [jid1, jid2, jid3], "remove")
await sock.updateGroupName(jid, "Nama Baru")
await sock.updateGroupDescription(jid, "Deskripsi baru")
await sock.updateGroupProfilePicture(jid, buffer)
await sock.updateGroupSetting(jid, "announcement")
await sock.updateGroupSetting(jid, "not_announcement")
await sock.updateGroupSetting(jid, "locked")
await sock.updateGroupSetting(jid, "unlocked")
const code = await sock.groupInviteCode(jid)
const link = await sock.getGroupInviteLink(jid)
await sock.groupRevokeInvite(jid)
await sock.groupAcceptInvite(code)
await sock.joinGroupViaLink("https://chat.whatsapp.com/...")
const meta    = await sock.groupMetadata(jid)
const all     = await sock.fetchAllGroups()
const admins  = await sock.getGroupAdmins(jid)
const isAdmin = await sock.isGroupAdmin(jid, "628xxx@s.whatsapp.net")
const members = await sock.getGroupParticipants(jid)
await sock.sendToAdminsOnly(jid, "Pesan khusus admin")
await sock.sendAdminInvite(jid, targetJid)
await sock.setGroupJoinApproval(jid, true)
const requests = await sock.getGroupJoinRequests(jid)
await sock.approveGroupJoinRequest(jid, ["628xxx@s.whatsapp.net"])
await sock.rejectGroupJoinRequest(jid, ["628xxx@s.whatsapp.net"])
await sock.setGroupMemberAddMode(jid, "all_member_add")
await sock.setGroupMemberAddMode(jid, "admin_add")
await sock.leaveGroup(jid)
```

---

## Interaktif: Buttons, List, Template ⚡

```js
await sock.sendButtonsMessage(jid, "Pilih salah satu:", [
  { buttonId: "id1", buttonText: { displayText: "Opsi A" }, type: 1 },
  { buttonId: "id2", buttonText: { displayText: "Opsi B" }, type: 1 }
], "Footer")

await sock.sendImageWithButtons(jid, buffer, "Caption", [
  { buttonId: "confirm", buttonText: { displayText: "✅ Konfirmasi" }, type: 1 },
  { buttonId: "cancel",  buttonText: { displayText: "❌ Batal" },     type: 1 }
])
await sock.sendVideoWithButtons(jid, videoBuffer, "Tonton dulu", [
  { buttonId: "share", buttonText: { displayText: "📤 Share" }, type: 1 }
])
await sock.sendDocumentWithButtons(jid, pdfBuffer, "laporan.pdf", "Laporan ini", [
  { buttonId: "download", buttonText: { displayText: "⬇️ Download" }, type: 1 }
])

await sock.sendListMessage(jid, {
  text: "Pilih menu:", footer: "n4lyx bot", title: "Main Menu", buttonText: "Buka Menu",
  sections: [{
    title: "Kategori 1",
    rows: [
      { title: "Info", rowId: "info", description: "Lihat informasi" },
      { title: "Help", rowId: "help", description: "Bantuan" }
    ]
  }]
})

await sock.sendTemplateMessage(jid, {
  text: "Hai! Ada yang bisa dibantu?", footer: "n4lyx",
  templateButtons: [
    { index: 1, urlButton:  { displayText: "🌐 Website",  url: "https://example.com" } },
    { index: 2, callButton: { displayText: "📞 Telepon",  phoneNumber: "+62812xxxxxxx" } },
    { index: 3, quickReplyButton: { displayText: "💬 Chat", id: "chat" } }
  ]
})
```

---

## Newsletter ⚡

```js
const info = await sock.getNewsletterInfo(newsletterJid)
await sock.sendNewsletterMessage(newsletterJid, { text: "Update terbaru!" })
await sock.sendNewsletterMessage(newsletterJid, { image: buffer, caption: "Foto" })
await sock.sendNewsletterReaction(newsletterJid, messageId, "🔥")
```

---

## Download Media

```js
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
```

---

## Poll — Dekripsi Vote

```js
const { getAggregateVotesInPollMessage } = require("n4lyx")

sock.ev.on("messages.update", async (events) => {
  for (const { key, update } of events) {
    if (!update.pollUpdates) continue
    const creation = await getMessage(key)
    if (!creation) continue
    const result = getAggregateVotesInPollMessage({ message: creation, pollUpdates: update.pollUpdates })
    console.log("Hasil vote:", result)
  }
})
```

---

## Presence

```js
await sock.sendPresenceUpdate("composing", jid)
await sock.sendPresenceUpdate("recording", jid)
await sock.sendPresenceUpdate("paused", jid)
await sock.sendPresenceUpdate("available", jid)
await sock.sendPresenceUpdate("unavailable", jid)
await sock.presenceSubscribe(jid)
sock.ev.on("presence.update", ({ id, presences }) => { console.log(id, presences) })
```

---

## Query & Info

```js
const info    = await sock.isOnWhatsApp("628xxxxxxxxx")
const contact = await sock.getContactInfo(jid)
const status  = await sock.getUserStatus(jid)
const pic     = await sock.getProfilePicture(jid)
const picHD   = await sock.getProfilePicture(jid, true)
const biz     = await sock.getBusinessProfile(jid)
await sock.fetchMessageHistory(50, oldest.key, oldest.messageTimestamp)
```

---

## Privacy

```js
await sock.updateLastSeenPrivacy("contacts")
await sock.updateProfilePicturePrivacy("contacts")
await sock.updateStatusPrivacy("contacts")
await sock.updateReadReceiptsPrivacy("all")
await sock.updateGroupsAddPrivacy("contacts")
await sock.updateOnlinePrivacy("all")
await sock.updateDefaultDisappearingMode(86400)
```

---

## Profile

```js
await sock.updateProfileStatus("Sedang coding...")
await sock.updateProfileName("Nama Baru")
await sock.updateProfilePicture(jid, { url: "./foto.jpg" })
await sock.removeProfilePicture(jid)
```

---

## Calls

```js
sock.ev.on("call", async ([call]) => { await sock.rejectCall(call.id, call.from) })
sock.rejectAllCalls()
```

---

## In-Memory Store

```js
const { makeInMemoryStore } = require("n4lyx")
const store = makeInMemoryStore({})
store.readFromFile("./store.json")
setInterval(() => store.writeToFile("./store.json"), 10_000)
store.bind(sock.ev)
```

---

## JID Format

| Tipe | Format |
|---|---|
| User | `628XXXXXXXXX@s.whatsapp.net` |
| Group | `123456789-123456@g.us` |
| Newsletter/Channel | `xxxxxxxxxx@newsletter` |
| Broadcast list | `[timestamp]@broadcast` |
| Story / Status | `status@broadcast` |

---

## Optional Dependencies

```bash
npm i sharp           # resize, compress, convert (RECOMMENDED)
npm i jimp            # fallback resize/convert jika sharp tidak bisa
npm i link-preview-js # link preview otomatis
npm i qrcode-terminal # QR di terminal
```

---

## Semua Fitur n4lyx

<details>
<summary><strong>Lihat semua method (klik untuk expand)</strong></summary>

### NEW ⚡

| Method | Keterangan |
|---|---|
| `getFollowedChannels()` | Semua channel/newsletter yang diikuti |
| `getJoinedGroups(withMeta?)` | Semua group yang diikuti, optional dengan foto profil |
| `getAllContacts()` | Semua kontak tersimpan |
| `convertToSticker(buf, opts)` | Convert image → WebP sticker (resize+compress) |
| `convertMedia(buf, opts)` | Resize + compress image (JPEG/PNG/WebP) |
| `sendStickerPackAlbum(jid, stickers, pack, pub, opts)` | Kirim sticker pack batch besar paralel |
| `sendDocumentPack(jid, docs, opts)` | Kirim banyak dokumen sekaligus |

### Pesan

| Method | Keterangan |
|---|---|
| `sendImage` | Kirim gambar |
| `sendVideo` | Kirim video |
| `sendAudio` | Kirim audio / PTT |
| `sendAudioPTT` | Alias PTT |
| `sendVoiceNote` | Alias voice note |
| `sendDocument` | Kirim dokumen (auto mime detection) |
| `sendGIF` | Kirim GIF animasi |
| `sendPTV` | Circular video note |
| `sendViewOnce` | View-once media |
| `sendStickerMessage` | Kirim sticker |
| `sendStickerFromBuffer` | Sticker dari Buffer |
| `sendStickerFromUrl` | Sticker dari URL |
| `sendStickerWithMetadata` | Sticker + pack info |
| `sendStickerPack` | Kirim banyak sticker (batch paralel) |
| `sendStickerPackAlbum` | Kirim sticker pack album mode |
| `sendDocumentPack` | Kirim banyak dokumen sekaligus |
| `sendAlbum` | Album swipeable |
| `sendPoll` | Buat poll |
| `sendEvent` | WhatsApp Event |
| `sendScheduledCall` | Jadwalkan panggilan |
| `sendLocation` | Lokasi statis |
| `sendLiveLocation` | Live location |
| `sendContact` | Kartu kontak |
| `sendGroupInvite` | Invite group sebagai card |
| `sendLinkPreview` | Kirim dengan link preview |
| `sendProductMessage` | Kirim produk (katalog) |

### Reply & Mention

| Method | Keterangan |
|---|---|
| `sendReply` | Reply teks cepat |
| `sendMediaReply` | Reply dengan media |
| `sendQuotedText` | Reply + mention |
| `sendTextWithMentions` | Teks + mention array |
| `sendTagAll` | Tag all shorthand |
| `sendMentionAll` | Mention semua member |
| `sendWithQuotedFake` | Kirim dengan fake quote |
| `forwardWithComment` | Forward + komentar |
| `sendWithMentionAndReply` | Reply + mention sekaligus |
| `groupTagAll` | Ambil list JID by scope |

### Interaktif

| Method | Keterangan |
|---|---|
| `sendButtonsMessage` | Pesan dengan tombol |
| `sendListMessage` | Pesan dengan menu list |
| `sendTemplateMessage` | Template message |
| `sendInteractiveMessage` | Interactive message raw |
| `sendHighlyStructuredMessage` | Highly structured message |
| `sendImageWithButtons` | Gambar + tombol |
| `sendVideoWithButtons` | Video + tombol |
| `sendDocumentWithButtons` | Dokumen + tombol |

### Newsletter / Channel

| Method | Keterangan |
|---|---|
| `getFollowedChannels` | Semua channel yang diikuti |
| `sendNewsletterMessage` | Kirim ke newsletter |
| `sendNewsletterReaction` | Reaksi di newsletter |
| `getNewsletterInfo` | Info channel |

### Typing & Presence

| Method | Keterangan |
|---|---|
| `sendTyping` | Typing indicator + auto stop |
| `sendWithTyping` | Kirim pesan pakai typing dulu |
| `sendSeen` | Tandai pesan sudah dibaca |

### Broadcast

| Method | Keterangan |
|---|---|
| `broadcastMessage` | Kirim ke banyak JID |
| `broadcastToGroups` | Kirim ke banyak group |
| `sendMultipleMessages` | Kirim array pesan ke 1 JID |

### Edit & Aksi Pesan

| Method | Keterangan |
|---|---|
| `editMessage` | Edit pesan terkirim |
| `deleteMessage` | Hapus untuk semua |
| `pinMessage` | Pin / unpin pesan |
| `keepMessage` | Bookmark pesan |
| `starMessage` / `unstarMessage` | Bintang pesan |
| `reactMessage` | React / hapus reaksi |
| `forwardMessage` | Forward pesan |

### Chat Management

| Method | Keterangan |
|---|---|
| `archiveChat` / `unarchiveChat` | Arsip chat |
| `pinChat` / `unpinChat` | Pin chat |
| `muteJid` / `unmuteJid` | Mute / unmute chat |
| `markAsRead` / `markAsUnread` | Tandai baca |
| `deleteChat` / `clearChat` | Hapus / kosongkan chat |
| `blockUser` / `unblockUser` | Blokir user |
| `fetchBlocklist` | Daftar yang diblokir |

### Group

| Method | Keterangan |
|---|---|
| `getJoinedGroups` | Semua group yang diikuti |
| `groupCreate` | Buat group |
| `groupParticipantsUpdate` | add/remove/promote/demote |
| `bulkGroupAction` | Bulk action member |
| `updateGroupName` | Ganti nama |
| `updateGroupDescription` | Ganti deskripsi |
| `updateGroupProfilePicture` | Ganti foto group |
| `updateGroupSetting` | Setting group |
| `getGroupInviteLink` | Invite link URL |
| `revokeGroupInvite` | Revoke link |
| `joinGroupViaLink` | Join via URL |
| `groupMetadata` | Metadata group |
| `fetchAllGroups` | Semua group |
| `getGroupAdmins` | Daftar admin |
| `isGroupAdmin` | Cek apakah admin |
| `getGroupParticipants` | Daftar member |
| `sendToAdminsOnly` | Pesan + mention admin |
| `sendAdminInvite` | Undang jadi admin |
| `setGroupJoinApproval` | Nyalakan approval join |
| `getGroupJoinRequests` | Daftar request join |
| `approveGroupJoinRequest` | Approve request |
| `rejectGroupJoinRequest` | Reject request |
| `setGroupMemberAddMode` | Siapa yang bisa add member |
| `leaveGroup` | Leave group |
| `setGroupDisappearing` | Disappearing messages di group |

### Disappearing

| Method | Keterangan |
|---|---|
| `sendDisappearingMessage` | Kirim pesan ephemeral |
| `sendDisappearingToggle` | Nyalakan/matikan disappearing |
| `setDefaultDisappearing` | Default disappearing mode |

### Status / Story

| Method | Keterangan |
|---|---|
| `sendStatus` | Post story pribadi |
| `groupStatusV2` | Post story di group ⚡ |

### Convert & Media Utils ⚡

| Method | Keterangan |
|---|---|
| `convertToSticker(buf, opts)` | Convert image → WebP sticker |
| `convertMedia(buf, opts)` | Resize + compress image |

### Query & Info

| Method | Keterangan |
|---|---|
| `getAllContacts` | Semua kontak tersimpan |
| `isOnWhatsApp` | Cek nomor (input fleksibel) |
| `getContactInfo` | Info kontak |
| `getUserStatus` | Status teks (safe) |
| `getProfilePicture` | Foto profil (safe) |
| `getBusinessProfile` | Business profile |
| `fetchMessageHistory` | Riwayat pesan |

### Privacy

| Method | Keterangan |
|---|---|
| `updateLastSeenPrivacy` | Privacy last seen |
| `updateProfilePicturePrivacy` | Privacy foto profil |
| `updateStatusPrivacy` | Privacy status |
| `updateReadReceiptsPrivacy` | Privacy read receipt |
| `updateGroupsAddPrivacy` | Privacy add ke group |
| `updateOnlinePrivacy` | Privacy online |
| `updateDefaultDisappearingMode` | Default disappearing |

</details>

---

## License

MIT — lihat [LICENSE](LICENSE).

---

<div align="center">
<sub>Built with stability in mind · N4tzzOfficial</sub>
</div>