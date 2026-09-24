#!/usr/bin/env python3
from math import sqrt

TSAT0 = 20.27
HFG0 = 446000.0

def tsat(p):
    return TSAT0 + 1.35e-5*(p - 101325.0)

def hfg(p):
    return max(0.0, HFG0 - 0.16*(p - 101325.0))

def nu(re, pr):
    return 2.0 + 0.6*sqrt(max(0.0, re))*max(0.0, pr)**(1/3)

def rate(T, p, *, evap, k=0.1, d=4.5e-4, re=100.0, pr=1.0, alpha=0.2):
    delta = T-tsat(p) if evap else tsat(p)-T
    if delta <= 0: return 0.0
    Ai = 6*alpha/d
    CA = 1 - sqrt((alpha+1e-8)/(0.64+1e-8))
    C = 1.0
    return C*CA*(k/d)*Ai*nu(re, pr)*delta/hfg(p)

assert rate(19.0, 101325.0, evap=True) == 0.0
assert rate(22.0, 101325.0, evap=True) > 0.0
assert rate(18.0, 101325.0, evap=False) > 0.0
assert hfg(101325.0) == HFG0
print('phase-change closure tests: PASS')
