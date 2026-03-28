# n4lyx

> WhatsApp Web API — multi-device, TypeScript-first, built different.

[![npm](https://img.shields.io/npm/v/@n4tzz/n4lyx?color=black&labelColor=000)](https://npmjs.com/package/@n4tzz/n4lyx)
[![license](https://img.shields.io/badge/license-MIT-black?labelColor=000)](LICENSE)
[![downloads](https://img.shields.io/npm/dm/@n4tzz/n4lyx?color=black&labelColor=000)](https://npmjs.com/package/@n4tzz/n4lyx)
[![node](https://img.shields.io/badge/node-%3E%3D20-black?labelColor=000)](package.json)

---

**n4lyx** is a WhatsApp Web API library built for real projects. Proper `@lid → @pn` resolution, full multi-device support, clean TypeScript API. Fast, minimal, no bloat. Ships with exclusive features like tag-all and group status v2 that upstream doesn't have.

> Not affiliated with WhatsApp Inc. Don't spam. Don't abuse. You're responsible for how you use this.

---

## Install

```bash
npm i @n4tzz/n4lyx
```

```js
const { default: makeWASocket } = require('@n4tzz/n4lyx')
// ESM
import makeWASocket from '@n4tzz/n4lyx'
```

---

## Quick Start

```js
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState
} = require('@n4tzz/n4lyx')
const { Boom } = require('@hapi/boom')

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: ['n4lyx', 'Desktop', '1.0.0']
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
const { default: makeWASocket, Browsers } = require('@n4tzz/n4lyx')

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
const { useMultiFileAuthState } = require('@n4tzz/n4lyx')

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
const { makeInMemoryStore } = require('@n4tzz/n4lyx')

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

### Forward

```js
await sock.sendMessage(jid, { forward: msg })
```

### Location

```js
await sock.sendMessage(jid, {
  location: { degreesLatitude: -6.2, degreesLongitude: 106.8 }
})
```

### Contact

```js
const vcard = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  'FN:John Doe',
  'TEL;type=CELL;waid=628XXXXXXXXX:+62 8XX-XXXX-XXXX',
  'END:VCARD'
].join('\n')

await sock.sendMessage(jid, {
  contacts: { displayName: 'John', contacts: [{ vcard }] }
})
```

### Reaction

```js
await sock.sendMessage(jid, {
  react: { text: '🔥', key: message.key }
})
// Remove: text: ''
```

### Poll

```js
await sock.sendMessage(jid, {
  poll: {
    name: 'Pick one',
    values: ['Option A', 'Option B'],
    selectableCount: 1
  }
})
```

### Pin Message

```js
await sock.sendMessage(jid, {
  pin: {
    type: 1,     // 0 = unpin
    time: 86400, // 86400 = 24h | 604800 = 7d | 2592000 = 30d
    key: message.key
  }
})
```

### Media

All media supports `Buffer`, `{ url: '...' }`, or `{ stream: Stream }`.

```js
// Image
await sock.sendMessage(jid, {
  image: { url: './photo.png' },
  caption: 'caption'
})

// Video
await sock.sendMessage(jid, {
  video: { url: './video.mp4' },
  caption: 'caption',
  ptv: false // true = video note (circle)
})

// Audio
// Convert: ffmpeg -i input.mp4 -avoid_negative_ts make_zero -ac 1 output.ogg
await sock.sendMessage(jid, {
  audio: { url: './audio.ogg' },
  mimetype: 'audio/mp4'
})

// GIF (must be MP4 + gifPlayback flag)
await sock.sendMessage(jid, {
  video: fs.readFileSync('./animation.mp4'),
  gifPlayback: true
})

// View once (works on image, video, audio)
await sock.sendMessage(jid, {
  image: { url: './photo.png' },
  viewOnce: true
})
```

### Link Preview

Requires `link-preview-js`:

```bash
npm i link-preview-js
```

```js
await sock.sendMessage(jid, {
  text: 'check this out: https://npmjs.com/package/@n4tzz/n4lyx'
})
```

---

## Edit & Delete

```js
// Delete for everyone
const sent = await sock.sendMessage(jid, { text: 'oops' })
await sock.sendMessage(jid, { delete: sent.key })

// Edit message
await sock.sendMessage(jid, {
  text: 'corrected text',
  edit: sent.key
})
```

---

## Downloading Media

```js
import { downloadMediaMessage, getContentType } from '@n4tzz/n4lyx'
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

// Delete message (self only)
await sock.chatModify({
  clear: { messages: [{ id: 'MESSAGE_ID', fromMe: true, timestamp: '...' }] }
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

### Group Status V2 — n4lyx exclusive

Extended group status with full metadata control.

```js
// Set group status v2
await sock.groupSetStatusV2(jid, {
  duration: 86400,       // seconds (default: 86400 = 24h)
  allowReply: true,      // allow members to reply (default: true)
  allowReaction: true,   // allow reactions (default: true)
  visibility: 'all'      // 'all' | 'admin' (default: 'all')
})

// Get current group status v2 settings
const settings = await sock.groupGetStatusV2(jid)
console.log(settings)
// { duration: 86400, allowReply: true, allowReaction: true, visibility: 'all' }

// Send message as group status v2
await sock.sendMessage(jid, {
  text: 'group announcement',
  groupStatusV2: {
    duration: 604800,     // 7 days
    allowReply: false,
    allowReaction: true,
    visibility: 'all'
  }
})
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
await sock.sendMessage(
  'status@broadcast',
  { image: { url: url }, caption: 'caption' },
  {
    backgroundColor: '#000',
    font: 0,
    statusJidList: ['jid@s.whatsapp.net'],
    broadcast: true
  }
)

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
| `groupTagAll(jid, scope)` | Get list of participant jids by scope |
| `groupSetStatusV2(jid, opts)` | Set group status v2 with full metadata |
| `groupGetStatusV2(jid)` | Get current group status v2 settings |
| `N4lyxMeta` in proto | Internal message metadata (version, session, timestamp) |
| `GroupStatusV2Message` in proto | Extended group status message type |
| `TagAllMessage` in proto | Tag-all message type with scope support |

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