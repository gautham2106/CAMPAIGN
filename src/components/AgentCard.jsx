const PLATFORMS = ['whatsapp', 'facebook', 'instagram']

const PLATFORM_META = {
  whatsapp: { label: 'WhatsApp', color: 'bg-green-500 hover:bg-green-600', icon: '💬' },
  facebook: { label: 'Facebook', color: 'bg-blue-600 hover:bg-blue-700', icon: '📘' },
  instagram: { label: 'Instagram', color: 'bg-pink-500 hover:bg-pink-600', icon: '📸' },
}

function getWhatsAppUrl(phone) {
  // Normalize phone: strip non-digits, ensure 91 prefix
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}`
}

export default function AgentCard({ agent, logsByPlatform, onToggle, saving }) {
  const isCheckedForPlatform = (platform) =>
    logsByPlatform?.[platform]?.is_checked === true

  const checkedCount = PLATFORMS.filter(isCheckedForPlatform).length

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            {agent.booth_number != null && (
              <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                Booth #{agent.booth_number}
              </span>
            )}
            {agent.gender && (
              <span className="text-xs text-gray-400 capitalize">{agent.gender}</span>
            )}
          </div>
          <p className="font-semibold text-gray-900 mt-0.5">{agent.name}</p>
          {agent.area && <p className="text-xs text-gray-500">{agent.area}</p>}
        </div>
        <div className={`text-xs font-bold px-2 py-1 rounded-full ${
          checkedCount === 3
            ? 'bg-green-100 text-green-700'
            : checkedCount > 0
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-gray-100 text-gray-500'
        }`}>
          {checkedCount}/3
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-4 gap-2">
        {agent.phone && (
          <a
            href={getWhatsAppUrl(agent.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded-lg py-2 text-xs font-medium transition-colors gap-0.5"
          >
            <span className="text-base">💬</span>
            <span>WA</span>
          </a>
        )}
        {agent.fb_url && (
          <a
            href={agent.fb_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-xs font-medium transition-colors gap-0.5"
          >
            <span className="text-base">📘</span>
            <span>FB</span>
          </a>
        )}
        {agent.ig_url && (
          <a
            href={agent.ig_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center bg-gradient-to-br from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 text-white rounded-lg py-2 text-xs font-medium transition-colors gap-0.5"
          >
            <span className="text-base">📸</span>
            <span>IG</span>
          </a>
        )}
        {agent.phone && (
          <a
            href={`tel:+${agent.phone.replace(/\D/g, '')}`}
            className="flex flex-col items-center justify-center bg-gray-600 hover:bg-gray-700 text-white rounded-lg py-2 text-xs font-medium transition-colors gap-0.5"
          >
            <span className="text-base">📞</span>
            <span>Call</span>
          </a>
        )}
      </div>

      {/* Compliance checkboxes */}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500 mb-2 font-medium">Content posted on:</p>
        <div className="flex gap-4">
          {PLATFORMS.map((platform) => {
            const checked = isCheckedForPlatform(platform)
            return (
              <label
                key={platform}
                className={`flex items-center gap-1.5 cursor-pointer select-none ${saving ? 'opacity-50' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={saving}
                  onChange={() => onToggle(agent.id, platform, checked)}
                  className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                />
                <span className={`text-xs font-medium capitalize ${checked ? 'text-indigo-700' : 'text-gray-500'}`}>
                  {platform === 'whatsapp' ? 'WA' : platform === 'facebook' ? 'FB' : 'IG'}
                </span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
