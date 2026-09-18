#!/usr/bin/env python3
import json
from CoolProp.CoolProp import PropsSI
p=101325.0
T=20.268
out={
 'fluid':'ParaHydrogen',
 'pressure_Pa':p,
 'temperature_K':T,
 'liquid':{
  'rho_kg_m3':PropsSI('D','T',T,'P',p,'ParaHydrogen'),
  'mu_Pa_s':PropsSI('V','T',T,'P',p,'ParaHydrogen'),
  'cp_J_kg_K':PropsSI('C','T',T,'P',p,'ParaHydrogen'),
  'k_W_m_K':PropsSI('L','T',T,'P',p,'ParaHydrogen'),
  'h_J_kg':PropsSI('H','T',T,'P',p,'ParaHydrogen'),
 },
 'saturation':{
  'T_K':PropsSI('T','Q',0,'P',p,'ParaHydrogen'),
  'rho_liquid_kg_m3':PropsSI('D','Q',0,'P',p,'ParaHydrogen'),
  'rho_vapour_kg_m3':PropsSI('D','Q',1,'P',p,'ParaHydrogen'),
  'latent_heat_J_kg':PropsSI('H','Q',1,'P',p,'ParaHydrogen')-PropsSI('H','Q',0,'P',p,'ParaHydrogen'),
  'sigma_N_m':PropsSI('I','Q',0,'P',p,'ParaHydrogen')
 }
}
print(json.dumps(out,indent=2))
