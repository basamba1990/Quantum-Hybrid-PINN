from pathlib import Path
import re

def norm(p):
 s=p.read_text(errors='replace').splitlines()
 out=[]
 for line in s:
  if re.match(r'^(Date|Time|Host|PID|ExecutionTime)', line): continue
  line=re.sub(r'ClockTime = \d+ s','ClockTime = X s',line)
  line=re.sub(r'^Case\s+:.*$', 'Case   : CASE_PATH', line)
  out.append(line.strip())
 return out
a=norm(Path('/home/ubuntu/Quantum-Hybrid-PINN/pilot_case/PILOT-PCCV-TRANSIENT-001/openfoam_reconstructed/run/solver.log'))
b=norm(Path('/tmp/PCCV-TRANSIENT-RUN-001-independent/run/solver.log'))
for i,(x,y) in enumerate(zip(a,b)):
 if x!=y:
  print('first_difference',i); print('main:',x); print('independent:',y); break
else: print('prefix_equal',len(a),len(b),'length_equal',len(a)==len(b))
print('main_lines',len(a),'independent_lines',len(b))
