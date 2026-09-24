#include "lh2RanzMarshallSource.H"
#include "addToRunTimeSelectionTable.H"
#include "fvMatrices.H"
#include "volFields.H"
#include "IOobject.H"
#include "Time.H"
#include "polyTopoChangeMap.H"
#include "polyMeshMap.H"
#include "polyDistributionMap.H"
#include "mathematicalConstants.H"

namespace Foam { namespace fv
{
    defineTypeNameAndDebug(lh2RanzMarshallSource, 0);
    addToRunTimeSelectionTable(fvModel, lh2RanzMarshallSource, dictionary);
}}

Foam::fv::lh2RanzMarshallSource::lh2RanzMarshallSource
(
    const word& name, const word& modelType, const fvMesh& mesh, const dictionary& dict
)
:
    fvModel(name, modelType, mesh, dict),
    Cevap_(coeffs().lookupOrDefault<scalar>("Cevap", 1.0)),
    Ccond_(coeffs().lookupOrDefault<scalar>("Ccond", 1.0)),
    kLiquid_(coeffs().lookupOrDefault<scalar>("kLiquid", 0.1)),
    diameter_(coeffs().lookupOrDefault<scalar>("dispersedDiameter", 4.5e-4)),
    reynolds_(coeffs().lookupOrDefault<scalar>("Re", 100.0)),
    prandtl_(coeffs().lookupOrDefault<scalar>("Pr", 1.0)),
    hfg_(coeffs().lookupOrDefault<scalar>("hfg", 446000.0)),
    tsat0_(coeffs().lookupOrDefault<scalar>("Tsat0", 20.27)),
    tsatSlope_(coeffs().lookupOrDefault<scalar>("TsatSlope", 1.35e-5)),
    alphaName_(coeffs().lookupOrDefault<word>("alpha", "alpha.liquid")),
    temperatureName_(coeffs().lookupOrDefault<word>("temperature", "T")),
    pressureName_(coeffs().lookupOrDefault<word>("pressure", "p")),
    rho1Name_(coeffs().lookupOrDefault<word>("rho1", "rho.liquid")),
    rho2Name_(coeffs().lookupOrDefault<word>("rho2", "rho.vapour")),
    mDotEvapPtr_(nullptr),
    mDotCondPtr_(nullptr)
{
    if (diameter_ <= 0 || hfg_ <= 0) FatalIOErrorInFunction(coeffs()) << "diameter and hfg must be positive" << exit(FatalIOError);
}

Foam::scalar Foam::fv::lh2RanzMarshallSource::tsat(const scalar p) const
{
    return tsat0_ + tsatSlope_*(p - 101325.0);
}

Foam::scalar Foam::fv::lh2RanzMarshallSource::nu() const
{
    return 2.0 + 0.6*sqrt(max(0.0, reynolds_))*cbrt(max(0.0, prandtl_));
}

Foam::scalar Foam::fv::lh2RanzMarshallSource::areaDensity(const scalar alpha) const
{
    return 6.0*max(0.0, min(1.0, alpha))/diameter_;
}

Foam::scalar Foam::fv::lh2RanzMarshallSource::correction(const scalar alpha) const
{
    const scalar amin = 1e-8;
    const scalar apack = 0.64;
    return 1.0 - sqrt((max(0.0, alpha) + amin)/(apack + amin));
}

void Foam::fv::lh2RanzMarshallSource::calculate() const
{
    const volScalarField& alpha = mesh().lookupObject<volScalarField>(alphaName_);
    const volScalarField& T = mesh().lookupObject<volScalarField>(temperatureName_);
    const volScalarField& p = mesh().lookupObject<volScalarField>(pressureName_);

    if (!mDotEvapPtr_.valid())
    {
        mDotEvapPtr_.reset(new volScalarField
        (
            IOobject("mDotEvap", mesh().time().name(), mesh(), IOobject::NO_READ, IOobject::AUTO_WRITE),
            mesh(), dimensionedScalar("zero", dimMass/dimVolume/dimTime, 0)
        ));
        mDotCondPtr_.reset(new volScalarField
        (
            IOobject("mDotCond", mesh().time().name(), mesh(), IOobject::NO_READ, IOobject::AUTO_WRITE),
            mesh(), dimensionedScalar("zero", dimMass/dimVolume/dimTime, 0)
        ));
    }

    scalarField& evap = mDotEvapPtr_().internalFieldRef();
    scalarField& cond = mDotCondPtr_().internalFieldRef();
    const scalar Nu = nu();
    forAll(evap, celli)
    {
        const scalar Ai = areaDensity(alpha[celli]);
        const scalar coeff = (kLiquid_/diameter_)*Ai*Nu/hfg_;
        evap[celli] = Cevap_*correction(alpha[celli])*coeff*max(0.0, T[celli] - tsat(p[celli]));
        cond[celli] = Ccond_*correction(alpha[celli])*coeff*max(0.0, tsat(p[celli]) - T[celli]);
    }
    // Keep diagnostics in the object registry; a function object or solver
    // write phase can persist them at the selected output times.
    mDotEvapPtr_().correctBoundaryConditions();
    mDotCondPtr_().correctBoundaryConditions();
}

Foam::wordList Foam::fv::lh2RanzMarshallSource::addSupFields() const
{
    return wordList({rho1Name_, rho2Name_});
}

void Foam::fv::lh2RanzMarshallSource::addSup
(
    const volScalarField& field, fvMatrix<scalar>& eqn
) const
{
    calculate();
    scalarField& source = eqn.source();
    const scalarField& evap = mDotEvapPtr_().internalField();
    const scalarField& cond = mDotCondPtr_().internalField();
    forAll(source, celli)
    {
        const scalar net = evap[celli] - cond[celli];
        source[celli] += mesh().V()[celli]
            *(field.name() == rho1Name_ ? -net : net);
    }
}

void Foam::fv::lh2RanzMarshallSource::addSup
(
    const volScalarField&, const volScalarField& field, fvMatrix<scalar>& eqn
) const
{
    addSup(field, eqn);
}

void Foam::fv::lh2RanzMarshallSource::addSup
(
    const volScalarField&, const volScalarField& rho,
    const volScalarField& field, fvMatrix<scalar>& eqn
) const
{
    calculate();
    scalarField& source = eqn.source();
    const scalarField& evap = mDotEvapPtr_().internalField();
    const scalarField& cond = mDotCondPtr_().internalField();
    forAll(source, celli)
    {
        const scalar net = evap[celli] - cond[celli];
        const scalar sourceRate =
            field.name() == alphaName_
          ? (rho.name() == rho1Name_ ? -net : net)
          : (rho.name() == rho1Name_ ? -net*hfg_ : net*hfg_);
        source[celli] += mesh().V()[celli]*sourceRate;
    }
}

bool Foam::fv::lh2RanzMarshallSource::movePoints() { return true; }
void Foam::fv::lh2RanzMarshallSource::topoChange(const polyTopoChangeMap&) {}
void Foam::fv::lh2RanzMarshallSource::mapMesh(const polyMeshMap&) {}
void Foam::fv::lh2RanzMarshallSource::distribute(const polyDistributionMap&) {}
