#ifndef openfoam_coolPropThermo_H
#define openfoam_coolPropThermo_H
#include "specie.H"
#include "dictionary.H"
#include "IOstreams.H"
#include "scalar.H"
#include <cmath>
#include <cstdlib>
#define EXTERNC
#include "CoolProp/CoolPropLib.h"
namespace Foam
{
template<class EquationOfState>
class coolPropThermo : public EquationOfState
{
    scalar Hf_;
    scalar Sf_;
    scalar phaseQuality_;
    scalar pRef_;
    scalar pMin_;
    scalar pMax_;
    scalar saturationHalfWidth_;
    scalar saturationMargin_;

    static scalar finiteValue(const char* name, const scalar value)
    {
        if (!std::isfinite(static_cast<double>(value)))
        {
            FatalErrorInFunction << name << " is non-finite: " << value
                << exit(FatalError);
        }
        return value;
    }

    static scalar positiveValue(const char* name, const scalar value)
    {
        finiteValue(name, value);
        if (value <= scalar(0))
        {
            FatalErrorInFunction << name << " is not positive: " << value
                << exit(FatalError);
        }
        return value;
    }

    scalar absolutePressure(const scalar p) const
    {
        const scalar pa = finiteValue("p", p) + pRef_;
        if (!std::isfinite(static_cast<double>(pa)) || pa < pMin_ || pa > pMax_)
        {
            FatalErrorInFunction
                << "absolute pressure outside [" << pMin_ << ", " << pMax_
                << "] Pa: p=" << p << ", pRef=" << pRef_ << exit(FatalError);
        }
        return pa;
    }

    scalar saturationTemperature(const scalar p) const
    {
        const scalar pa = absolutePressure(p);
        const scalar pCrit = positiveValue("Pcrit", PropsSI("Pcrit", "T", 20.0, "Q", 0.0, "ParaHydrogen"));
        if (pa >= pCrit)
        {
            FatalErrorInFunction << "two-phase thermo requires p < Pcrit: p="
                << pa << " Pa, Pcrit=" << pCrit << exit(FatalError);
        }
        const scalar Ts = positiveValue
        (
            "Tsat", PropsSI("T", "P", pa, "Q", scalar(0), "ParaHydrogen")
        );
        if (!std::isfinite(static_cast<double>(Ts)))
        {
            FatalErrorInFunction << "non-finite Tsat at p=" << pa << exit(FatalError);
        }
        return Ts;
    }

    void temperatureBounds(const scalar p, scalar& Tmin, scalar& Tmax) const
    {
        const scalar pa = absolutePressure(p);
        const scalar Ttriple = positiveValue("Ttriple", PropsSI("Ttriple", "T", 20.0, "Q", 0.0, "ParaHydrogen"));
        const scalar Tcrit = positiveValue("Tcrit", PropsSI("Tcrit", "T", 20.0, "Q", 0.0, "ParaHydrogen"));
        const scalar Ts = saturationTemperature(p);
        const scalar lo = max(Ttriple + saturationMargin_, Ts - saturationHalfWidth_);
        const scalar hi = min(Tcrit - saturationMargin_, Ts + saturationHalfWidth_);
        if (phaseQuality_ <= 0.5)
        {
            Tmin = lo;
            Tmax = min(Ts + saturationMargin_, hi);
        }
        else
        {
            Tmin = max(Ts - saturationMargin_, lo);
            Tmax = hi;
        }
        if (!(Tmin < Tmax))
        {
            FatalErrorInFunction << "empty phase temperature window at p=" << pa
                << " Pa, Tsat=" << Ts << " K: [" << Tmin << ", " << Tmax
                << "] K" << exit(FatalError);
        }
    }

    scalar safeT(const scalar p, const scalar T) const
    {
        const scalar temperature = finiteValue("T", T);
        scalar Tmin = 0;
        scalar Tmax = 0;
        temperatureBounds(p, Tmin, Tmax);
        if (temperature < Tmin || temperature > Tmax)
        {
            FatalErrorInFunction << "T outside phase window at p=" << absolutePressure(p)
                << " Pa: T=" << temperature << " K, expected [" << Tmin
                << ", " << Tmax << "] K, phaseQuality=" << phaseQuality_
                << exit(FatalError);
        }
        return temperature;
    }

    scalar checked(const char* property, const scalar value, const scalar p, const scalar T) const
    {
        const scalar v = finiteValue(property, value);
        if (std::getenv("LH2_THERMO_TRACE"))
        {
            Info<< "LH2 thermo trace property=" << property
                << " p_abs=" << absolutePressure(p) << " T=" << T
                << " value=" << v << " phaseQuality=" << phaseQuality_ << nl;
        }
        return v;
    }

    scalar phaseProperty(const char* property, const scalar p, const scalar T) const
    {
        const scalar ps = absolutePressure(p);
        const scalar Ts = safeT(p, T);
        return checked
        (
            property,
            PropsSI(property, "T", Ts, "Q", phaseQuality_, "ParaHydrogen"),
            p,
            Ts
        );
    }

    scalar phaseDensity(const scalar p, const scalar T) const
    {
        const scalar rho = phaseProperty("D", p, T);
        return positiveValue("rho", rho);
    }

    scalar phasePsi(const scalar p, const scalar T) const
    {
        const scalar pa = absolutePressure(p);
        const scalar Ts = safeT(p, T);
        const scalar dp = max(100.0, 1e-3*max(mag(pa), scalar(1.0)));
        const scalar pLo = max(pMin_, pa - dp);
        const scalar pHi = min(pMax_, pa + dp);
        if (!(pHi > pLo))
        {
            FatalErrorInFunction << "invalid pressure stencil pLo=" << pLo
                << ", pHi=" << pHi << exit(FatalError);
        }
        const scalar rhoLo = checked("rho(p-dp)", PropsSI("D", "P", pLo, "T", Ts, "ParaHydrogen"), pLo-pRef_, Ts);
        const scalar rhoHi = checked("rho(p+dp)", PropsSI("D", "P", pHi, "T", Ts, "ParaHydrogen"), pHi-pRef_, Ts);
        const scalar psiValue = checked("psi", (rhoHi-rhoLo)/(pHi-pLo), p, Ts);
        return positiveValue("psi", psiValue);
    }

public:
    scalar lh2THs(const scalar h, const scalar p, const scalar T0) const
    {
        const scalar pa = absolutePressure(p);
        const scalar targetH = finiteValue("h", h) - Hf_;
        const scalar T = PropsSI("T", "P", pa, "H", targetH, "ParaHydrogen");
        if (std::getenv("LH2_THERMO_TRACE"))
        {
            Info<< "LH2_THERMO_TRACE inversion=P,H p_abs=" << pa
                << " h_input=" << h << " h_target=" << targetH
                << " T0=" << T0 << " T_out=" << T << nl;
        }
        return safeT(p, finiteValue("T(P,H)", T));
    }

    explicit coolPropThermo(const dictionary& dict)
    :
        EquationOfState(dict),
        Hf_(dict.subDict("thermodynamics").getOrDefault<scalar>("Hf", 0)),
        Sf_(dict.subDict("thermodynamics").getOrDefault<scalar>("Sf", 0)),
        phaseQuality_(dict.subDict("thermodynamics").getOrDefault<scalar>("phaseQuality", -1)),
        pRef_(dict.subDict("thermodynamics").getOrDefault<scalar>("pRef", 0)),
        pMin_(dict.subDict("thermodynamics").getOrDefault<scalar>("pMin", 10000)),
        pMax_(dict.subDict("thermodynamics").getOrDefault<scalar>("pMax", 2000000)),
        saturationHalfWidth_(dict.subDict("thermodynamics").getOrDefault<scalar>("saturationHalfWidth", 6.0)),
        saturationMargin_(dict.subDict("thermodynamics").getOrDefault<scalar>("saturationMargin", 0.02))
    {
        if (phaseQuality_ < 0 || phaseQuality_ > 1)
        {
            FatalErrorInFunction << "thermodynamics.phaseQuality must be 0 or 1, got "
                << phaseQuality_ << exit(FatalError);
        }
        positiveValue("pMin", pMin_);
        if (!(pMax_ > pMin_))
        {
            FatalErrorInFunction << "thermodynamics.pMax must exceed pMin" << exit(FatalError);
        }
        positiveValue("saturationHalfWidth", saturationHalfWidth_);
        positiveValue("saturationMargin", saturationMargin_);
    }

    coolPropThermo(const word& name, const coolPropThermo& rhs)
    : EquationOfState(name, rhs), Hf_(rhs.Hf_), Sf_(rhs.Sf_), phaseQuality_(rhs.phaseQuality_),
      pRef_(rhs.pRef_), pMin_(rhs.pMin_), pMax_(rhs.pMax_),
      saturationHalfWidth_(rhs.saturationHalfWidth_), saturationMargin_(rhs.saturationMargin_) {}

    static word typeName() { return "coolPropThermo<" + EquationOfState::typeName() + '>'; }
    scalar limit(const scalar T) const { return finiteValue("T", T); }
    scalar Cp(const scalar p, const scalar T) const { return positiveValue("Cp", phaseProperty("C", p, T)); }
    scalar Ha(const scalar p, const scalar T) const { return phaseProperty("H", p, T) + Hf_; }
    scalar Hs(const scalar p, const scalar T) const { return phaseProperty("H", p, T); }
    scalar Hc() const { return Hf_; }
    scalar S(const scalar p, const scalar T) const { return phaseProperty("S", p, T) + Sf_; }
    scalar Gstd(const scalar T) const { return Ha(Pstd, T) - T*S(Pstd, T); }
    scalar dCpdT(const scalar p, const scalar T) const
    {
        const scalar dT = max(1e-3, 1e-4*mag(T));
        return (Cp(p, T+dT)-Cp(p, T-dT))/(2*dT);
    }
    scalar rho(const scalar p, const scalar T) const { return phaseDensity(p, T); }
    scalar psi(const scalar p, const scalar T) const { return phasePsi(p, T); }
    void operator+=(const coolPropThermo& rhs)
    {
        EquationOfState::operator+=(rhs); Hf_ += rhs.Hf_; Sf_ += rhs.Sf_; phaseQuality_ = rhs.phaseQuality_;
    }
    void operator*=(const scalar s)
    {
        EquationOfState::operator*=(s); Hf_ *= s; Sf_ *= s;
    }
    void write(Ostream& os) const
    {
        EquationOfState::write(os);
        os.beginBlock("thermodynamics");
        os.writeEntry("Hf", Hf_); os.writeEntry("Sf", Sf_); os.writeEntry("phaseQuality", phaseQuality_);
        os.writeEntry("pRef", pRef_); os.writeEntry("pMin", pMin_); os.writeEntry("pMax", pMax_);
        os.writeEntry("saturationHalfWidth", saturationHalfWidth_); os.writeEntry("saturationMargin", saturationMargin_);
        os.endBlock();
    }
};
}
#endif
