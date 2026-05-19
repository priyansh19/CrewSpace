; Kill any running CrewSpace process silently instead of prompting the user
!macro customCheckAppRunning
  nsExec::ExecToLog 'taskkill /F /IM "CrewSpace.exe" /T'
!macroend
