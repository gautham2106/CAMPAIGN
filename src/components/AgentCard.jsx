const PLATFORMS = ['whatsapp', 'facebook', 'instagram']

function normalizePhone(phone) {
  return phone ? phone.replace(/\D/g, '') : ''
}

// Plain WA link — used when no content is selected
function waLink(phone) {
  return `https://wa.me/${normalizePhone(phone)}`
}

// WA link with pre-filled content message
function waTemplateLink(phone, agent, content) {
  const digits = normalizePhone(phone)
  if (!digits) return null
  const lines = [
    `Hi ${agent.name}! 🙏`,
    ``,
    `Today's campaign content is ready to post:`,
    ``,
    `📋 *${content.title}*`,
    content.description ? content.description : null,
    content.media_link ? `🔗 ${content.media_link}` : null,
    ``,
    `Please post on:`,
    `✅ WhatsApp Status`,
    `✅ Facebook`,
    `✅ Instagram`,
    ``,
    `Thank you! 🙏`,
  ].filter(l => l !== null).join('\n')
  return `https://wa.me/${digits}?text=${encodeURIComponent(lines)}`
}

export default function AgentCard({ agent, logsByPlatform, onToggle, saving, content }) {
  const isCheckedForPlatform = (p) => logsByPlatform?.[p]?.is_checked === true
  const checkedCount = PLATFORMS.filter(isCheckedForPlatform).length
  const isDone = checkedCount === 3
  const hasPhone = !!agent.phone

  const waUrl = hasPhone
    ? (content ? waTemplateLink(agent.phone, agent, content) : waLink(agent.phone))
    : null

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
        <div className="grid grid-cols-4 gap-1.5">
          {/* WhatsApp — template if content is available, plain otherwise */}
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
              title={content ? 'Send content via WhatsApp' : 'Open WhatsApp'}
              className="relative flex flex-col items-center justify-center bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl py-2.5 text-xs font-semibold transition-colors gap-0.5"
            >
              <span className="text-base leading-none">💬</span>
              <span>WA</span>
              {content && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-white" title="Pre-filled message" />
              )}
            </a>
          )}

          {agent.fb_url && (
            <a href={agent.fb_url} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center justify-center bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl py-2.5 text-xs font-semibold transition-colors gap-0.5"
            >
              <span className="text-base leading-none">📘</span>
              <span>FB</span>
            </a>
          )}

          {agent.ig_url && (
            <a href={agent.ig_url} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center justify-center bg-gradient-to-br from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 text-white rounded-xl py-2.5 text-xs font-semibold transition-colors gap-0.5"
            >
              <span className="text-base leading-none">📸</span>
              <span>IG</span>
            </a>
          )}

          {hasPhone && (
            <a href={`tel:+${normalizePhone(agent.phone)}`}
              className="flex flex-col items-center justify-center bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white rounded-xl py-2.5 text-xs font-semibold transition-colors gap-0.5"
            >
              <span className="text-base leading-none">📞</span>
              <span>Call</span>
            </a>
          )}
        </div>

        {/* WA template hint */}
        {content && waUrl && (
          <p className="text-xs text-slate-400 -mt-1">
            💬 WA opens with pre-filled message for <span className="font-medium text-slate-500">{content.title}</span>
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
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                  />
                  <span className={`text-xs font-semibold ${checked ? 'text-indigo-700' : 'text-slate-400'}`}>
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
