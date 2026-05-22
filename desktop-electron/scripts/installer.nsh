; Kill any running CrewSpace processes (main + Electron helpers) silently
; instead of prompting the user.  All of them can hold file locks.
!macro customCheckAppRunning
  nsExec::ExecToLog 'taskkill /F /IM "CrewSpace.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "CrewSpace Helper.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "CrewSpace Helper (Renderer).exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "CrewSpace Helper (GPU).exe" /T'
!macroend
