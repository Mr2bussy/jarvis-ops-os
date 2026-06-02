; JARVIS Operations OS — NSIS custom installer script
; Called by electron-builder during Windows installer creation

!macro customInstall
  ; Register JARVIS in Windows registry for quick access
  WriteRegStr HKCU "Software\JARVIS" "InstallPath" "$INSTDIR"
  WriteRegStr HKCU "Software\JARVIS" "Version" "${VERSION}"
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\JARVIS"
!macroend
