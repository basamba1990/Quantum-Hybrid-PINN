#ifndef openfoam_coolPropThermo_H
#define openfoam_coolPropThermo_H

#include "specie.H"
#include "dictionary.H"
#include "IOstreams.H"
#include "scalar.H"
#define EXTERNC
#include "CoolProp/CoolPropLib.h"

namespace Foam
{

template<class EquationOfState>
class coolPropThermo : public EquationOfState
{
    scalar Hf_;
    scalar Sf_;

    static scalar cpCoolProp(const scalar p, const scalar T)
    {
        return PropsSI("C", "P", p, "T", T, "ParaHydrogen");
    }

    static scalar hCoolProp(const scalar p, const scalar T)
    {
        return PropsSI("H", "P", p, "T", T, "ParaHydrogen");
    }

    static scalar sCoolProp(const scalar p, const scalar T)
    {
        return PropsSI("S", "P", p, "T", T, "ParaHydrogen");
    }

public:
    explicit coolPropThermo(const dictionary& dict)
    :
        EquationOfState(dict),
        Hf_(dict.subDict("thermodynamics").getOrDefault<scalar>("Hf", 0)),
        Sf_(dict.subDict("thermodynamics").getOrDefault<scalar>("Sf", 0))
    {}

    coolPropThermo(const word& name, const coolPropThermo& rhs)
    :
        EquationOfState(name, rhs), Hf_(rhs.Hf_), Sf_(rhs.Sf_)
    {}

    static word typeName()
    {
        return "coolPropThermo<" + EquationOfState::typeName() + '>';
    }

    scalar limit(const scalar T) const { return max(T, 13.8033); }
    scalar Cp(const scalar p, const scalar T) const { return cpCoolProp(p, T); }
    scalar Ha(const scalar p, const scalar T) const { return hCoolProp(p, T) + Hf_; }
    scalar Hs(const scalar p, const scalar T) const { return hCoolProp(p, T); }
    scalar Hc() const { return Hf_; }
    scalar S(const scalar p, const scalar T) const { return sCoolProp(p, T) + Sf_; }
    scalar Gstd(const scalar T) const { return Ha(Pstd, T) - T*S(Pstd, T); }
    scalar dCpdT(const scalar p, const scalar T) const
    {
        const scalar dT = max(1e-3, 1e-4*mag(T));
        return (Cp(p, T + dT) - Cp(p, T - dT))/(2*dT);
    }
    scalar rho(const scalar p, const scalar T) const
    {
        return PropsSI("D", "P", p, "T", T, "ParaHydrogen");
    }

    void operator+=(const coolPropThermo& rhs)
    {
        EquationOfState::operator+=(rhs);
        Hf_ += rhs.Hf_;
        Sf_ += rhs.Sf_;
    }

    void operator*=(const scalar s)
    {
        EquationOfState::operator*=(s);
        Hf_ *= s;
        Sf_ *= s;
    }

    void write(Ostream& os) const
    {
        EquationOfState::write(os);
        os.beginBlock("thermodynamics");
        os.writeEntry("Hf", Hf_);
        os.writeEntry("Sf", Sf_);
        os.endBlock();
    }
};

}

#endif
