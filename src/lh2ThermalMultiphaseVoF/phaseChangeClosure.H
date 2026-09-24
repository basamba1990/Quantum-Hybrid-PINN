/*
 * Prototype scalar closure for lh2ThermalMultiphaseVoF.
 * The OpenFOAM field integration is intentionally not hidden here.
 */
#pragma once

#include <algorithm>
#include <cmath>
#include <stdexcept>

namespace lh2ThermalMultiphaseVoF
{
struct Properties
{
    double hfg_J_per_kg;
    double tsat_K;
    double kLiquid_W_per_mK;
    double dispersedDiameter_m;
    double reynolds;
    double prandtl;
    double alphaDispersed;
    double alphaMin{1e-8};
    double alphaPack{0.64};
    double Cevap{1.0};
    double Ccond{1.0};
};

inline double saturationTemperature(double pressurePa)
{
    // Placeholder monotone correlation for the integration test only.
    // Replace with a validated NIST/CoolProp table before a production run.
    if (pressurePa <= 0.0) throw std::domain_error("pressure must be positive");
    return 20.27 + 1.35e-5*(pressurePa - 101325.0);
}

inline double latentHeat(double pressurePa)
{
    if (pressurePa <= 0.0) throw std::domain_error("pressure must be positive");
    return std::max(0.0, 446000.0 - 0.16*(pressurePa - 101325.0));
}

inline double ranzMarshallNu(double reynolds, double prandtl)
{
    return 2.0 + 0.6*std::sqrt(std::max(0.0, reynolds))*std::cbrt(std::max(0.0, prandtl));
}

inline double interfacialAreaDensity(double alphaDispersed, double diameter)
{
    if (diameter <= 0.0) throw std::domain_error("dispersed diameter must be positive");
    return 6.0*std::max(0.0, alphaDispersed)/diameter;
}

inline double effectiveAreaCorrection(const Properties& p)
{
    return 1.0 - std::sqrt(
        (std::max(0.0, p.alphaDispersed) + p.alphaMin)
        /(p.alphaPack + p.alphaMin));
}

inline double evaporationRate(double Tl, double pressurePa, const Properties& p)
{
    const double superheat = Tl - saturationTemperature(pressurePa);
    if (superheat <= 0.0) return 0.0;
    const double Ai = interfacialAreaDensity(p.alphaDispersed, p.dispersedDiameter_m);
    return p.Cevap*effectiveAreaCorrection(p)*(p.kLiquid_W_per_mK/p.dispersedDiameter_m)
        *Ai*ranzMarshallNu(p.reynolds, p.prandtl)*superheat/p.hfg_J_per_kg;
}

inline double condensationRate(double Tv, double pressurePa, const Properties& p)
{
    const double subcooling = saturationTemperature(pressurePa) - Tv;
    if (subcooling <= 0.0) return 0.0;
    const double Ai = interfacialAreaDensity(p.alphaDispersed, p.dispersedDiameter_m);
    return p.Ccond*effectiveAreaCorrection(p)*(p.kLiquid_W_per_mK/p.dispersedDiameter_m)
        *Ai*ranzMarshallNu(p.reynolds, p.prandtl)*subcooling/p.hfg_J_per_kg;
}
}
