const PLATFORMS = ['whatsapp', 'facebook', 'instagram']

// Normalize phone: strip non-digits, prepend 91 if 10-digit Indian number
function normalizePhone(phone) {
  if (!phone) return ''
  let digits = phone.replace(/\D/g, '')
  if (digits.length === 10) digits = '91' + digits
  return digits
}

// Plain WA link — to check if agent has posted status
function waCheckLink(phone) {
  const digits = normalizePhone(phone)
  if (!digits) return null
  return `https://wa.me/${digits}`
}

// WA link with pre-filled Tamil reminder message
function waRemindLink(phone, agent, content) {
  const digits = normalizePhone(phone)
  if (!digits) return null
  const lines = [
    `வணக்கம் ${agent.name}! 🙏`,
    ``,
    `இன்றைய தேர்தல் பிரச்சார உள்ளடக்கம் தயாராக உள்ளது:`,
    ``,
    `📋 *${content.title}*`,
    content.description ? content.description : null,
    content.media_link ? `🔗 ${content.media_link}` : null,
    ``,
    `தயவுசெய்து கீழ்க்கண்ட தளங்களில் பதிவிடவும்:`,
    `✅ WhatsApp Status`,
    `✅ Facebook`,
    `✅ Instagram`,
    ``,
    `நன்றி! 🙏`,
    `- DMK நாமக்கல் கிழக்கு IT Wing`,
  ].filter(l => l !== null).join('\n')
  return `https://wa.me/${digits}?text=${encodeURIComponent(lines)}`
}

// Returns true = valid https link, false = invalid/wrong format, null = not set
function isValidLink(url) {
  if (!url || !url.trim()) return null
  return /^(https?:\/\/|www\.).+\..+/.test(url.trim())
}

export default function AgentCard({ agent, logsByPlatform, onToggle, saving, content }) {
  const isCheckedForPlatform = (p) => logsByPlatform?.[p]?.is_checked === true
  const checkedCount = PLATFORMS.filter(isCheckedForPlatform).length
  const isDone = checkedCount === 3
  const hasPhone = !!agent.phone

  const checkUrl = hasPhone ? waCheckLink(agent.phone) : null
  const remindUrl = (hasPhone && content) ? waRemindLink(agent.phone, agent, content) : null

  const fbValid = isValidLink(agent.fb_url)
  const igValid = isValidLink(agent.ig_url)

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
      isDone ? 'border-emerald-200' : checkedCount > 0 ? 'border-amber-200' : 'border-slate-200'
    }`}>
      {/* Status bar at top */}
      <div className={`h-1 w-full ${isDone ? 'bg-emerald-400' : checkedCount > 0 ? 'bg-amber-400' : 'bg-slate-100'}`} />

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              {agent.booth_number != null && (
                <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md border border-indigo-100">
                  Booth #{agent.booth_number}
                </span>
              )}
              {agent.gender && (
                <span className="text-xs text-slate-400 capitalize">{agent.gender}</span>
              )}
            </div>
            <p className="font-semibold text-slate-900 truncate">{agent.name}</p>
            {agent.area && <p className="text-xs text-slate-400 mt-0.5 truncate">{agent.area}</p>}
          </div>
          <span className={`shrink-0 ml-2 text-xs font-bold px-2 py-1 rounded-full ${
            isDone
              ? 'bg-emerald-100 text-emerald-700'
              : checkedCount > 0
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-500'
          }`}>
            {isDone ? '✓ Done' : `${checkedCount}/3`}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-1.5">
          {/* WA Check — plain link to see if agent posted status */}
          {checkUrl && (
            <a href={checkUrl} target="_blank" rel="noopener noreferrer"
              title="Open WhatsApp to check if posted"
              className="flex flex-col items-center justify-center bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl py-2 px-3 text-xs font-semibold transition-colors gap-0.5 min-w-[52px]"
            >
              <span className="text-base leading-none">💬</span>
              <span>Check</span>
            </a>
          )}

          {agent.fb_url && (
            <a href={fbValid ? agent.fb_url : undefined}
              target="_blank" rel="noopener noreferrer"
              title={fbValid ? 'Open Facebook profile' : 'Invalid link — not a proper URL'}
              className={`relative flex flex-col items-center justify-center text-white rounded-xl py-2 px-3 text-xs font-semibold transition-colors gap-0.5 min-w-[52px] ${
                fbValid ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-400 cursor-not-allowed'
              }`}
              onClick={fbValid ? undefined : e => e.preventDefault()}
            >
              {fbValid === false && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-orange-400 rounded-full border border-white" title="Invalid URL" />
              )}
              <span className="text-base leading-none">📘</span>
              <span>FB</span>
            </a>
          )}

          {agent.ig_url && (
            <a href={igValid ? agent.ig_url : undefined}
              target="_blank" rel="noopener noreferrer"
              title={igValid ? 'Open Instagram profile' : 'Invalid link — not a proper URL'}
              className={`relative flex flex-col items-center justify-center text-white rounded-xl py-2 px-3 text-xs font-semibold transition-colors gap-0.5 min-w-[52px] ${
                igValid
                  ? 'bg-gradient-to-br from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500'
                  : 'bg-gradient-to-br from-pink-300 to-orange-300 cursor-not-allowed'
              }`}
              onClick={igValid ? undefined : e => e.preventDefault()}
            >
              {igValid === false && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-orange-400 rounded-full border border-white" title="Invalid URL" />
              )}
              <span className="text-base leading-none">📸</span>
              <span>IG</span>
            </a>
          )}

          {/* WA Remind — pre-filled Tamil reminder (only if content selected) */}
          {remindUrl && (
            <a href={remindUrl} target="_blank" rel="noopener noreferrer"
              title="Send Tamil reminder to post content"
              className="flex flex-col items-center justify-center bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-xl py-2 px-3 text-xs font-semibold transition-colors gap-0.5 min-w-[52px]"
            >
              <span className="text-base leading-none">🔔</span>
              <span>Remind</span>
            </a>
          )}

          {hasPhone && (
            <a href={`tel:+${normalizePhone(agent.phone)}`}
              className="flex flex-col items-center justify-center bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white rounded-xl py-2 px-3 text-xs font-semibold transition-colors gap-0.5 min-w-[52px]"
            >
              <span className="text-base leading-none">📞</span>
              <span>Call</span>
            </a>
          )}
        </div>

        {/* Legend / invalid link warning */}
        {(fbValid === false || igValid === false) && (
          <p className="text-xs text-orange-600 -mt-1">
            ● Invalid link detected — must start with https:// or www.
          </p>
        )}
        {content && checkUrl && (fbValid !== false && igValid !== false) && (
          <p className="text-xs text-slate-400 -mt-1">
            💬 <span className="text-slate-500">Check</span> = view their WA status &nbsp;·&nbsp;
            🔔 <span className="text-red-500">Remind</span> = send Tamil reminder for <span className="font-medium text-slate-500">{content.title}</span>
          </p>
        )}

        {/* Compliance checkboxes */}
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">Posted on:</p>
          <div className="flex gap-4">
            {PLATFORMS.map(platform => {
              const checked = isCheckedForPlatform(platform)
              return (
                <label key={platform}
                  className={`flex items-center gap-1.5 cursor-pointer select-none ${saving ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={saving}
                    onChange={() => onToggle(agent.id, platform, checked)}
                    className="w-4 h-4 rounded accent-red-600 cursor-pointer"
                  />
                  <span className={`text-xs font-semibold ${checked ? 'text-red-700' : 'text-slate-400'}`}>
                    {platform === 'whatsapp' ? 'WA' : platform === 'facebook' ? 'FB' : 'IG'}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
