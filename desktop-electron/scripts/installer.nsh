; CrewSpace NSIS Modern Styling
; Included by electron-builder during NSIS script generation

; ── MUI Modern UI tweaks ──
!define MUI_HEADER_TRANSPARENT_TEXT
!define MUI_HEADER_TRANSPARENT_TEXT_SECONDARY

; Hide the default header text since we brand the header image
!define MUI_HEADERIMAGE_BITMAP_NOSTRETCH

; Welcome page: hide the built-in title/subtitle so our sidebar carries the branding
; (Keep the text — electron-builder generates welcome text, just style it cleanly)

; Finish page: no auto-close so user sees the completed setup
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_UNFINISHPAGE_NOAUTOCLOSE

; Abort warning with our product name
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "Are you sure you want to cancel the CrewSpace installation?"

; ── Colors ──
; Use the standard Windows look but with a slightly cleaner palette.
; NSIS MUI2 doesn’t support full dark mode without custom plugins,
; so we keep it native-light but with crisp images.

; ── Installer attributes ──
; Branding text in the window title area
BrandingText "CrewSpace ${VERSION}"

; ── Macros that electron-builder calls ──
!macro customInit
  ; Nothing extra needed here — images and colors are set above.
!macroend
