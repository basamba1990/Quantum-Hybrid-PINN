#!/usr/bin/env python3
from pathlib import Path
import hashlib, json
import xml.etree.ElementTree as ET
import numpy as np
root=Path(__file__).resolve().parents[1]/'pilot_case/LH2-TANK-TRANSIENT-RUN-001'
rows=[]
for i,t in enumerate(np.arange(0.01,0.081,0.01)):
 p=root/'run'/'frames'/f'frame_{i:04d}.vtu'
 tree=ET.parse(p); point_data=tree.find('.//PointData')
 arrays={a.attrib.get('Name'):a for a in point_data.findall('DataArray')} if point_data is not None else {}
 if 'p' not in arrays or 'U' not in arrays: raise SystemExit(f'missing point p/U in {p}: {list(arrays)}')
 pressure=np.fromstring(arrays['p'].text or '',sep=' ',dtype=float)
 velocity=np.fromstring(arrays['U'].text or '',sep=' ',dtype=float).reshape(-1,3)
 speed=np.linalg.norm(velocity,axis=1)
 rows.append({'time_s':round(float(t),2),'pressure_min_Pa':float(pressure.min()),'pressure_max_Pa':float(pressure.max()),'pressure_mean_Pa':float(pressure.mean()),'pressure_range_Pa':float(pressure.max()-pressure.min()),'speed_min_m_s':float(speed.min()),'speed_max_m_s':float(speed.max()),'speed_mean_m_s':float(speed.mean()),'point_count':int(len(pressure)),'frame_sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
out={'runId':'LH2-TANK-TRANSIENT-RUN-001','status':'PRESSURE_AND_VELOCITY_ONLY','thermalStatus':'NOT_COMPUTABLE_TEMPERATURE_FIELD_ABSENT','sourceFields':['p','U'],'units':{'p':'Pa','U':'m/s'},'frames':rows,'notes':['Pressure statistics are calculated from the exported point p field.','No temperature, enthalpy, heat flux, density or phase-fraction field was exported; no thermal result is inferred.','This is an incompressible laminar pimpleFoam run, not a thermo-boiling LH2 reproduction.']}
path=root/'run'/'pressure_velocity_analysis.json'; path.write_text(json.dumps(out,indent=2)+'\n'); print(json.dumps(out,indent=2))
