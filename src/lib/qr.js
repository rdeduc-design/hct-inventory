import QRCode from 'qrcode'

const BASE_URL = `${window.location.origin}${import.meta.env.BASE_URL}`

export async function generateItemQR(item, roomCode) {
  const url = `${BASE_URL}#/item/${item.id}`
  return QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#0E1E40', light: '#ffffff' } })
}

export async function generateRoomQR(roomCode) {
  const url = `${BASE_URL}#/room/${roomCode}`
  return QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#0E1E40', light: '#ffffff' } })
}

export function generateAssetTag(roomCode, sequence) {
  const roomPart = roomCode.toUpperCase().replace('-', '').slice(0, 6)
  const seq = String(sequence).padStart(4, '0')
  return `HCT-${roomPart}-${seq}`
}

export function printLabel(item, roomName, qrDataUrl) {
  const win = window.open('', '_blank', 'width=400,height=300')
  win.document.write(`
    <!DOCTYPE html><html><head>
    <title>Label — ${item.asset_tag || item.id}</title>
    <style>
      body { font-family: 'DM Sans', Arial, sans-serif; padding: 16px; display: flex; gap: 12px; align-items: flex-start; }
      .qr img { width: 80px; height: 80px; }
      .info h2 { font-size: 13px; font-weight: 600; margin: 0 0 4px; }
      .info p { font-size: 11px; color: #555; margin: 2px 0; }
      .tag { font-size: 10px; font-weight: 700; font-family: monospace; background: #0E1E40; color: #2ABFBF; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px; }
    </style></head><body>
    <div class="qr"><img src="${qrDataUrl}" /></div>
    <div class="info">
      <h2>${item.name}</h2>
      <p>${roomName}</p>
      <p>${item.category} · ${item.status}</p>
      <div class="tag">${item.asset_tag || 'No Tag'}</div>
    </div>
    </body></html>
  `)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 500)
}
