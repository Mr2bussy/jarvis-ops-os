' ─────────────────────────────────────────────────────────────────────────────
'  JARVIS Operations OS — silent launcher
'
'  Runs JARVIS-Launch.bat with the console window hidden, so the desktop
'  shortcut opens the app rather than a black terminal that must stay open.
'  The batch file remains directly runnable when build output is wanted.
' ─────────────────────────────────────────────────────────────────────────────

Dim shell, fso, here
Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)

' 0 = hidden window, False = do not wait for the process to finish
shell.CurrentDirectory = here
shell.Run """" & here & "\JARVIS-Launch.bat""", 0, False
