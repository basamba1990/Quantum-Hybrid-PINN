#ifndef openfoam_coolPropThermo_H
#define openfoam_coolPropThermo_H
#include "specie.H"
#include "dictionary.H"
#include "IOstreams.H"
#include "scalar.H"
#include <cmath>
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

    static scalar checked(const char* property, const scalar value, const scalar p, const scalar T)
    {
        if (!std::isfinite(value))
        {
            FatalErrorInFunction << "CoolProp returned non-finite " << property
                << ": p=" << p << " Pa, T=" << T << " K" << exit(FatalError);
        }
        return value;
    }

    static scalar safeP(const scalar p)
    {
        if (!std::isfinite(p) || p <= 0)
        {
            FatalErrorInFunction << "Invalid absolute pressure: p=" << p << " Pa" << exit(FatalError);
        }
        return p;
    }

    static scalar safeT(const scalar T)
    {
        if (!std::isfinite(T))
        {
            FatalErrorInFunction << "Invalid temperature: T=" << T << " K" << exit(FatalError);
        }
        return min(max(T, scalar(13.8033)), scalar(32.50));
    }

    scalar phaseProperty(const char* property, const scalar p, const scalar T) const
    {
        const scalar ps = safeP(p);
        const scalar Ts = safeT(T);
        return checked(property, PropsSI(property, "T", Ts, "Q", phaseQuality_, "ParaHydrogen"), ps, Ts);
    }

    scalar phaseDensity(const scalar p, const scalar T) const
    {
        const scalar ps = safeP(p);
        const scalar Ts = safeT(T);
        const scalar rho = checked
        (
            "density",
            PropsSI("D", "T", Ts, "Q", phaseQuality_, "ParaHydrogen"),
            ps,
            Ts
        );
        if (rho <= 0)
        {
            FatalErrorInFunction << "Non-positive phase density: rho=" << rho
                << " p=" << ps << " Pa, T=" << Ts << " K, Q=" << phaseQuality_
                << exit(FatalError);
        }
        return rho;
    }

    scalar phasePsi(const scalar p, const scalar T) const
    {
        const scalar ps = safeP(p);
        const scalar Ts = safeT(T);
        const scalar dp = max(100.0, 1e-3*max(mag(ps), scalar(1.0)));
        const scalar pLo = max(1000.0, ps - dp);
        const scalar pHi = ps + dp;
        const scalar rhoLo = checked("rho(p-dp)", PropsSI("D", "P", pLo, "T", Ts, "ParaHydrogen"), pLo, Ts);
        const scalar rhoHi = checked("rho(p+dp)", PropsSI("D", "P", pHi, "T", Ts, "ParaHydrogen"), pHi, Ts);
        const scalar psiValue = checked("psi", (rhoHi-rhoLo)/(pHi-pLo), ps, Ts);
        if (psiValue <= 0)
        {
            FatalErrorInFunction << "Non-positive compressibility psi=" << psiValue
                << " p=" << ps << " Pa, T=" << Ts << " K" << exit(FatalError);
        }
        return psiValue;
    }

public:
    explicit coolPropThermo(const dictionary& dict)
    :
        EquationOfState(dict),
        Hf_(dict.subDict("thermodynamics").getOrDefault<scalar>("Hf", 0)),
        Sf_(dict.subDict("thermodynamics").getOrDefault<scalar>("Sf", 0)),
        phaseQuality_(dict.subDict("thermodynamics").getOrDefault<scalar>("phaseQuality", -1))
    {
        if (phaseQuality_ < 0 || phaseQuality_ > 1)
        {
            FatalErrorInFunction << "thermodynamics.phaseQuality must be 0 or 1, got "
                << phaseQuality_ << exit(FatalError);
        }
    }

    coolPropThermo(const word& name, const coolPropThermo& rhs)
    : EquationOfState(name, rhs), Hf_(rhs.Hf_), Sf_(rhs.Sf_), phaseQuality_(rhs.phaseQuality_) {}

    static word typeName() { return "coolPropThermo<" + EquationOfState::typeName() + '>'; }
    scalar limit(const scalar T) const { return safeT(T); }
    scalar Cp(const scalar p, const scalar T) const { return max(phaseProperty("C", p, T), scalar(1.0)); }
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
        os.beginBlock("thermodynamics"); os.writeEntry("Hf", Hf_); os.writeEntry("Sf", Sf_);
        os.writeEntry("phaseQuality", phaseQuality_); os.endBlock();
    }
};
}
#endif
