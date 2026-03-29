<div align="center">

<br/>

```
███╗   ██╗ ██╗  ██╗ ██╗      ██╗   ██╗ ██╗  ██╗
████╗  ██║ ██║  ██║ ██║      ╚██╗ ██╔╝ ╚██╗██╔╝
██╔██╗ ██║ ███████║ ██║       ╚████╔╝   ╚███╔╝ 
██║╚██╗██║ ╚════██║ ██║        ╚██╔╝    ██╔██╗ 
██║ ╚████║      ██║ ███████╗    ██║    ██╔╝ ██╗
╚═╝  ╚═══╝      ╚═╝ ╚══════╝    ╚═╝    ╚═╝  ╚═╝
```

**WhatsApp Web API. Multi-device. No bloat.**

[![npm](https://img.shields.io/npm/v/n4lyx?style=flat-square&color=000&labelColor=111&label=npm)](https://npmjs.com/package/n4lyx)
[![downloads](https://img.shields.io/npm/dm/n4lyx?style=flat-square&color=000&labelColor=111)](https://npmjs.com/package/n4lyx)
[![license](https://img.shields.io/badge/license-MIT-000?style=flat-square&labelColor=111)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-000?style=flat-square&labelColor=111)](package.json)

</div>

---

## What is this

n4lyx adalah WhatsApp Web API library untuk Node.js. Multi-device, proper `@lid → @pn` resolution, dan punya fitur eksklusif yang nggak ada di library lain — tag all, group status v2, shorthand methods bawaan.

> Bukan afiliasi dengan WhatsApp Inc. Jangan spam. Jangan abuse. Kamu yang tanggung jawab.

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

```js
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('n4lyx')
const { Boom } = require('@hapi/boom')

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  })

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) start()
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message) return
    await sock.sendMessage(msg.key.remoteJid, { text: 'pong' })
  })
}

start()
```

---

## Auth

### QR Code

```js
const sock = makeWASocket({ printQRInTerminal: true })
```

### Pairing Code

```js
const sock = makeWASocket({ printQRInTerminal: false })

if (!sock.authState.creds.registered) {
  const code = await sock.requestPairingCode('628XXXXXXXXX')
  console.log('Code:', code)
}
```

Custom pairing code (tepat 8 karakter):

```js
const code = await sock.requestPairingCode('628XXXXXXXXX', 'N4LYX001')
```

### Simpan Session

```js
const { state, saveCreds } = await useMultiFileAuthState('auth')
const sock = makeWASocket({ auth: state })
sock.ev.on('creds.update', saveCreds)
```

> Untuk production, simpan credentials ke database (PostgreSQL, MongoDB, Redis) — bukan ke disk.

---

## Config

### Cache Group Metadata

Wajib kalau bot kamu banyak handle group. Ngurangin API call berulang.

```js
const NodeCache = require('node-cache')
const groupCache = new NodeCache({ stdTTL: 300, useClones: false })

const sock = makeWASocket({
  cachedGroupMetadata: async (jid) => groupCache.get(jid)
})

sock.ev.on('groups.update', async ([e]) => {
  groupCache.set(e.id, await sock.groupMetadata(e.id))
})

sock.ev.on('group-participants.update', async (e) => {
  groupCache.set(e.id, await sock.groupMetadata(e.id))
})
```

### Message Store

Dibutuhkan untuk message retry dan dekripsi poll vote.

```js
const sock = makeWASocket({
  getMessage: async (key) => await getMessageFromDB(key)
})
```

### Background Mode

Terima pesan tanpa kelihatan online.

```js
const sock = makeWASocket({ markOnlineOnConnect: false })
```

### Full History Sync

```js
const sock = makeWASocket({
  browser: ['Mac', 'Desktop', '1.0'],
  syncFullHistory: true
})
```

---

## In-Memory Store

n4lyx tidak ship store default. Ada basic in-memory store untuk dev/testing — jangan dipakai production.

```js
const { makeInMemoryStore } = require('n4lyx')

const store = makeInMemoryStore({})
store.readFromFile('./store.json')
setInterval(() => store.writeToFile('./store.json'), 10_000)

const sock = makeWASocket({})
store.bind(sock.ev)
```

---

## Kirim Pesan

```js
await sock.sendMessage(jid, content, options?)
```

### Teks

```js
await sock.sendMessage(jid, { text: 'halo' })
```

### Reply / Quote

```js
await sock.sendMessage(jid, { text: 'halo' }, { quoted: message })
```

### Mention

```js
await sock.sendMessage(jid, {
  text: '@628XXXXXXXXX',
  mentions: ['628XXXXXXXXX@s.whatsapp.net']
})
```

### Tag All ⚡ n4lyx exclusive

Auto-mention semua member group. Fetch participant list otomatis.

```js
// Tag semua member
await sock.sendMessage(jid, {
  text: '@everyone dengerin dulu',
  tagAll: true
})

// Tag admin aja
await sock.sendMessage(jid, {
  text: 'khusus admin',
  tagAll: true,
  tagAllScope: 'admins'
})

// Tag non-admin aja
await sock.sendMessage(jid, {
  text: 'khusus member',
  tagAll: true,
  tagAllScope: 'non_admins'
})
```

`tagAllScope`: `'all'` (default) · `'admins'` · `'non_admins'`

Atau ambil list JID-nya langsung:

```js
const jids = await sock.groupTagAll(groupJid, 'all')
// → ['628XXX@s.whatsapp.net', ...]
```

### Media

Support `Buffer`, `{ url: '...' }`, atau `{ stream: Stream }`.

```js
// Gambar
await sock.sendMessage(jid, { image: { url: './foto.png' }, caption: 'caption' })

// Video
await sock.sendMessage(jid, { video: { url: './video.mp4' }, caption: 'caption' })

// Audio
await sock.sendMessage(jid, { audio: { url: './audio.ogg' }, mimetype: 'audio/mp4' })

// Sticker
await sock.sendMessage(jid, { sticker: fs.readFileSync('./sticker.webp') })

// Dokumen
await sock.sendMessage(jid, {
  document: { url: './file.pdf' },
  mimetype: 'application/pdf',
  fileName: 'file.pdf'
})
```

### Link Preview

Install dulu:

```bash
npm i link-preview-js
```

```js
await sock.sendMessage(jid, { text: 'cek ini: https://npmjs.com/package/n4lyx' })
```

---

## Helper Methods ⚡ n4lyx exclusive

Shorthand methods langsung di `sock` — nggak perlu susun object content manual.

---

### `sock.sendImage(jid, image, caption?, options?)`

```js
await sock.sendImage(jid, buffer, 'ini caption')
await sock.sendImage(jid, { url: './foto.jpg' })
```

---

### `sock.sendVideo(jid, video, caption?, options?)`

```js
await sock.sendVideo(jid, buffer, 'ini video')
```

---

### `sock.sendAudio(jid, audio, isPtt?, options?)`

```js
await sock.sendAudio(jid, buffer)           // audio biasa
await sock.sendAudio(jid, buffer, true)     // voice note / PTT
```

---

### `sock.sendDocument(jid, document, fileName, mimetype?, caption?, options?)`

```js
await sock.sendDocument(jid, buffer, 'laporan.pdf', 'application/pdf', 'ini file nya')
```

---

### `sock.sendGIF(jid, video, caption?, options?)`

```js
await sock.sendGIF(jid, gifBuffer, 'wkwk')
await sock.sendGIF(jid, gifBuffer)
```

---

### `sock.sendPTV(jid, video, options?)`

Circular video note (kayak voice note tapi video).

```js
await sock.sendPTV(jid, videoBuffer)
await sock.sendPTV(jid, videoBuffer, { quoted: m })
```

---

### `sock.sendViewOnce(jid, content, options?)`

View-once — media hilang setelah dilihat sekali.

```js
await sock.sendViewOnce(jid, { image: buffer })
await sock.sendViewOnce(jid, { video: buffer }, { quoted: m })
await sock.sendViewOnce(jid, { audio: buffer, mimetype: 'audio/mp4' })
```

---

### `sock.sendSticker(jid, sticker, options?)` / `sock.sendStickerFromUrl(jid, url, options?)`

```js
await sock.sendMessage(jid, { sticker: buffer })
await sock.sendStickerFromUrl(jid, 'https://example.com/sticker.webp')
```

---

### `sock.sendStickerWithMetadata(jid, sticker, metadata?, options?)`

Kirim sticker dengan pack name, publisher, kategori.

```js
await sock.sendStickerWithMetadata(jid, buffer, {
  packName: 'Pack Gue',
  packPublisher: 'N4tzz',
  categories: ['😂']
})
```

---

### `sock.sendStickerPack(jid, stickers[], packName, packPublisher, options?)`

Kirim banyak sticker sekaligus (max 30, auto delay).

```js
await sock.sendStickerPack(jid, [buf1, buf2, buf3], 'Pack Gue', 'N4tzz')
```

---

### `sock.sendAlbum(jid, items[], options?)`

Album foto/video yang bisa di-swipe (max 10 item, mix image + video).

```js
await sock.sendAlbum(jid, [
  { image: buf1, caption: 'Foto 1' },
  { image: buf2 },
  { video: buf3, caption: 'Video' }
])
```

---

### `sock.sendPoll(jid, question, choices[], cfg?)`

```js
// Multiple choice
await sock.sendPoll(jid, 'Bahasa favorit?', ['JavaScript', 'Python', 'Go'])

// Single select
await sock.sendPoll(jid, 'Setuju?', ['Ya', 'Tidak'], { selectableCount: 1 })

// Community announcement group
await sock.sendPoll(jid, 'Vote', ['A', 'B'], { toAnnouncementGroup: true })
```

---

### `sock.sendLocation(jid, latitude, longitude, name?, options?)`

```js
await sock.sendLocation(jid, -7.797068, 110.370529, 'Yogyakarta')
await sock.sendLocation(jid, -6.2, 106.8)
```

---

### `sock.sendLiveLocation(jid, lat, lng, accuracy?, duration?, options?)`

```js
await sock.sendLiveLocation(jid, -7.79, 110.37, 10, 300)
```

---

### `sock.sendContact(jid, contacts, options?)`

```js
// Single
await sock.sendContact(jid, { fullName: 'Budi', phoneNumber: '+62812xxxxxxx' })

// Dengan org
await sock.sendContact(jid, { fullName: 'Sari', phoneNumber: '+62813xxxxxxx', org: 'Acme Corp' })

// Multiple
await sock.sendContact(jid, [
  { fullName: 'Budi', phoneNumber: '+62812xxxxxxx' },
  { fullName: 'Sari', phoneNumber: '+62813xxxxxxx' }
])

// Raw vCard manual
await sock.sendContact(jid, { fullName: 'Custom', vcard: 'BEGIN:VCARD\n...\nEND:VCARD' })
```

---

### `sock.sendEvent(jid, eventData, options?)`

```js
await sock.sendEvent(jid, {
  name: 'Rapat Tim',
  description: 'Sync mingguan',
  startTime: Date.now() + 3_600_000,    // ms timestamp, wajib
  endTime: Date.now() + 7_200_000,      // opsional
  location: 'Zoom',                     // opsional
  joinLink: 'https://zoom.us/j/xxx'     // opsional
})
```

---

### `sock.sendScheduledCall(jid, title, time, callType?, options?)`

```js
await sock.sendScheduledCall(jid, 'Catch-up', Date.now() + 86_400_000)       // video (default)
await sock.sendScheduledCall(jid, 'Voice call', Date.now() + 3_600_000, 2)   // voice
```

`callType`: `1` = video · `2` = voice

---

### `sock.sendGroupInvite(jid, groupJid, options?)`

Kirim invite group sebagai pesan card (bukan plain link).

```js
await sock.sendGroupInvite(jid, '120363xxx@g.us')
```

---

### `sock.groupStatusV2(jid, content)`

Post status/story di dalam group (muncul kayak story).

```js
// Teks
await sock.groupStatusV2('120363xxx@g.us', { text: 'GM!', backgroundColor: '#25D366' })
await sock.groupStatusV2('120363xxx@g.us', { text: 'Halo', backgroundColor: '#FF6B6B', font: 1 })

// Gambar
await sock.groupStatusV2('120363xxx@g.us', { image: buffer, caption: 'lihat ini!' })

// Video
await sock.groupStatusV2('120363xxx@g.us', { video: buffer, caption: 'tonton ini' })

// Audio
await sock.groupStatusV2('120363xxx@g.us', { audio: buffer, mimetype: 'audio/mp4' })

// Sticker
await sock.groupStatusV2('120363xxx@g.us', { sticker: buffer })
```

---

### `sock.sendStatus(content, statusJidList?)`

Post story/status pribadi ke `status@broadcast`.

```js
await sock.sendStatus({ text: 'Pagi!', backgroundColor: '#128C7E' })
await sock.sendStatus({ image: buffer, caption: 'foto hari ini' })
await sock.sendStatus({ video: buffer })

// Batasi siapa yang lihat
await sock.sendStatus({ text: 'cuma buat kamu' }, ['628xxx@s.whatsapp.net'])
```

---

### `sock.sendReply(jid, text, quotedMessage, options?)`

```js
await sock.sendReply(jid, 'oke siap', m)
```

---

### `sock.sendMediaReply(jid, content, quotedMessage, options?)`

```js
await sock.sendMediaReply(jid, { image: buffer, caption: 'ini' }, m)
```

---

### `sock.sendQuotedText(jid, text, quotedMessage, mentions?, options?)`

Reply + mention sekaligus.

```js
await sock.sendQuotedText(jid, 'hayo @kamu', m, ['628xxx@s.whatsapp.net'])
```

---

### `sock.sendTagAll(jid, text, scope?, options?)`

Shorthand tag all + kirim pesan sekaligus.

```js
await sock.sendTagAll(jid, 'dengerin dulu ya')
await sock.sendTagAll(jid, 'hei admin', 'admins')
await sock.sendTagAll(jid, 'hei member', 'non_admins')
```

---

### `sock.sendTextWithMentions(jid, text, mentionJids[], options?)`

```js
await sock.sendTextWithMentions(jid, 'halo @A dan @B', [jidA, jidB])
```

---

### `sock.sendTyping(jid, duration?, type?)`

Kirim indikator typing, auto berhenti setelah durasi.

```js
await sock.sendTyping(jid)                         // composing 3 detik
await sock.sendTyping(jid, 2000, 'recording')      // recording 2 detik
```

---

### `sock.sendWithTyping(jid, content, options?, typingMs?)`

Kirim pesan dengan typing indicator dulu sebelumnya.

```js
await sock.sendWithTyping(jid, { text: 'halo' })
await sock.sendWithTyping(jid, { text: 'halo' }, {}, 2000)
```

---

### `sock.broadcastMessage(jids[], content, options?)`

Kirim pesan yang sama ke banyak JID. Auto delay antar kirim (default 500ms).

```js
const results = await sock.broadcastMessage(
  ['628xxx@s.whatsapp.net', '628yyy@s.whatsapp.net'],
  { text: 'pengumuman penting' },
  { delayMs: 1000 }
)

// results: [{ jid, success, msg? }, ...]
```

---

### `sock.sendMultipleMessages(jid, contents[], delayMs?)`

Kirim array pesan berurutan ke satu JID.

```js
await sock.sendMultipleMessages(jid, [
  { text: 'pesan 1' },
  { text: 'pesan 2' },
  { image: buffer }
], 800)
```

---

## Edit & Delete

```js
const sent = await sock.sendMessage(jid, { text: 'typo' })

// Edit
await sock.editMessage(jid, sent.key, 'sudah diperbaiki')
// atau raw:
await sock.sendMessage(jid, { text: 'sudah diperbaiki', edit: sent.key })

// Delete for everyone
await sock.deleteMessage(jid, sent.key)
// atau raw:
await sock.sendMessage(jid, { delete: sent.key })
```

---

## Pin, Keep, React

```js
// Pin pesan
await sock.pinMessage(jid, m.key)            // 24 jam (default)
await sock.pinMessage(jid, m.key, 604800)    // 7 hari
await sock.pinMessage(jid, m.key, 2592000)   // 30 hari
await sock.pinMessage(jid, m.key, 0)         // unpin

// Keep / bookmark
await sock.keepMessage(jid, m.key)           // keep
await sock.keepMessage(jid, m.key, false)    // unkeep

// React
await sock.reactMessage(jid, m.key, '❤️')
await sock.reactMessage(jid, m.key, '')      // hapus reaksi

// Forward
await sock.forwardMessage(jid, m)
await sock.forwardMessage(jid, m, true)      // paksa mark as forwarded
```

---

## Chat Management

```js
const lastMsg = await getLastMessage(jid)   // implementasi sendiri

// Archive / unarchive
await sock.archiveChat(jid, lastMsg)
await sock.unarchiveChat(jid, lastMsg)

// Pin / unpin chat
await sock.pinChat(jid)
await sock.unpinChat(jid)

// Mute / unmute
await sock.muteJid(jid)                      // mute 8 jam (default)
await sock.muteJid(jid, 24 * 60 * 60 * 1000) // mute 24 jam
await sock.unmuteJid(jid)

// Tandai baca / belum baca
await sock.markAsRead([m.key])
await sock.markAsUnread(jid, lastMsg)

// Block / unblock
await sock.blockUser(jid)
await sock.unblockUser(jid)
```

Raw via `chatModify`:

```js
// Hapus chat
await sock.chatModify({
  delete: true,
  lastMessages: [{ key: lastMsg.key, messageTimestamp: lastMsg.messageTimestamp }]
}, jid)

// Star pesan
await sock.chatModify({
  star: { messages: [{ id: 'MSG_ID', fromMe: true }], star: true }
}, jid)
```

---

## Disappearing Messages

```js
// Aktifkan di chat/group
await sock.sendMessage(jid, { disappearingMessagesInChat: WA_DEFAULT_EPHEMERAL })

// Set di group langsung
await sock.setGroupDisappearing(jid, 86400)   // 24 jam
await sock.setGroupDisappearing(jid, 604800)  // 7 hari
await sock.setGroupDisappearing(jid, 7776000) // 90 hari

// Kirim sebagai ephemeral
await sock.sendDisappearingMessage(jid, { text: 'poof' }, 86400)

// Matikan
await sock.sendMessage(jid, { disappearingMessagesInChat: false })
```

---

## Download Media

```js
const { downloadMediaMessage, getContentType } = require('n4lyx')
const { createWriteStream } = require('fs')

sock.ev.on('messages.upsert', async ({ messages: [m] }) => {
  if (!m.message) return
  if (getContentType(m) !== 'imageMessage') return

  const stream = await downloadMediaMessage(m, 'stream', {}, {
    logger,
    reuploadRequest: sock.updateMediaMessage
  })

  stream.pipe(createWriteStream('./download.jpg'))
})
```

Re-upload media yang expired:

```js
await sock.updateMediaMessage(msg)
```

---

## Groups

```js
// Buat group
const group = await sock.groupCreate('Nama Group', ['628xxx@s.whatsapp.net'])
console.log('Created:', group.gid)

// Add / remove / promote / demote
await sock.groupParticipantsUpdate(jid, ['628xxx@s.whatsapp.net'], 'add')
// 'add' | 'remove' | 'promote' | 'demote'

// Bulk action (auto chunk per 5, ada delay)
await sock.bulkGroupAction(jid, [jid1, jid2, jid3, ...], 'remove')

// Update nama / deskripsi
await sock.groupUpdateSubject(jid, 'Nama Baru')
await sock.groupUpdateDescription(jid, 'Deskripsi baru')

// Setting
await sock.groupSettingUpdate(jid, 'announcement')     // hanya admin yang bisa kirim
await sock.groupSettingUpdate(jid, 'not_announcement') // semua bisa kirim
await sock.groupSettingUpdate(jid, 'locked')           // hanya admin yang bisa edit info
await sock.groupSettingUpdate(jid, 'unlocked')         // semua bisa edit info

// Invite link
const code = await sock.groupInviteCode(jid)           // https://chat.whatsapp.com/${code}
await sock.groupRevokeInvite(jid)
await sock.groupAcceptInvite(code)                     // join via code (tanpa URL prefix)

// Metadata
const meta = await sock.groupMetadata(jid)

// Admin utilities
const admins = await sock.getGroupAdmins(jid)
const isAdmin = await sock.isGroupAdmin(jid, '628xxx@s.whatsapp.net')
await sock.sendToAdminsOnly(jid, 'khusus admin')

// Join approval
await sock.groupJoinApprovalMode(jid, 'on')
const requests = await sock.groupRequestParticipantsList(jid)
await sock.groupRequestParticipantsUpdate(jid, ['628xxx@s.whatsapp.net'], 'approve')

// Add mode
await sock.groupMemberAddMode(jid, 'all_member_add')  // semua bisa add
await sock.groupMemberAddMode(jid, 'admin_add')        // hanya admin

// Leave
await sock.groupLeave(jid)

// Semua group yang diikuti
const all = await sock.groupFetchAllParticipating()
```

---

## Presence

```js
// Mark as read
await sock.readMessages([m.key])

// Kirim presence
await sock.sendPresenceUpdate('composing', jid)   // lagi ngetik
await sock.sendPresenceUpdate('recording', jid)   // lagi rekam
await sock.sendPresenceUpdate('paused', jid)       // berhenti
await sock.sendPresenceUpdate('available', jid)    // online
await sock.sendPresenceUpdate('unavailable', jid)  // offline

// Subscribe presence kontak
sock.ev.on('presence.update', console.log)
await sock.presenceSubscribe(jid)
```

---

## Query

```js
// Cek nomor di WA
const [result] = await sock.onWhatsApp('628xxx@s.whatsapp.net')
if (result.exists) console.log(result.jid)

// Shorthand — input bisa nomor atau JID
const info = await sock.isOnWhatsApp('628xxxxxxxxx')
// → { exists: true, jid: '628xxx@s.whatsapp.net' }

// Status teks
const status = await sock.fetchStatus(jid)

// Foto profil (safe, return null kalau gagal)
const pic = await sock.getProfilePicture(jid)            // low res
const picHD = await sock.getProfilePicture(jid, true)    // high res

// Business profile
const biz = await sock.getBusinessProfile(jid)

// Message history (max 50 per call)
const oldest = await getOldestMessage(jid)
await sock.fetchMessageHistory(50, oldest.key, oldest.messageTimestamp)
// masuk via event: messaging.history-set
```

---

## Privacy

```js
// Block / unblock
await sock.updateBlockStatus(jid, 'block')
await sock.updateBlockStatus(jid, 'unblock')

// Ambil blocklist
await sock.fetchBlocklist()

// Update privacy settings
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
await sock.updateProfileStatus('lagi sibuk')
await sock.updateProfileName('Nama Baru')
await sock.updateProfilePicture(jid, { url: './foto.jpg' })
await sock.removeProfilePicture(jid)
```

---

## Calls

```js
// Reject incoming call
sock.ev.on('call', async ([call]) => {
  await sock.rejectCall(call.id, call.from)
})

// Auto-reject semua call
sock.rejectAllCalls()
```

---

## Poll Decryption

Poll dienkripsi by default. Dekripsinya di event `messages.update`.

```js
const { getAggregateVotesInPollMessage } = require('n4lyx')

sock.ev.on('messages.update', async (events) => {
  for (const { key, update } of events) {
    if (!update.pollUpdates) continue

    const creation = await getMessage(key)  // implementasi sendiri
    if (!creation) continue

    const result = getAggregateVotesInPollMessage({
      message: creation,
      pollUpdates: update.pollUpdates
    })

    console.log(result)
  }
})
```

---

## WebSocket Low-Level

```js
sock.ws.on('CB:edge_routing', (node) => { })
sock.ws.on('CB:edge_routing,id:abcd', (node) => { })
```

Debug mode (log semua WA protocol frame):

```js
const sock = makeWASocket({ logger: P({ level: 'debug' }) })
```

---

## JID Format

| Tipe | Format |
|---|---|
| User | `628XXXXXXXXX@s.whatsapp.net` |
| Group | `123456789-123456@g.us` |
| Broadcast list | `[timestamp]@broadcast` |
| Story/Status | `status@broadcast` |

---

## Utilities

| Fungsi | Kegunaan |
|---|---|
| `getContentType(msg)` | Ambil tipe konten dari sebuah pesan |
| `getDevice(msg)` | Info device pengirim |
| `makeCacheableSignalKeyStore` | Percepat operasi auth key store |
| `downloadContentFromMessage` | Download raw content dari pesan |
| `fetchLatestN4lyxVersion` | Ambil versi terbaru n4lyx dari npm |
| `fetchLatestWaWebVersion` | Ambil versi terbaru WA Web |

---

## Semua Fitur Eksklusif n4lyx

| Method | Keterangan |
|---|---|
| `tagAll` di `sendMessage` | Auto-mention semua/admin/non-admin di group |
| `sock.groupTagAll(jid, scope)` | Ambil list JID participant by scope |
| `sock.sendTagAll(jid, text, scope?)` | Tag + kirim pesan sekaligus |
| `sock.groupStatusV2(jid, content)` | Post story di group (text/image/video/audio/sticker) |
| `sock.sendStatus(content, jidList?)` | Post story pribadi ke status@broadcast |
| `sock.sendImage(jid, image, caption?)` | Shorthand kirim gambar |
| `sock.sendVideo(jid, video, caption?)` | Shorthand kirim video |
| `sock.sendAudio(jid, audio, isPtt?)` | Shorthand kirim audio / PTT |
| `sock.sendDocument(jid, doc, fileName, ...)` | Shorthand kirim dokumen |
| `sock.sendViewOnce(jid, content)` | View-once media |
| `sock.sendPTV(jid, video)` | Circular video note |
| `sock.sendGIF(jid, video, caption?)` | Kirim GIF animasi |
| `sock.sendAlbum(jid, items)` | Album swipeable (max 10) |
| `sock.sendStickerFromUrl(jid, url)` | Sticker dari URL langsung |
| `sock.sendStickerWithMetadata(jid, sticker, meta)` | Sticker + pack info |
| `sock.sendStickerPack(jid, stickers, packName, ...)` | Kirim banyak sticker (max 30) |
| `sock.sendPoll(jid, question, choices)` | Buat poll |
| `sock.sendEvent(jid, eventData)` | Kirim WhatsApp Event |
| `sock.sendScheduledCall(jid, title, time)` | Jadwalkan panggilan |
| `sock.sendLocation(jid, lat, lng, name?)` | Kirim lokasi statis |
| `sock.sendLiveLocation(jid, lat, lng, ...)` | Kirim live location |
| `sock.sendContact(jid, contacts)` | Kartu kontak (auto-vCard) |
| `sock.sendGroupInvite(jid, groupJid)` | Kirim invite group sebagai card |
| `sock.sendReply(jid, text, quotedMsg)` | Reply teks cepat |
| `sock.sendMediaReply(jid, content, quotedMsg)` | Reply dengan media |
| `sock.sendQuotedText(jid, text, quotedMsg, mentions?)` | Reply + mention |
| `sock.sendTextWithMentions(jid, text, jids[])` | Teks + mention array |
| `sock.sendTyping(jid, duration?, type?)` | Typing indicator + auto stop |
| `sock.sendWithTyping(jid, content, ...)` | Kirim pesan pakai typing dulu |
| `sock.broadcastMessage(jids[], content)` | Kirim ke banyak JID |
| `sock.sendMultipleMessages(jid, contents[])` | Kirim array pesan ke 1 JID |
| `sock.pinMessage(jid, key, duration?)` | Pin/unpin pesan |
| `sock.keepMessage(jid, key, keep?)` | Bookmark / unbookmark pesan |
| `sock.editMessage(jid, key, newText)` | Edit pesan yang sudah terkirim |
| `sock.deleteMessage(jid, key)` | Hapus pesan untuk semua |
| `sock.reactMessage(jid, key, emoji)` | React / hapus reaksi |
| `sock.forwardMessage(jid, msg, force?)` | Forward pesan |
| `sock.muteJid(jid, duration?)` | Mute chat |
| `sock.unmuteJid(jid)` | Unmute chat |
| `sock.archiveChat(jid, lastMsg)` | Arsip chat |
| `sock.unarchiveChat(jid, lastMsg)` | Buka arsip |
| `sock.pinChat(jid)` | Pin chat |
| `sock.unpinChat(jid)` | Unpin chat |
| `sock.markAsRead(keys[])` | Tandai baca |
| `sock.markAsUnread(jid, lastMsg)` | Tandai belum baca |
| `sock.blockUser(jid)` | Blokir user |
| `sock.unblockUser(jid)` | Buka blokir |
| `sock.getProfilePicture(jid, highRes?)` | Foto profil (safe, null kalau gagal) |
| `sock.getUserStatus(jid)` | Status teks user (safe, null kalau gagal) |
| `sock.isOnWhatsApp(jidOrNumber)` | Cek nomor — input fleksibel |
| `sock.sendDisappearingMessage(jid, content, exp)` | Kirim pesan ephemeral |
| `sock.setGroupDisappearing(jid, expiration)` | Set disappearing di group |
| `sock.getGroupAdmins(jid)` | Daftar admin group |
| `sock.isGroupAdmin(jid, userJid)` | Cek apakah user adalah admin |
| `sock.sendToAdminsOnly(jid, content)` | Kirim + mention admin saja |
| `sock.bulkGroupAction(jid, participants[], action)` | add/remove/promote/demote banyak user |
| `sock.rejectAllCalls()` | Auto-reject semua incoming call |

---

## Optional Dependencies

```bash
npm i jimp              # atau sharp — untuk generate thumbnail
npm i link-preview-js   # link preview di pesan teks
npm i qrcode-terminal   # render QR code di terminal
```

Thumbnail video butuh `ffmpeg` di sistem:

```bash
ffmpeg -i input.mp4 -avoid_negative_ts make_zero -ac 1 output.ogg
```

---

## License

MIT — lihat [LICENSE](LICENSE).

---

<div align="center">
<sub>n4lyx — built by N4tzzOfficial | Channel: https://whatsapp.com/channel/0029VbAVYIx5PO0z9LqImz3U</sub>
</div>