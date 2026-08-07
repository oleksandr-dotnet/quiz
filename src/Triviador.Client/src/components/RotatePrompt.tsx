import { useTranslation } from 'react-i18next'

// Portrait-only lock for phone-sized viewports: a browser tab has no real API to force screen
// orientation (that's only available to an installed PWA via manifest.json's own "orientation"
// key, see public/manifest.json), so the enforcement here is a blocking overlay instead - CSS-only
// (App.css's landscape-phone media query), rendered unconditionally so it also covers Landing/Lobby,
// not just an in-progress game. Mounted once at the app root rather than inside App()'s several
// early-return branches, which would otherwise each need their own copy.
export function RotatePrompt() {
  const { t } = useTranslation()
  return (
    <div className="rotate-prompt-overlay" role="alert" aria-live="assertive">
      <div className="rotate-prompt-card">
        <span className="rotate-prompt-glyph" aria-hidden="true">
          &#8635;
        </span>
        <p className="rotate-prompt-title">{t('rotatePrompt.title')}</p>
        <p className="rotate-prompt-body">{t('rotatePrompt.body')}</p>
      </div>
    </div>
  )
}
