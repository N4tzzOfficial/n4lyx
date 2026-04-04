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

## ✨ **Fitur Utama**

- ⚡ **Tag All System** — mention semua / admin / non-admin otomatis  
- 📸 **Group Status V2** — kirim story langsung ke group  
- 🎯 **Shorthand Methods** — kirim pesan tanpa ribet object manual  
- 🔄 **Auto-safe Handling** — banyak method sudah null-safe & anti crash  
- 🧠 **Smart Internal Handling** — cache, retry, dan sync lebih stabil  

---

## ⚠️ **Stability & Fixes (Latest Update)**

Versi terbaru membawa peningkatan besar pada stabilitas sistem:

- ✅ **Profile Picture Safe Fetch**  
  Tidak crash jika error (404, *not-authorized*, dll). Akan mengembalikan `null`.

- ✅ **Message Handling Stabil**  
  Dedup cache dan proses *upsert* sudah dibungkus `try/catch` untuk mencegah crash.

- ✅ **Sync State Lebih Robust**  
  Transisi state lebih aman dengan handling timeout yang tetap berjalan normal.

- ✅ **Group Metadata Safe Guard**  
  Tidak menyebabkan error jika data kosong atau tidak valid.

- ✅ **Newsletter Parsing Aman**  
  Semua proses parsing dilindungi, tidak akan crash jika terjadi kegagalan.

- ✅ **Interactive & Button Normalization**  
  Mendukung berbagai format tombol (`buttonId`, `id`, `text`, dll).

- ✅ **WhatsApp Check Konsisten**  
  Method seperti `isOnWhatsApp`, `onWhatsApp`, dll selalu mengembalikan array (tidak `undefined`).

- ✅ **Dependency Optional**  
  Dependency seperti `chalk` bersifat opsional dan memiliki fallback otomatis.

- ✅ **Broadcast & Group Handling Fix**  
  Menggunakan method internal yang lebih akurat dan stabil untuk pengiriman massal dan pengelolaan group.

---

> **Disclaimer:** Bukan afiliasi dengan WhatsApp Inc. Jangan spam. Jangan abuse. Konsekuensi akun banned adalah tanggung jawab kamu sendiri.

---

## Install

```bash
npm i n4lyx
```

```js
// CommonJS
const { default: makeWASocket } = require('n4lyx')

// ESM
import makeWASocket from 'n4lyx'
```

---

## Quick Start

Ini contoh bot paling minimal yang bisa jalan — terima pesan, balas "pong", auto-reconnect kalau putus.

```js
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('n4lyx')
const { Boom } = require('@hapi/boom')

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  })

  // Handle koneksi
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const shouldReconnect =
        new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) start()
    }
  })

  // Simpan credentials
  sock.ev.on('creds.update', saveCreds)

  // Terima pesan
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message) return
    await sock.sendMessage(msg.key.remoteJid, { text: 'pong' })
  })
}

start()
```

---

## Login

### QR Code

Scan QR dari terminal — paling cepat untuk testing.

```js
const sock = makeWASocket({ printQRInTerminal: true })
```

### Pairing Code

Cocok kalau nggak bisa scan QR (server headless, dll).

```js
const sock = makeWASocket({ printQRInTerminal: false })

if (!sock.authState.creds.registered) {
  const code = await sock.requestPairingCode('628XXXXXXXXX')
  console.log('Kode pairing:', code) // → misalnya: N4LX-1234
}
```

Custom kode (tepat 8 karakter):

```js
const code = await sock.requestPairingCode('628XXXXXXXXX', 'N4LYX001')
```

### Simpan Session

Session disimpan ke folder `auth/`. Kalau file-nya ada, next run langsung connect tanpa QR lagi.

```js
const { state, saveCreds } = await useMultiFileAuthState('auth')
const sock = makeWASocket({ auth: state })
sock.ev.on('creds.update', saveCreds)
```

> **Untuk production:** simpan credentials ke database (PostgreSQL / MongoDB / Redis), bukan ke disk. Disk bisa corrupt, database tidak.

---

## Config Penting

### Cache Group Metadata

Wajib kalau bot kamu aktif di banyak group. Ini ngurangin request ke WA API secara signifikan.

```js
const NodeCache = require('node-cache')
const groupCache = new NodeCache({ stdTTL: 300, useClones: false })

const sock = makeWASocket({
  cachedGroupMetadata: async (jid) => groupCache.get(jid)
})

// Update cache kalau ada perubahan di group
sock.ev.on('groups.update', async ([e]) => {
  groupCache.set(e.id, await sock.groupMetadata(e.id))
})
sock.ev.on('group-participants.update', async (e) => {
  groupCache.set(e.id, await sock.groupMetadata(e.id))
})
```

### Background Mode

Bot nggak kelihatan online tapi tetap terima pesan.

```js
const sock = makeWASocket({ markOnlineOnConnect: false })
```

### Message Store (untuk Poll & Retry)

Diperlukan untuk dekripsi poll vote dan message retry.

```js
const sock = makeWASocket({
  getMessage: async (key) => await getMessageFromDB(key)
  // implementasi getMessageFromDB sesuai DB kamu
})
```

---

## Kirim Pesan

Semua pengiriman pesan lewat satu method: `sock.sendMessage(jid, content, options?)`.

### Teks biasa

```js
await sock.sendMessage(jid, { text: 'Halo!' })
```

### Reply / Quote

```js
await sock.sendMessage(jid, { text: 'Oke siap' }, { quoted: message })
```

### Mention user

```js
await sock.sendMessage(jid, {
  text: 'Hei @628XXXXXXXXX, cek ini',
  mentions: ['628XXXXXXXXX@s.whatsapp.net']
})
```

### Tag All ⚡

Fitur eksklusif n4lyx. Auto-fetch participant list lalu mention semua sekaligus.

```js
// Tag semua member
await sock.sendMessage(jid, {
  text: '📢 Pengumuman penting buat semua!',
  tagAll: true
})

// Tag admin aja
await sock.sendMessage(jid, {
  text: '🔔 Info untuk para admin',
  tagAll: true,
  tagAllScope: 'admins'
})

// Tag non-admin aja
await sock.sendMessage(jid, {
  text: '👋 Hei member!',
  tagAll: true,
  tagAllScope: 'non_admins'
})
```

Atau ambil list JID-nya dulu kalau mau diproses manual:

```js
const jids = await sock.groupTagAll(groupJid, 'all')
// → ['628xxx@s.whatsapp.net', '628yyy@s.whatsapp.net', ...]
```

### Media

Semua media support: `Buffer`, `{ url: '...' }`, atau `{ stream: Stream }`.

```js
// Gambar
await sock.sendMessage(jid, {
  image: { url: './foto.jpg' },
  caption: 'Caption foto'
})

// Video
await sock.sendMessage(jid, {
  video: { url: './video.mp4' },
  caption: 'Caption video'
})

// Audio biasa
await sock.sendMessage(jid, {
  audio: { url: './audio.mp3' },
  mimetype: 'audio/mp4'
})

// Voice note (PTT)
await sock.sendMessage(jid, {
  audio: fs.readFileSync('./voice.ogg'),
  mimetype: 'audio/ogg; codecs=opus',
  ptt: true
})

// Sticker
await sock.sendMessage(jid, {
  sticker: fs.readFileSync('./sticker.webp')
})

// Dokumen
await sock.sendMessage(jid, {
  document: { url: './laporan.pdf' },
  mimetype: 'application/pdf',
  fileName: 'laporan.pdf'
})
```

### Link Preview

Install `link-preview-js` dulu, lalu kirim teks dengan URL biasa — preview auto-generate.

```bash
npm i link-preview-js
```

```js
await sock.sendMessage(jid, {
  text: 'Cek library ini: https://npmjs.com/package/n4lyx'
})
```

---

## Shorthand Methods ⚡

Biar nggak perlu susun object setiap kali, n4lyx punya shorthand methods langsung di `sock`.

### Gambar & Video

```js
// Gambar
await sock.sendImage(jid, buffer, 'Caption opsional')
await sock.sendImage(jid, { url: './foto.jpg' })

// Video
await sock.sendVideo(jid, buffer, 'Caption opsional')
```

### Audio

```js
await sock.sendAudio(jid, buffer)         // audio biasa
await sock.sendAudio(jid, buffer, true)   // voice note / PTT
await sock.sendAudioPTT(jid, buffer)      // alias PTT
await sock.sendVoiceNote(jid, buffer)     // alias voice note
```

### Dokumen

```js
await sock.sendDocument(jid, buffer, 'laporan.pdf', 'application/pdf', 'Ini file-nya')
```

### GIF & Video Note

```js
// GIF animasi
await sock.sendGIF(jid, gifBuffer, 'wkwk')

// Circular video note (kayak voice note tapi video)
await sock.sendPTV(jid, videoBuffer)
await sock.sendPTV(jid, videoBuffer, { quoted: m }) // dengan quote
```

### View Once

Media otomatis hilang setelah dilihat sekali.

```js
await sock.sendViewOnce(jid, { image: buffer })
await sock.sendViewOnce(jid, { video: buffer }, { quoted: m })
await sock.sendViewOnce(jid, { audio: buffer, mimetype: 'audio/mp4' })
```

### Sticker

```js
// Dari Buffer
await sock.sendStickerFromBuffer(jid, buffer)

// Dari URL langsung
await sock.sendStickerFromUrl(jid, 'https://example.com/sticker.webp')

// Dengan metadata pack
await sock.sendStickerWithMetadata(jid, buffer, {
  packName: 'Pack Gue',
  packPublisher: 'N4tzz',
  categories: ['😂']
})

// Kirim banyak sticker sekaligus (max 30, ada auto-delay)
await sock.sendStickerPack(jid, [buf1, buf2, buf3], 'Pack Gue', 'N4tzz')
```

### Album

Kumpulan foto/video yang bisa di-swipe (max 10 item, bisa mix image + video).

```js
await sock.sendAlbum(jid, [
  { image: buf1, caption: 'Foto 1' },
  { image: buf2, caption: 'Foto 2' },
  { video: buf3, caption: 'Video' }
])
```

### Poll

```js
// Pilih lebih dari satu
await sock.sendPoll(jid, 'Bahasa favorit?', ['JavaScript', 'Python', 'Go'])

// Pilih satu saja
await sock.sendPoll(jid, 'Setuju?', ['Ya', 'Tidak'], { selectableCount: 1 })
```

### Lokasi

```js
// Lokasi statis
await sock.sendLocation(jid, -7.797068, 110.370529, 'Yogyakarta')

// Live location
await sock.sendLiveLocation(jid, -7.79, 110.37, 10, 300)
// parameter: lat, lng, accuracy (meter), duration (detik)
```

### Kontak

```js
// Single
await sock.sendContact(jid, {
  fullName: 'Budi Santoso',
  phoneNumber: '+62812xxxxxxx',
  org: 'Acme Corp' // opsional
})

// Multiple sekaligus
await sock.sendContact(jid, [
  { fullName: 'Budi', phoneNumber: '+62812xxxxxxx' },
  { fullName: 'Sari', phoneNumber: '+62813xxxxxxx' }
])
```

### Event & Jadwal Call

```js
// WhatsApp Event
await sock.sendEvent(jid, {
  name: 'Rapat Mingguan',
  description: 'Sync tim setiap Senin',
  startTime: Date.now() + 3_600_000,   // 1 jam dari sekarang
  endTime: Date.now() + 7_200_000,     // 2 jam dari sekarang
  location: 'Google Meet',
  joinLink: 'https://meet.google.com/xxx'
})

// Jadwalkan panggilan
await sock.sendScheduledCall(jid, 'Catch-up session', Date.now() + 86_400_000)        // video call (default)
await sock.sendScheduledCall(jid, 'Voice call', Date.now() + 3_600_000, 2)            // voice call
```

### Reply & Mention

```js
// Reply cepat
await sock.sendReply(jid, 'Oke siap!', m)

// Reply dengan media
await sock.sendMediaReply(jid, { image: buffer, caption: 'ini' }, m)

// Reply + mention sekaligus
await sock.sendQuotedText(jid, 'Hayo @kamu', m, ['628xxx@s.whatsapp.net'])

// Teks + mention
await sock.sendTextWithMentions(jid, 'Halo @A dan @B', [jidA, jidB])

// Tag all shorthand
await sock.sendTagAll(jid, '📢 Pengumuman untuk semua')
await sock.sendTagAll(jid, '🔔 Khusus admin', 'admins')
await sock.sendTagAll(jid, '👋 Hei member', 'non_admins')

// Tag all + mention
await sock.sendMentionAll(jid, 'Hei semua!')
```

### Invite Group

Kirim invite sebagai card (bukan plain link).

```js
await sock.sendGroupInvite(jid, '120363xxx@g.us')
```

### Typing Indicator

```js
// Typing 3 detik lalu berhenti
await sock.sendTyping(jid)

// Recording 2 detik
await sock.sendTyping(jid, 2000, 'recording')

// Kirim pesan dengan typing dulu
await sock.sendWithTyping(jid, { text: 'Halo!' })
await sock.sendWithTyping(jid, { text: 'Halo!' }, {}, 2000) // typing 2 detik
```

### Broadcast & Multi-Message

```js
// Kirim ke banyak JID (auto deduplicate, ada delay antar kirim)
const results = await sock.broadcastMessage(
  ['628xxx@s.whatsapp.net', '628yyy@s.whatsapp.net'],
  { text: 'Pengumuman penting!' },
  { delayMs: 1000 }
)
// results: [{ jid, success, msg? }, ...]

// Broadcast ke semua group yang diikuti
await sock.broadcastToGroups([groupJid1, groupJid2], { text: 'Halo semua group!' })

// Kirim array pesan berurutan ke satu JID
await sock.sendMultipleMessages(jid, [
  { text: 'Pesan 1' },
  { text: 'Pesan 2' },
  { image: buffer, caption: 'Foto' }
], 800) // delay 800ms antar pesan
```

### Status / Story

```js
// Status pribadi
await sock.sendStatus({ text: 'Pagi semua! ☀️', backgroundColor: '#128C7E' })
await sock.sendStatus({ image: buffer, caption: 'Foto hari ini' })
await sock.sendStatus({ video: buffer })

// Batasi siapa yang bisa lihat
await sock.sendStatus({ text: 'Khusus kamu' }, ['628xxx@s.whatsapp.net'])
```

### Group Status V2 ⚡

Post story langsung di dalam group — muncul kayak story WhatsApp tapi di group.

```js
// Teks
await sock.groupStatusV2('120363xxx@g.us', {
  text: 'GM semua! 🌅',
  backgroundColor: '#25D366'
})

// Teks dengan font custom
await sock.groupStatusV2('120363xxx@g.us', {
  text: 'Selamat ulang tahun! 🎉',
  backgroundColor: '#FF6B6B',
  font: 1
})

// Gambar
await sock.groupStatusV2('120363xxx@g.us', {
  image: buffer,
  caption: 'Foto kegiatan hari ini'
})

// Video
await sock.groupStatusV2('120363xxx@g.us', {
  video: buffer,
  caption: 'Tonton ini!'
})

// Sticker
await sock.groupStatusV2('120363xxx@g.us', { sticker: buffer })
```

---

## Edit, Delete, React

```js
const sent = await sock.sendMessage(jid, { text: 'Ada typo nih' })

// Edit pesan
await sock.editMessage(jid, sent.key, 'Sudah diperbaiki')

// Hapus untuk semua
await sock.deleteMessage(jid, sent.key)

// Pin pesan
await sock.pinMessage(jid, m.key)              // 24 jam
await sock.pinMessage(jid, m.key, 604800)      // 7 hari
await sock.pinMessage(jid, m.key, 0)           // unpin

// Bookmark / keep
await sock.keepMessage(jid, m.key)             // keep
await sock.keepMessage(jid, m.key, false)      // unkeep

// Bintang / star
await sock.starMessage(jid, m.key, true)       // bintangin
await sock.unstarMessage(jid, m.key)           // hapus bintang

// React
await sock.reactMessage(jid, m.key, '❤️')
await sock.reactMessage(jid, m.key, '')        // hapus reaksi

// Forward
await sock.forwardMessage(jid, m)
await sock.forwardWithComment(jid, m, 'Check ini!')  // forward + komentar
```

---

## Chat Management

```js
// Archive / unarchive
await sock.archiveChat(jid, lastMsg)
await sock.unarchiveChat(jid, lastMsg)

// Pin / unpin chat
await sock.pinChat(jid)
await sock.unpinChat(jid)

// Mute / unmute
await sock.muteJid(jid)                          // mute 8 jam
await sock.muteJid(jid, 24 * 60 * 60 * 1000)    // mute 24 jam
await sock.unmuteJid(jid)

// Tandai baca / belum baca
await sock.markAsRead([m.key])
await sock.sendSeen(jid)                          // alias markAsRead
await sock.markAsUnread(jid, lastMsg)

// Hapus & bersihkan
await sock.deleteChat(jid)
await sock.clearChat(jid)

// Block / unblock
await sock.blockUser(jid)
await sock.unblockUser(jid)
await sock.fetchBlocklist()                       // ambil daftar yang diblokir
```

---

## Disappearing Messages

```js
// Aktifkan di chat
await sock.sendDisappearingToggle(jid, 86400)     // 24 jam
await sock.setGroupDisappearing(jid, 604800)      // 7 hari di group
await sock.setGroupDisappearing(jid, 0)           // matikan

// Kirim satu pesan sebagai ephemeral
await sock.sendDisappearingMessage(jid, { text: 'Pesan ini akan hilang' }, 86400)

// Set default disappearing mode
await sock.setDefaultDisappearing(86400)
```

---

## Groups

```js
// Buat group baru
const group = await sock.groupCreate('Nama Group', ['628xxx@s.whatsapp.net'])
console.log('Group ID:', group.gid)

// Tambah / hapus / promote / demote member
await sock.groupParticipantsUpdate(jid, ['628xxx@s.whatsapp.net'], 'add')
await sock.groupParticipantsUpdate(jid, ['628xxx@s.whatsapp.net'], 'remove')
await sock.groupParticipantsUpdate(jid, ['628xxx@s.whatsapp.net'], 'promote')
await sock.groupParticipantsUpdate(jid, ['628xxx@s.whatsapp.net'], 'demote')

// Bulk action (auto chunk per 5 + delay)
await sock.bulkGroupAction(jid, [jid1, jid2, jid3], 'remove')

// Update info group
await sock.groupUpdateSubject(jid, 'Nama Group Baru')
await sock.groupUpdateDescription(jid, 'Deskripsi baru')
await sock.updateGroupName(jid, 'Nama Group Baru')           // alias
await sock.updateGroupDescription(jid, 'Deskripsi baru')    // alias
await sock.updateGroupProfilePicture(jid, buffer)            // ganti foto group

// Setting group
await sock.groupSettingUpdate(jid, 'announcement')           // hanya admin yang bisa kirim
await sock.groupSettingUpdate(jid, 'not_announcement')       // semua bisa kirim
await sock.updateGroupSetting(jid, 'locked')                 // alias
await sock.updateGroupSetting(jid, 'unlocked')

// Invite link
const code = await sock.groupInviteCode(jid)
const link = await sock.getGroupInviteLink(jid)   // return URL lengkap
await sock.groupRevokeInvite(jid)                 // atau: revokeGroupInvite(jid)
await sock.groupAcceptInvite(code)                // join (tanpa URL prefix)
await sock.joinGroupViaLink('https://chat.whatsapp.com/...')  // join via URL

// Info & metadata
const meta = await sock.groupMetadata(jid)
const all  = await sock.fetchAllGroups()          // semua group yang diikuti

// Admin utilities
const admins  = await sock.getGroupAdmins(jid)
const isAdmin = await sock.isGroupAdmin(jid, '628xxx@s.whatsapp.net')
const members = await sock.getGroupParticipants(jid)
await sock.sendToAdminsOnly(jid, 'Pesan khusus admin')
await sock.sendAdminInvite(jid, targetJid)        // undang jadi admin

// Join approval
await sock.setGroupJoinApproval(jid, true)        // nyalakan approval
const requests = await sock.getGroupJoinRequests(jid)
await sock.approveGroupJoinRequest(jid, ['628xxx@s.whatsapp.net'])
await sock.rejectGroupJoinRequest(jid, ['628xxx@s.whatsapp.net'])

// Member add mode
await sock.setGroupMemberAddMode(jid, 'all_member_add')  // semua bisa add
await sock.setGroupMemberAddMode(jid, 'admin_add')       // hanya admin

// Leave
await sock.leaveGroup(jid)
```

---

## Interaktif: Buttons, List, Template ⚡

```js
// Pesan dengan tombol
await sock.sendButtonsMessage(jid, {
  text: 'Pilih salah satu:',
  buttons: [
    { buttonId: 'id1', buttonText: { displayText: 'Opsi A' }, type: 1 },
    { buttonId: 'id2', buttonText: { displayText: 'Opsi B' }, type: 1 }
  ],
  headerType: 1
})

// Gambar + tombol
await sock.sendImageWithButtons(jid, buffer, 'Caption', [
  { buttonId: 'confirm', buttonText: { displayText: '✅ Konfirmasi' }, type: 1 },
  { buttonId: 'cancel',  buttonText: { displayText: '❌ Batal' },     type: 1 }
])

// Video + tombol
await sock.sendVideoWithButtons(jid, videoBuffer, 'Tonton dulu', [
  { buttonId: 'share', buttonText: { displayText: '📤 Share' }, type: 1 }
])

// Dokumen + tombol
await sock.sendDocumentWithButtons(jid, pdfBuffer, 'laporan.pdf', 'application/pdf', 'Ini laporan nya', [
  { buttonId: 'download', buttonText: { displayText: '⬇️ Download' }, type: 1 }
])

// List / menu
await sock.sendListMessage(jid, {
  text: 'Pilih menu:',
  footer: 'n4lyx bot',
  title: 'Main Menu',
  buttonText: 'Buka Menu',
  sections: [
    {
      title: 'Kategori 1',
      rows: [
        { title: 'Info', rowId: 'info', description: 'Lihat informasi' },
        { title: 'Help', rowId: 'help', description: 'Bantuan' }
      ]
    }
  ]
})

// Template message
await sock.sendTemplateMessage(jid, {
  text: 'Hai! Ada yang bisa dibantu?',
  footer: 'n4lyx',
  templateButtons: [
    { index: 1, urlButton: { displayText: '🌐 Website', url: 'https://example.com' } },
    { index: 2, callButton: { displayText: '📞 Telepon', phoneNumber: '+62812xxxxxxx' } },
    { index: 3, quickReplyButton: { displayText: '💬 Chat', id: 'chat' } }
  ]
})
```

---

## Newsletter ⚡

```js
// Info channel / newsletter
const info = await sock.getNewsletterInfo(newsletterJid)

// Kirim pesan ke newsletter
await sock.sendNewsletterMessage(newsletterJid, { text: 'Update terbaru!' })
await sock.sendNewsletterMessage(newsletterJid, { image: buffer, caption: 'Foto' })

// Reaksi di newsletter
await sock.sendNewsletterReaction(newsletterJid, messageId, '🔥')
```

---

## Download Media

```js
const { downloadMediaMessage, getContentType } = require('n4lyx')
const { createWriteStream } = require('fs')

sock.ev.on('messages.upsert', async ({ messages: [m] }) => {
  if (!m.message) return
  const type = getContentType(m)

  if (type === 'imageMessage') {
    const stream = await downloadMediaMessage(m, 'stream', {}, {
      logger,
      reuploadRequest: sock.updateMediaMessage
    })
    stream.pipe(createWriteStream('./download.jpg'))
  }
})
```

Re-upload media yang expired (link kedaluwarsa):

```js
const refreshed = await sock.updateMediaMessage(msg)
```

---

## Poll — Dekripsi Vote

Poll dienkripsi by default. Dekripsi harus dilakukan di event `messages.update`.

```js
const { getAggregateVotesInPollMessage } = require('n4lyx')

sock.ev.on('messages.update', async (events) => {
  for (const { key, update } of events) {
    if (!update.pollUpdates) continue

    const creation = await getMessage(key)  // ambil dari DB/store kamu
    if (!creation) continue

    const result = getAggregateVotesInPollMessage({
      message: creation,
      pollUpdates: update.pollUpdates
    })

    console.log('Hasil vote:', result)
    // result: [{ name: 'JavaScript', voters: ['628xxx@s.whatsapp.net', ...] }, ...]
  }
})
```

---

## Presence

```js
// Kirim indikator presence
await sock.sendPresenceUpdate('composing', jid)   // lagi ngetik
await sock.sendPresenceUpdate('recording', jid)   // lagi rekam audio
await sock.sendPresenceUpdate('paused', jid)      // berhenti ngetik
await sock.sendPresenceUpdate('available', jid)   // online
await sock.sendPresenceUpdate('unavailable', jid) // offline

// Subscribe presence orang lain
await sock.presenceSubscribe(jid)
sock.ev.on('presence.update', ({ id, presences }) => {
  console.log(id, presences) // lihat siapa yang lagi online
})
```

---

## Query & Info

```js
// Cek apakah nomor terdaftar di WA
const info = await sock.isOnWhatsApp('628xxxxxxxxx')
// → { exists: true, jid: '628xxx@s.whatsapp.net' }

// Info lengkap kontak
const contact = await sock.getContactInfo(jid)

// Status teks (safe — return null kalau gagal)
const status = await sock.getUserStatus(jid)

// Foto profil (safe — return null kalau gagal)
const pic   = await sock.getProfilePicture(jid)        // low res
const picHD = await sock.getProfilePicture(jid, true)  // high res

// Business profile
const biz = await sock.getBusinessProfile(jid)

// Riwayat pesan (max 50 per call)
await sock.fetchMessageHistory(50, oldest.key, oldest.messageTimestamp)
// masuk via event: messaging.history-set
```

---

## Privacy

```js
// Update semua privacy settings
// nilai: 'all' | 'contacts' | 'contact_blacklist' | 'none'
await sock.updateLastSeenPrivacy('contacts')
await sock.updateProfilePicturePrivacy('contacts')
await sock.updateStatusPrivacy('contacts')
await sock.updateReadReceiptsPrivacy('all')
await sock.updateGroupsAddPrivacy('contacts')
await sock.updateOnlinePrivacy('all')              // atau 'match_last_seen'

// Default disappearing mode
await sock.updateDefaultDisappearingMode(86400)
```

---

## Profile

```js
await sock.updateProfileStatus('Sedang coding...')
await sock.updateProfileName('Nama Baru')
await sock.updateProfilePicture(jid, { url: './foto.jpg' })
await sock.removeProfilePicture(jid)
```

---

## Calls

```js
// Tolak incoming call
sock.ev.on('call', async ([call]) => {
  await sock.rejectCall(call.id, call.from)
})

// Auto-reject semua call (aktifkan sekali saat startup)
sock.rejectAllCalls()
```

---

## In-Memory Store

Untuk development / testing. **Jangan dipakai di production.**

```js
const { makeInMemoryStore } = require('n4lyx')

const store = makeInMemoryStore({})
store.readFromFile('./store.json')
setInterval(() => store.writeToFile('./store.json'), 10_000)

const sock = makeWASocket({})
store.bind(sock.ev)
```

---

## WebSocket Low-Level

```js
// Listen ke protokol WA secara langsung
sock.ws.on('CB:edge_routing', (node) => { })
sock.ws.on('CB:edge_routing,id:abcd', (node) => { })
```

Debug mode — log semua WA protocol frame:

```js
const P = require('pino')
const sock = makeWASocket({ logger: P({ level: 'debug' }) })
```

---

## JID Format

| Tipe | Format |
|---|---|
| User | `628XXXXXXXXX@s.whatsapp.net` |
| Group | `123456789-123456@g.us` |
| Broadcast list | `[timestamp]@broadcast` |
| Story / Status | `status@broadcast` |

---

## Utilities

| Fungsi | Kegunaan |
|---|---|
| `getContentType(msg)` | Ambil tipe konten dari sebuah pesan |
| `getDevice(msg)` | Info device pengirim pesan |
| `makeCacheableSignalKeyStore` | Percepat operasi auth key store |
| `downloadContentFromMessage` | Download raw content dari pesan |
| `fetchLatestN4lyxVersion` | Ambil versi terbaru n4lyx dari npm |
| `fetchLatestWaWebVersion` | Ambil versi terbaru WA Web |

---

## Optional Dependencies

Install sesuai kebutuhan — nggak wajib semua.

```bash
npm i jimp              # thumbnail generator (bisa juga pakai sharp)
npm i link-preview-js   # link preview otomatis di pesan teks
npm i qrcode-terminal   # render QR code di terminal
```

Konversi audio ke format yang kompatibel (butuh `ffmpeg` di sistem):

```bash
ffmpeg -i input.mp4 -avoid_negative_ts make_zero -ac 1 output.ogg
```

---

## Semua Fitur n4lyx

<details>
<summary><strong>Lihat semua method (klik untuk expand)</strong></summary>

### Pesan

| Method | Keterangan |
|---|---|
| `sendImage` | Kirim gambar |
| `sendVideo` | Kirim video |
| `sendAudio` | Kirim audio / PTT |
| `sendAudioPTT` | Alias PTT |
| `sendVoiceNote` | Alias voice note |
| `sendDocument` | Kirim dokumen |
| `sendGIF` | Kirim GIF animasi |
| `sendPTV` | Circular video note |
| `sendViewOnce` | View-once media |
| `sendSticker` / `sendStickerMessage` | Kirim sticker |
| `sendStickerFromBuffer` | Sticker dari Buffer |
| `sendStickerFromUrl` | Sticker dari URL |
| `sendStickerWithMetadata` | Sticker + pack info |
| `sendStickerPack` | Kirim banyak sticker |
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
| `tagAll` di `sendMessage` | Auto-mention all/admin/non-admin |
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

### Newsletter

| Method | Keterangan |
|---|---|
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
| `groupCreate` | Buat group |
| `groupParticipantsUpdate` | add/remove/promote/demote |
| `bulkGroupAction` | Bulk action member |
| `groupUpdateSubject` / `updateGroupName` | Ganti nama |
| `groupUpdateDescription` / `updateGroupDescription` | Ganti deskripsi |
| `updateGroupProfilePicture` | Ganti foto group |
| `updateGroupSetting` / `groupSettingUpdate` | Setting group |
| `getGroupInviteLink` / `groupInviteCode` | Invite link |
| `revokeGroupInvite` / `groupRevokeInvite` | Revoke link |
| `joinGroupViaLink` / `groupAcceptInvite` | Join group |
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
| `groupLeave` / `leaveGroup` | Leave group |
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

### Query & Info

| Method | Keterangan |
|---|---|
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