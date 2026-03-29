# n4lyx

> WhatsApp Web API — multi-device, TypeScript-first, built different.

[![npm](https://img.shields.io/npm/v/n4lyx?color=black&labelColor=000)](https://npmjs.com/package/n4lyx)
[![license](https://img.shields.io/badge/license-MIT-black?labelColor=000)](LICENSE)
[![downloads](https://img.shields.io/npm/dm/n4lyx?color=black&labelColor=000)](https://npmjs.com/package/n4lyx)
[![node](https://img.shields.io/badge/node-%3E%3D20-black?labelColor=000)](package.json)

---

**n4lyx** is a WhatsApp Web API library built for real projects. Proper `@lid → @pn` resolution, full multi-device support, clean TypeScript API. Fast, minimal, no bloat. Ships with exclusive features like tag-all, group status v2, and native helper methods that upstream doesn't have.

> Not affiliated with WhatsApp Inc. Don't spam. Don't abuse. You're responsible for how you use this.

---

## Install

```bash
npm i n4lyx
```

```js
const { default: makeWASocket } = require('n4lyx')
// ESM
import makeWASocket from 'n4lyx'
```

---

## Quick Start

```js
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState
} = require('n4lyx')
const { Boom } = require('@hapi/boom')

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: ['Windows', 'Chrome', '1.0.0']
  })

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) connect()
    } else if (connection === 'open') {
      console.log('connected')
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message) continue
      await sock.sendMessage(msg.key.remoteJid!, { text: 'pong' })
    }
  })

  sock.ev.on('creds.update', saveCreds)
}

connect()
```

---

## Authentication

### QR Code

```js
const { default: makeWASocket, Browsers } = require('n4lyx')

const sock = makeWASocket({
  browser: Browsers.ubuntu('n4lyx'),
  printQRInTerminal: true
})
```

### Pairing Code

Phone number must include country code — no spaces, no symbols.

```js
const sock = makeWASocket({ printQRInTerminal: false })

if (!sock.authState.creds.registered) {
  const code = await sock.requestPairingCode('628XXXXXXXXX')
  console.log('Pairing code:', code)
}

// Custom pairing code (exactly 8 chars)
if (!sock.authState.creds.registered) {
  const code = await sock.requestPairingCode('628XXXXXXXXX', 'N4LYX001')
  console.log('Pairing code:', code)
}
```

### Persist Auth

```js
const { useMultiFileAuthState } = require('n4lyx')

const { state, saveCreds } = await useMultiFileAuthState('auth')
const sock = makeWASocket({ auth: state })
sock.ev.on('creds.update', saveCreds)
```

> For production, store credentials in a real database (PostgreSQL, MongoDB, Redis) — not on disk.

### Full History Sync

```js
const sock = makeWASocket({
  browser: Browsers.macOS('Desktop'),
  syncFullHistory: true
})
```

---

## Configuration

### Group Metadata Cache

Required for group-heavy bots. Cuts down repeated API calls significantly.

```js
const NodeCache = require('node-cache')
const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false })

const sock = makeWASocket({
  cachedGroupMetadata: async (jid) => groupCache.get(jid)
})

sock.ev.on('groups.update', async ([event]) => {
  groupCache.set(event.id, await sock.groupMetadata(event.id))
})

sock.ev.on('group-participants.update', async (event) => {
  groupCache.set(event.id, await sock.groupMetadata(event.id))
})
```

### Message Store

Needed for message retry and poll vote decryption.

```js
const sock = makeWASocket({
  getMessage: async (key) => await getMessageFromStore(key)
})
```

### Background Mode

Disable online status to receive push notifications while "offline".

```js
const sock = makeWASocket({ markOnlineOnConnect: false })
```

---

## In-Memory Store

n4lyx doesn't ship a default persistent store. A basic in-memory store is available for local dev and testing — not recommended for production.

```js
const { makeInMemoryStore } = require('n4lyx')

const store = makeInMemoryStore({})
store.readFromFile('./store.json')
setInterval(() => store.writeToFile('./store.json'), 10_000)

const sock = makeWASocket({})
store.bind(sock.ev)

sock.ev.on('chats.upsert', () => console.log(store.chats.all()))
sock.ev.on('contacts.upsert', () => console.log(Object.values(store.contacts)))
```

> Build your own store backed by a proper DB for anything in production.

---

## Sending Messages

```js
await sock.sendMessage(jid, content, options?)
```

### Text

```js
await sock.sendMessage(jid, { text: 'hello' })
```

### Reply / Quote

```js
await sock.sendMessage(jid, { text: 'hello' }, { quoted: message })
```

### Mention

```js
await sock.sendMessage(jid, {
  text: '@628XXXXXXXXX',
  mentions: ['628XXXXXXXXX@s.whatsapp.net']
})
```

### Tag All — n4lyx exclusive

Mention every member in a group. Automatically fetches participant list — no manual work.

```js
// Tag all members
await sock.sendMessage(jid, {
  text: '@everyone listen up',
  tagAll: true
})

// Tag admins only
await sock.sendMessage(jid, {
  text: 'admins only',
  tagAll: true,
  tagAllScope: 'admins'
})

// Tag non-admins only
await sock.sendMessage(jid, {
  text: 'members',
  tagAll: true,
  tagAllScope: 'non_admins'
})
```

`tagAllScope` options: `'all'` (default) | `'admins'` | `'non_admins'`

You can also get the jid list directly:

```js
const jids = await sock.groupTagAll(groupJid, 'all')
// returns: ['628XXX@s.whatsapp.net', ...]
```

### Media

All media supports `Buffer`, `{ url: '...' }`, or `{ stream: Stream }`.

```js
// Image
await sock.sendMessage(jid, { image: { url: './photo.png' }, caption: 'caption' })

// Video
await sock.sendMessage(jid, { video: { url: './video.mp4' }, caption: 'caption' })

// Audio
await sock.sendMessage(jid, { audio: { url: './audio.ogg' }, mimetype: 'audio/mp4' })

// Sticker
await sock.sendMessage(jid, { sticker: fs.readFileSync('./sticker.webp') })

// Document
await sock.sendMessage(jid, {
  document: { url: './file.pdf' },
  mimetype: 'application/pdf',
  fileName: 'file.pdf'
})
```

### Link Preview

Requires `link-preview-js`:

```bash
npm i link-preview-js
```

```js
await sock.sendMessage(jid, { text: 'check this out: https://npmjs.com/package/n4lyx' })
```

---

## Native Helper Methods — n4lyx exclusive

n4lyx ships clean shorthand methods directly on `sock` so you don't have to construct raw content objects every time.

### `sock.groupStatusV2(jid, content)`

Post a Group Status V2 inside a group (shows as a story/status visible to group members).

```js
// Text
await sock.groupStatusV2('120363xxx@g.us', { text: 'GM!', backgroundColor: '#25D366' })
await sock.groupStatusV2('120363xxx@g.us', { text: 'Hello', backgroundColor: '#FF6B6B', font: 1 })

// Image
await sock.groupStatusV2('120363xxx@g.us', { image: buffer, caption: 'lihat ini!' })

// Video
await sock.groupStatusV2('120363xxx@g.us', { video: buffer, caption: 'tonton ini' })

// Audio
await sock.groupStatusV2('120363xxx@g.us', { audio: buffer, mimetype: 'audio/mp4' })

// Sticker
await sock.groupStatusV2('120363xxx@g.us', { sticker: buffer })
```

### `sock.sendStatus(content, statusJidList?)`

Post a personal Story/Status to `status@broadcast`.

```js
// Text
await sock.sendStatus({ text: 'Selamat pagi!', backgroundColor: '#128C7E' })

// Image
await sock.sendStatus({ image: buffer, caption: 'foto hari ini' })

// Video
await sock.sendStatus({ video: buffer })

// Audio
await sock.sendStatus({ audio: buffer, mimetype: 'audio/mp4' })

// Restrict visibility to specific contacts
await sock.sendStatus({ text: 'hanya untuk kamu' }, ['628xxx@s.whatsapp.net'])
```

### `sock.sendViewOnce(jid, content, options?)`

Send a view-once media message.

```js
await sock.sendViewOnce(jid, { image: buffer })
await sock.sendViewOnce(jid, { video: buffer }, { quoted: m })
await sock.sendViewOnce(jid, { audio: buffer, mimetype: 'audio/mp4' })
```

### `sock.sendPTV(jid, video, options?)`

Send a PTV (circular video note).

```js
await sock.sendPTV(jid, videoBuffer)
await sock.sendPTV(jid, videoBuffer, { quoted: m })
```

### `sock.sendGIF(jid, video, caption?, options?)`

Send an animated GIF.

```js
await sock.sendGIF(jid, gifBuffer, 'wkwk')
await sock.sendGIF(jid, gifBuffer)
```

### `sock.sendAlbum(jid, items, options?)`

Send a swipeable media album (max 10 items, mix of images and videos).

```js
await sock.sendAlbum(jid, [
  { image: buf1, caption: 'Pertama' },
  { image: buf2 },
  { video: buf3, caption: 'Video' }
])
```

### `sock.sendPoll(jid, question, choices, cfg?)`

Send a poll message.

```js
// Multiple choice (default)
await sock.sendPoll(jid, 'Bahasa favorit?', ['JavaScript', 'Python', 'Go'])

// Single select
await sock.sendPoll(jid, 'Setuju?', ['Ya', 'Tidak'], { selectableCount: 1 })

// Community announcement group
await sock.sendPoll(jid, 'Vote', ['A', 'B'], { toAnnouncementGroup: true })
```

### `sock.sendEvent(jid, eventData, options?)`

Send a WhatsApp Event message.

```js
await sock.sendEvent(jid, {
  name: 'Rapat Tim',
  description: 'Sync mingguan',
  startTime: Date.now() + 3_600_000,   // ms timestamp
  endTime: Date.now() + 7_200_000,     // optional
  location: 'Zoom',                    // optional
  joinLink: 'https://zoom.us/j/xxx'    // optional
})
```

### `sock.sendScheduledCall(jid, title, time, callType?, options?)`

Send a scheduled call message.

```js
await sock.sendScheduledCall(jid, 'Catch-up', Date.now() + 86_400_000)          // video call (default)
await sock.sendScheduledCall(jid, 'Voice call', Date.now() + 3_600_000, 2)      // voice call
```

`callType`: `1` = video (default), `2` = voice

### `sock.pinMessage(jid, messageKey, duration?)`

Pin or unpin a message.

```js
await sock.pinMessage(jid, m.key)           // pin 24 jam (default)
await sock.pinMessage(jid, m.key, 604800)   // pin 7 hari
await sock.pinMessage(jid, m.key, 2592000)  // pin 30 hari
await sock.pinMessage(jid, m.key, 0)        // unpin
```

### `sock.keepMessage(jid, messageKey, keep?)`

Keep (bookmark) or unkeep a message.

```js
await sock.keepMessage(jid, m.key)          // keep
await sock.keepMessage(jid, m.key, false)   // unkeep
```

### `sock.editMessage(jid, messageKey, newText)`

Edit a sent message.

```js
await sock.editMessage(jid, m.key, 'teks yang sudah diperbaiki')
```

### `sock.deleteMessage(jid, messageKey)`

Delete a message for everyone.

```js
await sock.deleteMessage(jid, m.key)
```

### `sock.reactMessage(jid, messageKey, emoji)`

React or remove reaction from a message.

```js
await sock.reactMessage(jid, m.key, '❤️')
await sock.reactMessage(jid, m.key, '')    // remove reaction
```

### `sock.forwardMessage(jid, message, forceForward?, options?)`

Forward a message to another JID.

```js
await sock.forwardMessage(jid, m)
await sock.forwardMessage(jid, m, true)    // force mark as forwarded
```

### `sock.sendLocation(jid, latitude, longitude, name?, options?)`

Send a static location.

```js
await sock.sendLocation(jid, -7.797068, 110.370529, 'Yogyakarta')
await sock.sendLocation(jid, -6.2, 106.8)
```

### `sock.sendContact(jid, contacts, options?)`

Send a contact card. Accepts single object or array.

```js
// Single contact
await sock.sendContact(jid, { fullName: 'Budi', phoneNumber: '+62812xxxxxxx' })

// With organization
await sock.sendContact(jid, { fullName: 'Sari', phoneNumber: '+62813xxxxxxx', org: 'Acme Corp' })

// Multiple contacts
await sock.sendContact(jid, [
  { fullName: 'Budi', phoneNumber: '+62812xxxxxxx' },
  { fullName: 'Sari', phoneNumber: '+62813xxxxxxx' }
])

// Raw vCard (override auto-generate)
await sock.sendContact(jid, { fullName: 'Custom', vcard: 'BEGIN:VCARD\n...\nEND:VCARD' })
```

---

## Edit & Delete

```js
// Delete for everyone
const sent = await sock.sendMessage(jid, { text: 'oops' })
await sock.sendMessage(jid, { delete: sent.key })
// or shorthand:
await sock.deleteMessage(jid, sent.key)

// Edit message
await sock.sendMessage(jid, { text: 'corrected text', edit: sent.key })
// or shorthand:
await sock.editMessage(jid, sent.key, 'corrected text')
```

---

## Downloading Media

```js
import { downloadMediaMessage, getContentType } from 'n4lyx'
import { createWriteStream } from 'fs'

sock.ev.on('messages.upsert', async ({ messages: [m] }) => {
  if (!m.message) return
  if (getContentType(m) !== 'imageMessage') return

  const stream = await downloadMediaMessage(m, 'stream', {}, {
    logger,
    reuploadRequest: sock.updateMediaMessage
  })

  stream.pipe(createWriteStream('./download.jpeg'))
})
```

Re-upload expired media:

```js
await sock.updateMediaMessage(msg)
```

---

## Chat Modifications

> Wrong updates can log you out of all devices. Handle with care.

```js
const last = await getLastMessage(jid) // your implementation

// Archive
await sock.chatModify({ archive: true, lastMessages: [last] }, jid)

// Mute (ms) / unmute
await sock.chatModify({ mute: 8 * 60 * 60 * 1000 }, jid) // 8h
await sock.chatModify({ mute: null }, jid)

// Mark unread
await sock.chatModify({ markRead: false, lastMessages: [last] }, jid)

// Pin / unpin
await sock.chatModify({ pin: true }, jid)
await sock.chatModify({ pin: false }, jid)

// Delete chat
await sock.chatModify({
  delete: true,
  lastMessages: [{ key: last.key, messageTimestamp: last.messageTimestamp }]
}, jid)

// Star / unstar
await sock.chatModify({
  star: {
    messages: [{ id: 'MESSAGE_ID', fromMe: true }],
    star: true // false = unstar
  }
}, jid)
```

### Disappearing Messages

```js
// Enable (86400 = 24h | 604800 = 7d | 7776000 = 90d)
await sock.sendMessage(jid, { disappearingMessagesInChat: WA_DEFAULT_EPHEMERAL })

// Send as ephemeral
await sock.sendMessage(jid, { text: 'poof' }, { ephemeralExpiration: WA_DEFAULT_EPHEMERAL })

// Disable
await sock.sendMessage(jid, { disappearingMessagesInChat: false })
```

---

## Groups

```js
// Create
const group = await sock.groupCreate('Group Name', ['jid@s.whatsapp.net'])
console.log('Created:', group.gid)

// Add / remove / promote / demote
await sock.groupParticipantsUpdate(jid, ['jid@s.whatsapp.net'], 'add')
// 'add' | 'remove' | 'promote' | 'demote'

// Update name
await sock.groupUpdateSubject(jid, 'New Name')

// Update description
await sock.groupUpdateDescription(jid, 'New description')

// Settings
await sock.groupSettingUpdate(jid, 'announcement')     // admin-only send
await sock.groupSettingUpdate(jid, 'not_announcement') // everyone can send
await sock.groupSettingUpdate(jid, 'locked')           // admin-only settings
await sock.groupSettingUpdate(jid, 'unlocked')         // everyone can edit

// Leave
await sock.groupLeave(jid)

// Invite link
const code = await sock.groupInviteCode(jid)
// link: https://chat.whatsapp.com/${code}

// Revoke invite
await sock.groupRevokeInvite(jid)

// Join via code (without https://chat.whatsapp.com/)
await sock.groupAcceptInvite(code)

// Metadata (participants, name, desc...)
const meta = await sock.groupMetadata(jid)

// Ephemeral
await sock.groupToggleEphemeral(jid, 86400)

// Add mode
await sock.groupMemberAddMode(jid, 'all_member_add') // or 'admin_add'

// Join approval mode
await sock.groupJoinApprovalMode(jid, 'on') // or 'off'

// Join requests
const requests = await sock.groupRequestParticipantsList(jid)
await sock.groupRequestParticipantsUpdate(jid, ['jid@s.whatsapp.net'], 'approve') // or 'reject'

// All joined group metadata
const all = await sock.groupFetchAllParticipating()
```

---

## Presence

```js
// Mark messages as read
await sock.readMessages([key])

// Send presence
// 'available' | 'unavailable' | 'composing' | 'recording' | 'paused'
await sock.sendPresenceUpdate('composing', jid)

// Subscribe to contact presence
sock.ev.on('presence.update', console.log)
await sock.presenceSubscribe(jid)
```

---

## Querying

```js
// Check if number is on WhatsApp
const [result] = await sock.onWhatsApp(jid)
if (result.exists) console.log(result.jid)

// Status text
const status = await sock.fetchStatus(jid)

// Profile picture
const url = await sock.profilePictureUrl(jid)            // low res
const urlHD = await sock.profilePictureUrl(jid, 'image') // high res

// Business profile
const biz = await sock.getBusinessProfile(jid)
console.log(biz.description, biz.category)

// Message history (max 50 per call)
const oldest = await getOldestMessage(jid) // your implementation
await sock.fetchMessageHistory(50, oldest.key, oldest.messageTimestamp)
// messages arrive via messaging.history-set
```

---

## Privacy

```js
// Block / unblock
await sock.updateBlockStatus(jid, 'block')
await sock.updateBlockStatus(jid, 'unblock')

// Get settings
await sock.fetchPrivacySettings(true)

// Get blocklist
await sock.fetchBlocklist()

// Update settings
// 'all' | 'contacts' | 'contact_blacklist' | 'none'
await sock.updateLastSeenPrivacy('contacts')
await sock.updateProfilePicturePrivacy('contacts')
await sock.updateStatusPrivacy('contacts')
await sock.updateReadReceiptsPrivacy('all')
await sock.updateGroupsAddPrivacy('contacts')
await sock.updateOnlinePrivacy('all') // or 'match_last_seen'

// Default disappearing mode
await sock.updateDefaultDisappearingMode(86400)
```

---

## Profile

```js
await sock.updateProfileStatus('available')
await sock.updateProfileName('My Name')
await sock.updateProfilePicture(jid, { url: './avatar.jpeg' })
await sock.removeProfilePicture(jid)
```

---

## Broadcast & Stories

```js
// Raw (via sendMessage)
await sock.sendMessage(
  'status@broadcast',
  { image: { url: url }, caption: 'caption' },
  { statusJidList: ['jid@s.whatsapp.net'] }
)

// Shorthand
await sock.sendStatus({ image: buffer, caption: 'caption' })
await sock.sendStatus({ text: 'hello', backgroundColor: '#075E54' })

// Broadcast list info
const info = await sock.getBroadcastListInfo('1234@broadcast')
console.log(info.name, info.recipients)
```

---

## Calls

```js
sock.ev.on('call', async ([call]) => {
  await sock.rejectCall(call.id, call.from)
})
```

---

## Poll Decryption

Polls are encrypted by default. Decryption happens in `messages.update`.

```js
sock.ev.on('messages.update', async (events) => {
  for (const { key, update } of events) {
    if (!update.pollUpdates) continue

    const creation = await getMessage(key) // your implementation
    if (!creation) continue

    console.log(
      getAggregateVotesInPollMessage({
        message: creation,
        pollUpdates: update.pollUpdates
      })
    )
  }
})
```

---

## Low-Level: WebSocket Callbacks

```js
sock.ws.on('CB:edge_routing', (node) => { })
sock.ws.on('CB:edge_routing,id:abcd', (node) => { })
sock.ws.on('CB:edge_routing,id:abcd,routing_info', (node) => { })
```

Debug mode — logs every WA protocol frame:

```js
const sock = makeWASocket({ logger: P({ level: 'debug' }) })
```

---

## JID Format

| Type      | Format                         |
|-----------|-------------------------------|
| User      | `628XXXXXXXXX@s.whatsapp.net` |
| Group     | `123456789-123456@g.us`       |
| Broadcast | `[timestamp]@broadcast`       |
| Story     | `status@broadcast`            |

---

## Utilities

| Function                      | Description                          |
|-------------------------------|--------------------------------------|
| `getContentType(msg)`         | Returns content type of a message    |
| `getDevice(msg)`              | Returns sender's device info         |
| `makeCacheableSignalKeyStore` | Speeds up auth key store operations  |
| `downloadContentFromMessage`  | Downloads raw content from a message |
| `fetchLatestN4lyxVersion`     | Fetches latest n4lyx version from npm |
| `fetchLatestWaWebVersion`     | Fetches latest WA Web version        |

---

## n4lyx Exclusive Features

| Feature | Description |
|---|---|
| `tagAll` in `sendMessage` | Auto-mention all/admins/non-admins in a group |
| `sock.groupTagAll(jid, scope)` | Get list of participant jids by scope |
| `sock.groupStatusV2(jid, content)` | Post group status/story (text/image/video/audio/sticker) |
| `sock.sendStatus(content, jidList?)` | Post personal story to status@broadcast |
| `sock.sendViewOnce(jid, content)` | View-once media shorthand |
| `sock.sendPTV(jid, video)` | Circular video note shorthand |
| `sock.sendGIF(jid, video, caption?)` | GIF animasi shorthand |
| `sock.sendAlbum(jid, items)` | Swipeable media album (max 10) |
| `sock.sendPoll(jid, question, choices)` | Poll message shorthand |
| `sock.sendEvent(jid, eventData)` | WhatsApp Event message |
| `sock.sendScheduledCall(jid, title, time)` | Scheduled call message |
| `sock.pinMessage(jid, key, duration?)` | Pin/unpin message shorthand |
| `sock.keepMessage(jid, key, keep?)` | Keep/unkeep message shorthand |
| `sock.editMessage(jid, key, newText)` | Edit message shorthand |
| `sock.deleteMessage(jid, key)` | Delete for everyone shorthand |
| `sock.reactMessage(jid, key, emoji)` | React/unreact shorthand |
| `sock.forwardMessage(jid, msg, force?)` | Forward message shorthand |
| `sock.sendLocation(jid, lat, lng, name?)` | Location message shorthand |
| `sock.sendContact(jid, contacts)` | Contact card shorthand (auto-vCard) |

---

## Optional Dependencies

```bash
npm i jimp              # or sharp — thumbnail generation
npm i link-preview-js   # link previews in text messages
npm i qrcode-terminal   # QR rendering in terminal
```

Video thumbnails require `ffmpeg` on your system.

Audio conversion:

```bash
ffmpeg -i input.mp4 -avoid_negative_ts make_zero -ac 1 output.ogg
```

---

## License

MIT — see [LICENSE](LICENSE).

---

<sub>n4lyx — built by N4tzz.</sub>